"""Offline tests: no API key, no network, no model download. Fake LLM + hashed bag-of-words embeddings."""
import asyncio
import hashlib
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import scoring  # noqa: E402

DUCK_GITHUB = ("A maintained personal GitHub profile with at least one substantive AI/LLM project "
               "(academic or personal) — not a cloned tutorial.")


def test_compound_github_requirement_is_split():
    skill, link = scoring.split_link_clause(DUCK_GITHUB)
    assert "project" in skill.lower() and "github" not in skill.lower()
    assert "link" in link.lower()


def test_pure_link_requirement_is_not_split():
    assert scoring.split_link_clause("Share your resume along with your GitHub profile link.") is None


def test_entry_level_detection():
    assert scoring.is_entry_level("candidates with 0 to 2 years of experience")
    assert scoring.is_entry_level("We hire freshers and new grads")
    assert not scoring.is_entry_level("8+ years leading distributed systems teams")


def test_stated_requires_verbatim_quote_and_inferred_never_critical():
    jd = "You must have strong Python skills. Nice to have: Docker."
    rows = scoring._clean_requirements([
        {"requirement": "Python", "importance": "critical", "evidence": "stated", "jd_signal": "strong Python skills"},
        {"requirement": "Kubernetes", "importance": "critical", "evidence": "stated", "jd_signal": "invented quote"},
        {"requirement": "Leadership", "importance": "high", "evidence": "inferred", "jd_signal": None},
    ], jd)
    assert rows[0]["importance"] == "critical" and rows[0]["evidence_tier"] == "stated"
    assert rows[1]["evidence_tier"] == "inferred" and rows[1]["importance"] == "meaningful"
    assert rows[2]["importance"] == "meaningful"


@pytest.mark.parametrize("score,conf,stops,expect", [
    (4.3, "high", [], "Apply"), (4.0, "low", [], "Apply"), (4.2, "medium", ["x"], "Consider"),
    (3.7, "low", [], "Research first"), (3.7, "high", [], "Consider"), (3.4, "high", [], "Skip"),
])
def test_decision_rules(score, conf, stops, expect):
    assert scoring.decide(score, conf, stops)["decision"] == expect


def test_confidence_never_changes_score_path():
    assert scoring.confidence_tier({"cv_match": "unknown", "north_star": "supported", "red_flags": "supported"}, True) == "low"
    assert scoring.confidence_tier({"cv_match": "supported", "north_star": "supported", "red_flags": "supported"}, True) == "high"


def test_fallback_is_labelled_and_explains_itself():
    r = scoring.heuristic_fallback(60.0, reason="RateLimitError: 429")
    assert r["engine"] == "heuristic" and r["confidence"] == "low" and "429" in r["fallback_reason"]
    assert r["score"] <= 3.9


# ---- full pipeline with a fake LLM -------------------------------------------------

JD = ("Associate ML Engineer (0-2 years), early-career. Required: strong Python fundamentals; must have a substantive "
      "ML project on GitHub. " + "filler " * 40)
CV = "PROJECTS\nSemantic search with embeddings in Python using FastAPI and cosine retrieval\nSKILLS\nPython SQL Docker"


async def fake_embed(texts, task):
    out = np.zeros((len(texts), 64), dtype=np.float32)
    for i, t in enumerate(texts):
        for w in t.lower().split():
            out[i, int(hashlib.md5(w.encode()).hexdigest(), 16) % 64] += 1
    return out / (np.linalg.norm(out, axis=1, keepdims=True) + 1e-9)


def run_screen(monkeypatch, p1, p2, mode="rag", embed=None, target_roles=""):
    seen = {}

    async def fake_json(client, system, user, required=()):
        if "JD-reading pass" in system:
            return p1
        seen["payload"] = user
        return p2

    monkeypatch.setattr(scoring, "_client", lambda: object())
    monkeypatch.setattr(scoring, "_generate_json", fake_json)
    monkeypatch.setattr(scoring, "_embed", embed or fake_embed)
    scoring._cache.clear()
    return asyncio.run(scoring.screen(JD, CV, "Associate ML Engineer", owner="t", mode=mode, target_roles=target_roles)), seen


