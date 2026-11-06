import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import coach  # noqa: E402

CV = """EXPERIENCE
AI/ML Intern, Jan 2025 - Jun 2025
- Built a RAG-based resume screening system in Python using embeddings and semantic retrieval
- Deployed the FastAPI service on AWS Lambda
PROJECTS
FinFusion: LSTM forecasting and OCR pipeline, with 81% extraction confidence
SKILLS
Python, FastAPI, AWS, Docker"""


def test_locate_is_tolerant_but_unique():
    span, _ = coach.locate_unique("Built a RAG-based resume   screening system in Python using embeddings and semantic retrieval", CV)
    assert span is not None and CV[span[0]:span[1]].startswith("Built a RAG-based")
    assert coach.locate_unique("Deployed the FastAPI service on AWS Lambda", CV)[0] is not None
    span, why = coach.locate_unique("Led a team of ten engineers at Google", CV)
    assert span is None and "not found" in why
    assert coach.locate_unique("Python", CV)[0] is None, "too short to be unambiguous"
    assert coach.locate_unique("ab cd", CV)[0] is None
    dup = CV + "\n- Deployed the FastAPI service on AWS Lambda"
    assert "more than once" in coach.locate_unique("Deployed the FastAPI service on AWS Lambda", dup)[1]


def test_new_facts_flags_invented_numbers_and_tools_but_not_rewording():
    orig = "Built a RAG-based resume screening system in Python using embeddings"
    ok = "Built a RAG-based resume screening system in Python using embeddings and semantic retrieval, reaching [X%] recall"
    assert coach.new_facts(ok, CV, orig) == {"numbers": [], "terms": []}
    bad = "Built a RAG-based resume screening system on Kubernetes serving 40000 users with 95% accuracy"
    f = coach.new_facts(bad, CV, orig)
    assert "40000" in f["numbers"] and "95" in f["numbers"] and "Kubernetes" in f["terms"]
    assert coach.new_facts("Deployed the FastAPI service on AWS Lambda, handling 81% confidence", CV)["numbers"] == []


def test_verify_edit_rules():
    good = coach.verify_edit({"original": "Deployed the FastAPI service on AWS Lambda",
                              "suggested": "Shipped the FastAPI service on AWS Lambda"}, CV)
    assert good["ok"] and not good["needs_ack"]
    fab = coach.verify_edit({"original": "Deployed the FastAPI service on AWS Lambda",
                             "suggested": "Deployed the FastAPI service on AWS Lambda and Terraform for 3 regions"}, CV)
    assert fab["ok"] and fab["needs_ack"] and "Terraform" in fab["new_terms"] and "3" in fab["new_numbers"]
    assert not coach.verify_edit({"original": "Invented line that is not in the CV at all", "suggested": "x y z"}, CV)["ok"]
    assert not coach.verify_edit({"original": "Deployed the FastAPI service on AWS Lambda", "suggested": ""}, CV)["ok"]


def test_apply_edits_replaces_in_place_and_gates_new_facts():
    e1 = coach.verify_edit({"original": "Deployed the FastAPI service on AWS Lambda", "suggested": "Shipped the FastAPI service to AWS Lambda"}, CV)
    e2 = coach.verify_edit({"original": "FinFusion: LSTM forecasting and OCR pipeline, with 81% extraction confidence",
                            "suggested": "FinFusion: LSTM forecasting and OCR pipeline on Spark, with 81% extraction confidence"}, CV)
    out, applied, skipped = coach.apply_edits(CV, [e1, e2], acknowledged=set())
    assert applied == [0] and "Shipped the FastAPI service to AWS Lambda" in out and "on Spark" not in out
    assert skipped[0]["index"] == 1 and "confirm" in skipped[0]["reason"]
    out2, applied2, _ = coach.apply_edits(CV, [e1, e2], acknowledged={1})
    assert applied2 == [0, 1] and "on Spark" in out2
    assert out2.startswith("EXPERIENCE") and out2.endswith("Python, FastAPI, AWS, Docker"), "rest of the CV is untouched"


def test_overlapping_edits_apply_only_one():
    a = coach.verify_edit({"original": "Built a RAG-based resume screening system in Python using embeddings and semantic retrieval",
                           "suggested": "Created a RAG resume screener in Python"}, CV)
    b = coach.verify_edit({"original": "RAG-based resume screening system in Python using embeddings",
                           "suggested": "RAG screener built in Python with embeddings"}, CV)
    _, applied, skipped = coach.apply_edits(CV, [a, b], set())
    assert len(applied) == 1 and skipped[0]["reason"] == "overlaps another edit"


def test_history_block_keeps_recent_turns():
    msgs = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"} for i in range(10)]
    block = coach.history_block(msgs)
    assert "m9" in block and "m3" not in block and block.startswith("User:") or block.startswith("Coach:")


def test_title_case_phrases_and_trailing_punctuation_are_not_flagged():
    orig = "Document question answering with RAG: sentence embeddings plus cosine retrieval served through FastAPI"
    cv = orig + "\nrecall@5 on 200 hand-labelled questions"
    sug = "Built a document question answering system using Retrieval\u2011Augmented Generation (RAG) with sentence embeddings, reaching [X%] recall@5 and strong performance."
    assert coach.new_facts(sug, cv, orig) == {"numbers": [], "terms": []}


def test_job_description_and_message_terms_missing_from_cv_are_flagged():
    cv = "Built a classifier in Python"
    f = coach.new_facts("Built a classifier in Python and tracked runs with MLflow", cv, "", context="Good to have: MLflow, Docker")
    assert "MLflow" in f["terms"]
    f2 = coach.new_facts("Built a classifier in Python on Kubernetes", cv, "", context="")
    assert "Kubernetes" in f2["terms"], "isolated capitalised tool names are flagged even without context"
