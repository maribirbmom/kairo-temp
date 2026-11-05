"""Kairo evaluation harness (free: Groq free tier + local embeddings, nothing else).

    python -m evals.run_eval --cases evals/golden/private evals/golden --repeats 2 --metamorphic
    python -m evals.run_eval --cases evals/golden/private --trace          # dump pass-1 rows + retrieved snippets

A case is a JSON file:
  {"id", "jd" | "jd_path", "resume" | "resume_path", "title",
   "reference": {"score", "decision", "requirements": [{"requirement","importance","match"}]}}
Real resumes live in evals/golden/private/ (gitignored). Resumes are ALWAYS redacted before use.
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import scoring  # noqa: E402
from redact import redact  # noqa: E402
from evals import metamorphic as mm  # noqa: E402
from evals import metrics as mt  # noqa: E402

OUT = Path(__file__).parent / "out"


def _nlp():
    try:
        import spacy
        return spacy.load("en_core_web_sm")
    except Exception:
        return None


def load_cases(paths):
    cases = []
    for p in map(Path, paths):
        for f in sorted(p.glob("*.json")) if p.is_dir() else [p]:
            c = json.loads(f.read_text())
            c["jd"] = c.get("jd") or Path(c["jd_path"]).expanduser().read_text()
            c["resume"] = c.get("resume") or Path(c["resume_path"]).expanduser().read_text()
            cases.append(c)
    return cases


async def run_once(c, resume_text, salt, trace=None, retries=4, mode=None):
    for attempt in range(retries):
        try:
            return await scoring.screen(c["jd"], resume_text, c.get("title", ""), owner=f"eval-{salt}", trace=trace, mode=mode,
                                        target_roles=c.get("target_roles", ""))
        except Exception as e:  # free-tier 429s: back off, never fall back silently
            if attempt == retries - 1:
                raise
            await asyncio.sleep(8 * (attempt + 1))
            print(f"  retry after {type(e).__name__}", file=sys.stderr)


def f(x):
    return "n/a" if x != x else f"{x:.2f}"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", nargs="+", required=True)
    ap.add_argument("--repeats", type=int, default=2)
    ap.add_argument("--modes", nargs="+", default=["full", "rag"], choices=["full", "rag"],
                    help="evidence modes to compare on the same cases")
    ap.add_argument("--metamorphic", action="store_true")
    ap.add_argument("--trace", action="store_true")
    a = ap.parse_args()
    nlp = _nlp()
    OUT.mkdir(exist_ok=True)
    report, lines = [], ["# Kairo evaluation\n", f"engine `{scoring.ENGINE_VERSION}` model `{scoring.LLM_MODEL}` "
                         f"TOP_K={scoring.TOP_K} SIM_FLOOR={scoring.SIM_FLOOR}\n"]
    agg = {m: ([], []) for m in a.modes}
    for mode, c in [(m, c) for c in load_cases(a.cases) for m in a.modes]:
        pairs_s, pairs_d = agg[mode]
        red, counts = redact(c["resume"], nlp)
        for term in c.get("also_redact", []):  # belt and braces for real resumes: names/cities NER may miss
            red = re.sub(re.escape(term), "[REDACTED]", red, flags=re.I)
        tr = {} if a.trace else None
        runs = []
        for k in range(a.repeats):
            runs.append(await run_once(c, red, f"{c['id']}-{mode}-{k}", trace=tr if k == 0 else None, mode=mode))
        base = runs[0]
        ref = c.get("reference", {})
        st = mt.stability([r["score"] for r in runs])
        rm = mt.requirement_metrics(base["requirements"], ref.get("requirements", [])) if ref else {}
        row = {"id": c["id"], "mode": mode, "score": base["score"], "decision": base["decision"], "engine": base["engine"],
               "confidence": base["confidence"], "stability": st, "faithfulness": mt.evidence_faithfulness(base["requirements"], red),
               "reference": ref.get("score"), "ref_decision": ref.get("decision"), "requirements": rm,
               "redacted": counts}
        if ref:
            pairs_s.append((base["score"], ref["score"]))
            pairs_d.append((base["decision"], ref["decision"]))
        if a.metamorphic:
            shuf = await run_once(c, mm.shuffle_sections(red), f"{c['id']}-{mode}-shuf", mode=mode)
            pii = await run_once(c, redact(mm.inject_pii(c["resume"]), nlp)[0], f"{c['id']}-{mode}-pii", mode=mode)
            leak = mt.pii_leak_rate(mm.PLANTED_PII, redact(mm.inject_pii(""), nlp)[0])
            strong = next((r for r in base["requirements"] if r["match"] == "strong"), None)
            drop = None
            if strong:
                term = max(strong["evidence"].split(), key=len)
                dropped, n = mm.remove_evidence(red, term)
                if n:
                    drop = (await run_once(c, dropped, f"{c['id']}-{mode}-drop", mode=mode))["score"] - base["score"]
            row["metamorphic"] = {"shuffle_delta": shuf["score"] - base["score"], "pii_delta": pii["score"] - base["score"],
                                  "pii_leak_rate": leak, "remove_evidence_delta": drop}
        if a.trace:
            row["trace"] = tr
        report.append(row)
        lines.append(f"\n## {c['id']} [{mode}]\nscore **{base['score']}** ({base['decision']}, {base['confidence']} confidence, "
                     f"engine `{base['engine']}`) vs reference {ref.get('score', 'n/a')} ({ref.get('ref_decision', 'n/a') if ref else ''})  ")
        lines.append(f"repeat stdev {f(st['stdev'])}, range {f(st['range'])}; faithfulness {f(row['faithfulness'])}  ")
        if rm:
            lines.append(f"requirements: coverage(crit/high) {f(rm['coverage_critical_high'])}, match acc {f(rm['match_accuracy'])}, "
                         f"gap P/R/F1 {f(rm['gap_precision'])}/{f(rm['gap_recall'])}/{f(rm['gap_f1'])} ({rm['aligned']} aligned)  ")
        if "metamorphic" in row:
            m = row["metamorphic"]
            lines.append(f"metamorphic: shuffle Δ{m['shuffle_delta']:+.1f}, PII Δ{m['pii_delta']:+.1f}, "
                         f"PII leak {f(m['pii_leak_rate'])}, remove-evidence Δ{m['remove_evidence_delta'] if m['remove_evidence_delta'] is None else format(m['remove_evidence_delta'], '+.1f')}")
    for mode, (pairs_s, pairs_d) in agg.items():
        if pairs_s:
            lines.append(f"\n## Aggregate [{mode}]\nMAE vs reference **{f(mt.mae(pairs_s))}** over {len(pairs_s)} cases; "
                         f"Apply/not-Apply agreement **{f(mt.decision_agreement(pairs_d))}**")
    (OUT / "report.json").write_text(json.dumps(report, indent=2, default=str))
    (OUT / "report.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    asyncio.run(main())