P1 = {"role_summary": {"archetype": "ml"}, "requirements": [
    {"requirement": "Strong Python fundamentals", "kind": "skill", "importance": "critical", "evidence": "stated",
     "jd_signal": "strong Python fundamentals"},
    {"requirement": DUCK_GITHUB, "kind": "skill", "importance": "critical", "evidence": "inferred", "jd_signal": None},
]}
P2 = {"matches": [{"id": 0, "match": "strong", "evidence": "Python SQL Docker"},
                  {"id": 1, "match": "strong", "evidence": "text that is not in the resume at all"}],
      "dimensions": {"cv_match": 4, "north_star": 4, "red_flags": 5},
      "score_evidence": {"cv_match": "supported", "north_star": "supported", "red_flags": "supported"},
      "global_score": 4.4, "red_flags": [], "summary": "ok", "next_action": "apply"}


def test_pipeline_downgrades_unbacked_strong_and_keeps_link_out_of_score(monkeypatch):
    res, seen = run_screen(monkeypatch, P1, P2)
    by_text = {r["text"]: r for r in res["requirements"]}
    assert all("github" not in t.lower() for t in by_text), "link clause must not be a scored requirement"
    assert any("project" in t.lower() for t in by_text)
    unbacked = [r for r in res["requirements"] if "project" in r["text"].lower()][0]
    assert unbacked["match"] == "partial", "strong without resume-backed evidence must be downgraded"
    assert any("GitHub" in c for c in res["checklist"]), "link goes to the before-you-apply checklist"
    assert '"candidate_level_expected": "entry"' in seen["payload"]
    assert res["score"] == 4.4 and res["decision"] == "Apply"


def test_judge_always_sees_nearest_chunk(monkeypatch):
    p1 = {"requirements": [{"requirement": "Kubernetes operators", "kind": "skill", "importance": "high",
                            "evidence": "structural", "jd_signal": "section"}]}
    _, seen = run_screen(monkeypatch, p1, {"matches": [], "global_score": 2.0})
    assert '"resume_snippets": []' not in seen["payload"]


def test_full_mode_sends_whole_resume_and_skips_embeddings(monkeypatch):
    async def boom(*a, **k):
        raise AssertionError("full mode must not call the embedder")
    res, seen = run_screen(monkeypatch, P1, P2, mode="full", embed=boom)
    assert '"resume":' in seen["payload"] and "resume_snippets" not in seen["payload"]
    assert res["evidence_mode"] == "full"


def test_rag_mode_still_retrieves(monkeypatch):
    res, seen = run_screen(monkeypatch, P1, P2, mode="rag")
    assert "resume_snippets" in seen["payload"] and '"resume":' not in seen["payload"]
    assert res["engine"].startswith("rag-")


def test_target_roles_reach_the_judge(monkeypatch):
    _, seen = run_screen(monkeypatch, P1, P2, target_roles="AI/ML Engineer (fresher)")
    assert "AI/ML Engineer (fresher)" in seen["payload"]


def test_enumerated_items_and_coverage():
    req = "Working understanding of LLM fundamentals (prompting, embeddings, RAG, basic evaluation)"
    assert scoring.enumerated_items(req) == ["prompting", "embeddings", "RAG", "basic evaluation"]
    assert scoring.item_coverage(req, "Used prompting, embeddings and RAG in a project") == 0.75
    assert scoring.item_coverage("Good Python skills", "python") is None
    assert scoring.enumerated_items("Exposure to frameworks (e.g. Ragas, DeepEval)") == []


def test_strong_is_capped_when_a_listed_element_is_missing(monkeypatch):
    p1 = {"requirements": [{"requirement": "LLM fundamentals (prompting, embeddings, RAG, basic evaluation)", "kind": "skill",
                            "importance": "high", "evidence": "structural", "jd_signal": "x"}]}
    p2 = {"matches": [{"id": 0, "match": "strong", "evidence": "Semantic search with embeddings in Python"}],
          "global_score": 4.0, "dimensions": {}, "score_evidence": {}}
    res, _ = run_screen(monkeypatch, p1, p2, mode="full")
    assert res["requirements"][0]["match"] == "partial"


