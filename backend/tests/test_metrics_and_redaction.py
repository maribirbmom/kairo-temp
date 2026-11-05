import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from evals import metamorphic as mm, metrics as mt  # noqa: E402
from redact import redact  # noqa: E402


def test_mae_and_agreement():
    assert abs(mt.mae([(4.0, 4.2), (3.0, 2.0)]) - 0.6) < 1e-9
    assert mt.decision_agreement([("Apply", "Apply"), ("Consider", "Skip"), ("Skip", "Apply")]) == 2 / 3


def test_spearman():
    assert math.isclose(mt.spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1.0)
    assert math.isclose(mt.spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1.0)
    assert math.isnan(mt.spearman([1, 2], [1, 2]))


def test_requirement_alignment_and_gap_metrics():
    ref = [{"requirement": "Python fundamentals data structures", "importance": "high", "match": "strong"},
           {"requirement": "Knowledge graphs embeddings retrieval", "importance": "high", "match": "partial"},
           {"requirement": "LLM evaluation harness golden datasets", "importance": "critical", "match": "missing"}]
    pred = [{"text": "Strong Python fundamentals and data structures", "match": "strong"},
            {"text": "Knowledge graphs and embedding retrieval", "match": "missing"},
            {"text": "Building LLM evaluation harnesses with golden datasets", "match": "missing"}]
    m = mt.requirement_metrics(pred, ref)
    assert m["aligned"] == 3 and m["coverage_critical_high"] == 1.0
    assert m["gap_recall"] == 1.0 and m["gap_precision"] == 1.0


def test_faithfulness_flags_fabricated_evidence():
    rows = [{"match": "strong", "evidence": "built a RAG screener in Python"},
            {"match": "strong", "evidence": "led a team of twelve engineers"}]
    assert mt.evidence_faithfulness(rows, "Built a RAG screener in Python using embeddings.") == 0.5


def test_remove_evidence_and_shuffle_keep_content():
    text = "Jane\n\nSKILLS\nPython\nDocker\n\nPROJECTS\nRAG in Python\n\nEDUCATION\nB.E."
    dropped, n = mm.remove_evidence(text, "docker")
    assert n == 1 and "Docker" not in dropped
    shuffled = mm.shuffle_sections(text, seed=1)
    assert sorted(shuffled.split()) == sorted(text.split())


def test_planted_pii_is_redacted_before_it_would_reach_the_llm():
    body = "SKILLS\nPython, FastAPI\nPROJECTS\nRAG screener using embeddings"
    out, counts = redact(mm.inject_pii(body), nlp=None)
    leak = mt.pii_leak_rate(mm.PLANTED_PII, out)
    # Street address and name need NER/heuristics; contact details must be fully gone.
    for secret in ("jane.q.testperson@example.com", "98765 43210", "github.com/janetestperson", "linkedin.com/in/jane-testperson"):
        assert secret not in out
    assert "Date of Birth" not in out and "Gender" not in out and "Marital" not in out
    assert "Python" in out and "RAG screener" in out, "skills must survive redaction"
    assert leak <= 0.2, out
