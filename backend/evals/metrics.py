"""Pure, dependency-free evaluation metrics for Kairo (all run offline, cost nothing)."""
import math
import re
from statistics import mean, pstdev
from typing import Dict, List, Sequence, Tuple

GAP = {"missing", "partial"}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", (s or "").lower())).strip()


def _tokens(s: str) -> set:
    return {t for t in _norm(s).split() if len(t) > 2}


def jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    return len(ta & tb) / len(ta | tb) if ta and tb else 0.0


def mae(pairs: Sequence[Tuple[float, float]]) -> float:
    """Mean absolute error between (predicted, reference) scores."""
    return mean(abs(p - r) for p, r in pairs) if pairs else float("nan")


def decision_agreement(pairs: Sequence[Tuple[str, str]]) -> float:
    """Share of cases where Apply-vs-not-Apply matches the reference (the decision users act on)."""
    if not pairs:
        return float("nan")
    return mean(1.0 if (p == "Apply") == (r == "Apply") else 0.0 for p, r in pairs)


def spearman(xs: Sequence[float], ys: Sequence[float]) -> float:
    """Rank correlation; needs >= 3 cases to mean anything."""
    n = len(xs)
    if n < 3:
        return float("nan")

    def ranks(v):
        order = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2 + 1
            i = j + 1
        return r

    rx, ry = ranks(xs), ranks(ys)
    mx, my = mean(rx), mean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else float("nan")


def align_requirements(pred: List[Dict], ref: List[Dict], min_sim: float = 0.25) -> List[Tuple[Dict, Dict]]:
    """Greedy one-to-one alignment of predicted rows to reference rows by token overlap."""
    cands = sorted(((jaccard(p["text"], r["requirement"]), i, j) for i, p in enumerate(pred) for j, r in enumerate(ref)),
                   reverse=True)
    used_p, used_r, out = set(), set(), []
    for sim, i, j in cands:
        if sim < min_sim:
            break
        if i in used_p or j in used_r:
            continue
        used_p.add(i)
        used_r.add(j)
        out.append((pred[i], ref[j]))
    return out


def requirement_metrics(pred: List[Dict], ref: List[Dict]) -> Dict[str, float]:
    """Row-level quality against a reference evaluation.

    coverage_critical_high: share of reference critical/high rows the engine also extracted.
    match_accuracy: share of aligned rows with the same strong/partial/missing label.
    gap precision/recall/F1: treating {missing, partial} as the positive class (what the CV Coach shows).
    """
    pairs = align_requirements(pred, ref)
    ref_ch = [r for r in ref if r["importance"] in ("critical", "high")]
    matched_ref = {id(r) for _, r in pairs}
    coverage = (sum(1 for r in ref_ch if id(r) in matched_ref) / len(ref_ch)) if ref_ch else float("nan")
    if not pairs:
        return {"coverage_critical_high": coverage, "match_accuracy": float("nan"),
                "gap_precision": float("nan"), "gap_recall": float("nan"), "gap_f1": float("nan"), "aligned": 0}
    acc = mean(1.0 if p["match"] == r["match"] else 0.0 for p, r in pairs)
    tp = sum(1 for p, r in pairs if p["match"] in GAP and r["match"] in GAP)
    fp = sum(1 for p, r in pairs if p["match"] in GAP and r["match"] not in GAP)
    fn = sum(1 for p, r in pairs if p["match"] not in GAP and r["match"] in GAP)
    prec = tp / (tp + fp) if tp + fp else float("nan")
    rec = tp / (tp + fn) if tp + fn else float("nan")
    f1 = 2 * prec * rec / (prec + rec) if prec == prec and rec == rec and prec + rec else float("nan")
    return {"coverage_critical_high": coverage, "match_accuracy": acc, "gap_precision": prec,
            "gap_recall": rec, "gap_f1": f1, "aligned": len(pairs)}


def evidence_faithfulness(rows: List[Dict], resume_text: str) -> float:
    """Share of 'strong' matches whose evidence is real resume text (anti-fabrication metric).

    Judges often stitch fragments with '...'; each fragment must be a verbatim span of the resume.
    """
    strong = [r for r in rows if r.get("match") == "strong"]
    if not strong:
        return float("nan")
    pool = _norm(resume_text)

    pool_tokens = set(pool.split())

    def ok(ev: str) -> bool:
        frags = [_norm(f) for f in re.split(r"\.{3}|\u2026", ev or "")]
        frags = [f for f in frags if len(f) >= 4]
        if not frags:
            return False
        if all(f in pool for f in frags):
            return True
        # Judges often drop list items without marking it. That is condensing, not fabricating: accept when
        # (almost) every word of the quote exists in the resume. Invented claims fail this.
        toks = [t for t in " ".join(frags).split() if len(t) > 2]
        return bool(toks) and sum(t in pool_tokens for t in toks) / len(toks) >= 0.9

    return mean(1.0 if ok(r.get("evidence", "")) else 0.0 for r in strong)


def stability(scores: Sequence[float]) -> Dict[str, float]:
    """Repeat-run noise for one case: LLM scoring should not wobble."""
    if not scores:
        return {"mean": float("nan"), "stdev": float("nan"), "range": float("nan")}
    return {"mean": mean(scores), "stdev": pstdev(scores), "range": max(scores) - min(scores)}


def pii_leak_rate(planted: Sequence[str], redacted_text: str) -> float:
    """Share of planted PII strings still present in text that would be sent to the LLM (lower is better)."""
    if not planted:
        return 0.0
    low = redacted_text.lower()
    return sum(1 for p in planted if p.lower() in low) / len(planted)
