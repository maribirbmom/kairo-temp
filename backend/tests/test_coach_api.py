"""End-to-end coach API flow with a fake model: chat -> verified edits -> apply -> undo, plus two-user isolation."""
import asyncio
import os
import sys
from pathlib import Path

import pytest

os.environ.pop("MONGO_URL", None)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
pytest.importorskip("fastapi")
pytest.importorskip("spacy")
from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402
import scoring  # noqa: E402

CV = ("EXPERIENCE\nAI/ML Intern, Jan 2025 - Jun 2025\n- Built a RAG-based resume screening system in Python using embeddings\n"
      "- Deployed the FastAPI service on AWS Lambda\nSKILLS\nPython, FastAPI, AWS")
LINE1 = "Deployed the FastAPI service on AWS Lambda"
LINE2 = "Built a RAG-based resume screening system in Python using embeddings"


def login(sub):
    return {"Authorization": "Bearer " + asyncio.run(server._login({"sub": sub, "email": f"{sub}@x.com", "name": sub}))["token"]}, sub


@pytest.fixture()
def env(monkeypatch):
    server.db = server.InMemoryDatabase()
    h1, _ = login("alice")
    h2, _ = login("bob")
    users = asyncio.run(server.db.users.find({}, {"_id": 0}).to_list(10))
    alice = next(u for u in users if "alice" in str(u))
    asyncio.run(server.db.sessions.insert_one({"id": "s1", "user_id": alice["id"], "job_description": "Associate ML Engineer. " * 20, "job_title": "ML"}))
    asyncio.run(server.db.resumes.insert_one({"id": "r1", "user_id": alice["id"], "session_id": "s1", "extracted_text": CV, "screening": {}}))
    calls = {"prompts": []}

    async def fake_json(client, system, user, required=(), usage=None):
        calls["prompts"].append(user)
        return calls["reply"]

    calls["reply"] = {"reply": "Here is a rewrite.", "edits": [
        {"original": LINE1, "suggested": "Shipped the FastAPI service to AWS Lambda", "reason": "stronger verb"},
        {"original": LINE2, "suggested": "Built a RAG resume screener in Python on Kubernetes using embeddings", "reason": "x"},
        {"original": "A line that is not in the CV whatsoever", "suggested": "invented"}]}
    monkeypatch.setattr(scoring, "_client", lambda: object())
    monkeypatch.setattr(scoring, "_generate_json", fake_json)
    return TestClient(server.app), h1, h2, calls


def chat(c, h, msg="improve my bullets"):
    return c.post("/api/coach/chat", json={"session_id": "s1", "resume_id": "r1", "message": msg}, headers=h)


def test_chat_verifies_edits_and_drops_unfound_ones(env):
    c, h1, _, _ = env
    r = chat(c, h1)
    assert r.status_code == 200
    body = r.json()
    assert len(body["edits"]) == 2 and any("dropped" in w for w in body["warnings"])
    by = {e["original"]: e for e in body["edits"]}
    assert not by[LINE1]["needs_ack"] and by[LINE2]["needs_ack"] and "Kubernetes" in by[LINE2]["new_terms"]


def test_apply_requires_ack_for_new_facts_and_undo_restores(env):
    c, h1, _, _ = env
    body = chat(c, h1).json()
    mid = body["message_id"]
    e1 = next(e for e in body["edits"] if e["original"] == LINE1)
    e2 = next(e for e in body["edits"] if e["original"] == LINE2)
    r = c.post("/api/coach/apply", json={"resume_id": "r1", "message_id": mid, "edit_ids": [e1["id"], e2["id"]]}, headers=h1).json()
    assert r["applied"] == [e1["id"]] and r["skipped"][0]["id"] == e2["id"]
    assert "Shipped the FastAPI service to AWS Lambda" in r["text"] and "Kubernetes" not in r["text"]
    again = c.post("/api/coach/apply", json={"resume_id": "r1", "message_id": mid, "edit_ids": [e1["id"]]}, headers=h1)
    assert again.status_code == 400, "an edit cannot be applied twice"
    ok = c.post("/api/coach/apply", json={"resume_id": "r1", "message_id": mid, "edit_ids": [e2["id"]], "acknowledge": [e2["id"]]}, headers=h1).json()
    assert "Kubernetes" in ok["text"]
    undone = c.post("/api/coach/undo", json={"resume_id": "r1"}, headers=h1).json()
    assert "Kubernetes" not in undone["text"] and "Shipped" in undone["text"]
    undone2 = c.post("/api/coach/undo", json={"resume_id": "r1"}, headers=h1).json()
    assert undone2["text"] == CV and undone2["edited"] is False


def test_conversation_memory_and_edited_cv_reach_the_model(env):
    c, h1, _, calls = env
    first = chat(c, h1, "make the lambda bullet stronger").json()
    e1 = next(e for e in first["edits"] if e["original"] == LINE1)
    c.post("/api/coach/apply", json={"resume_id": "r1", "message_id": first["message_id"], "edit_ids": [e1["id"]]}, headers=h1)
    chat(c, h1, "now make that shorter")
    last = calls["prompts"][-1]
    assert "make the lambda bullet stronger" in last, "history is sent back to the model"
    assert "Shipped the FastAPI service to AWS Lambda" in last, "the coach sees the edited CV"


def test_other_users_cannot_read_or_change_a_cv(env):
    c, h1, h2, _ = env
    mid = chat(c, h1).json()["message_id"]
    assert chat(c, h2).status_code == 404
    assert c.post("/api/coach/apply", json={"resume_id": "r1", "message_id": mid, "edit_ids": ["x"]}, headers=h2).status_code == 404
    assert c.post("/api/coach/undo", json={"resume_id": "r1"}, headers=h2).status_code == 404


def test_model_failure_is_an_honest_error_not_a_fake_answer(env, monkeypatch):
    c, h1, _, _ = env

    async def boom(*a, **k):
        raise ValueError("rate limited")

    monkeypatch.setattr(scoring, "_generate_json", boom)
    r = chat(c, h1)
    assert r.status_code == 503 and "unavailable" in r.json()["detail"]