class _FakeResp:
    def __init__(self, text):
        self.choices = [type("C", (), {"message": type("M", (), {"content": text})()})()]


class _FakeClient:
    def __init__(self, replies):
        self.replies, self.calls = list(replies), 0
        self.chat = type("Ch", (), {"completions": self})()

    async def create(self, **kw):
        self.calls += 1
        return _FakeResp(self.replies.pop(0))


REQ = ("matches", "global_score", "dimensions", "score_evidence")
GOOD = '{"matches":[{"id":0}],"global_score":4.1,"dimensions":{"cv_match":4},"score_evidence":{"cv_match":"supported"}}'


def test_incomplete_json_is_retried_not_defaulted_to_one():
    client = _FakeClient(['{"matches":[{"id":0}]}', GOOD])
    out = asyncio.run(scoring._generate_json(client, "s", "u", REQ))
    assert out["global_score"] == 4.1 and client.calls == 2


def test_persistently_incomplete_json_raises_so_fallback_is_labelled():
    client = _FakeClient(['{"matches":[1]}'] * 3)
    with pytest.raises(ValueError):
        asyncio.run(scoring._generate_json(client, "s", "u", REQ))


def test_out_of_range_score_is_rejected():
    client = _FakeClient([GOOD.replace("4.1", "9.5"), GOOD])
    assert asyncio.run(scoring._generate_json(client, "s", "u", REQ))["global_score"] == 4.1


def test_experience_years_from_dated_experience_only():
    cv = ("EXPERIENCE\nSenior Engineer, 2022-present, a platform\nEngineer, 2019 - 2022, a fintech\n"
          "EDUCATION\nB.E. 2015 - 2019\nSKILLS\nGo")
    assert abs(scoring.estimate_experience_years(cv, today=(2026, 11)) - 7.4) < 0.15
    assert scoring.estimate_experience_years("EDUCATION\nB.Tech 2022 - 2026\nPROJECTS\nX", today=(2026, 11)) is None
    assert scoring.estimate_experience_years("EXPERIENCE\nAI/ML Intern, Jan 2025 - Jun 2025\nEDUCATION\n2022 - 2026") == 0.5
    overlap = "EXPERIENCE\nA 2020 - 2022\nB 2021 - 2023\nSKILLS\n"
    assert scoring.estimate_experience_years(overlap) == 3.0


def run_scores(monkeypatch, scores):
    calls = {"n": 0}
    base = dict(P2)

    async def fake_json(client, system, user, required=()):
        if "JD-reading pass" in system:
            return P1
        out = dict(base, global_score=scores[min(calls["n"], len(scores) - 1)])
        calls["n"] += 1
        return out

    monkeypatch.setattr(scoring, "_client", lambda: object())
    monkeypatch.setattr(scoring, "_generate_json", fake_json)
    monkeypatch.setattr(scoring, "_embed", fake_embed)
    scoring._cache.clear()
    return asyncio.run(scoring.screen(JD, CV, "x", owner="t", mode="full")), calls


def test_borderline_score_gets_second_run_and_stable_pair_is_averaged(monkeypatch):
    res, calls = run_scores(monkeypatch, [4.2, 4.3])
    assert calls["n"] == 2 and res["score_runs"] == [4.2, 4.3] and not res["unstable"]
    assert res["decision"] == "Apply" and res["score_range"] == [4.2, 4.3]


def test_disagreeing_runs_downgrade_to_research_first_with_low_confidence(monkeypatch):
    res, calls = run_scores(monkeypatch, [4.3, 3.7])
    assert res["unstable"] and res["confidence"] == "low"
    assert res["decision"] == "Research first" and res["score"] == 4.0 and res["score_range"] == [3.7, 4.3]


def test_clear_scores_cost_one_call(monkeypatch):
    for sc in (4.8, 2.1):
        res, calls = run_scores(monkeypatch, [sc])
        assert calls["n"] == 1 and res["score_range"] == [sc, sc]
