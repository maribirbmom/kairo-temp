# Kairo: resume screener and CV coach

Kairo scores your resume against a job description on a **1-5 scale**, tells you
whether the role is **worth applying to (4.0+)**, and shows **exactly where you
are lacking** with truthful, concrete fixes. Sign in with Google to keep your
history of past job-to-resume comparisons.

It is a **candidate-side** tool: it helps you improve your own resume. It does
not rank applicants for employers.

## How it works

```
resume (PDF/DOCX)
   -> local PII redaction (name, contact, links, address, IDs, age/gender lines)
   -> chunk resume
JD -> LLM extracts requirements (must / nice-to-have)
   -> local embeddings (fastembed, bge-small) retrieve the best resume evidence per requirement
   -> LLM judges each requirement from that evidence only (met / partial / missing + fix)
   -> deterministic guardrails cap the score (missing must-haves, red flags, low confidence)
   -> score 1-5, apply / don't-apply verdict, gap list
```

- **RAG grounding:** the model only sees retrieved resume evidence per requirement, so gaps are specific and verifiable.
- **Never fabricates:** the CV Coach may reword or surface experience already on the resume. For real gaps it recommends building real experience.
- **Zero-cost stack:** Groq free tier (LLM), local `fastembed` embeddings, MongoDB Atlas free tier, Vercel (frontend + API).

## Credit

The 1-5 scoring scale, the 4.0 "apply" threshold, evidence-confidence tiers and
the "never fabricate" principle are adapted from
[career-ops](https://github.com/career-ops-hq/career-ops) (MIT licence). Kairo
is an independent project inspired by its scoring logic; it is not affiliated
with or endorsed by career-ops.

## Privacy and security

- Personal details are removed **on the server at upload**; only redacted text is stored or sent to the LLM. Redaction is best-effort (pattern rules), so check your file.
- Redacted text is sent to a third-party LLM provider (Groq). Free tiers may retain inputs, so don't upload anything you wouldn't share.
- Google sign-in (ID token verified server-side); every route is owner-checked; users can delete their account and all data.
- Per-user daily limits and upload size caps protect the free quota.

## Run locally

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in GROQ_API_KEY; DEV_AUTH=true allows a local dev login
uvicorn server:app --port 8001

# frontend (new terminal)
cd frontend
cp .env.example .env
npm install   # or pnpm install
npm start
```

## Configuration

See `backend/.env.example`. Required for production: `MONGO_URL`, `GROQ_API_KEY`,
`GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `CORS_ORIGINS` (your frontend URL).
Never set `DEV_AUTH` in production.

## Limitations

- Scores are an AI-assisted estimate, not a prediction of hiring outcomes.
- The score can vary slightly between runs.
- Redaction can miss unusual formats or non-English resumes.

## Evaluation and known limits

Kairo's scoring follows the career-ops method (two-pass JD-first reading, importance bands, evidence tiers, a single
holistic 1-5 score, Apply at 4.0 or above). Because an LLM judges the fit, the repo ships an evaluation harness
(`backend/evals/`) and 38 offline tests (`backend/tests`, no API key needed; run `cd backend && python -m pytest`).

**How trust is built**
- A "strong" match must quote the resume verbatim (checked in code, not by the model).
- Years of experience are computed from dated resume entries in code, not by the model.
- Incomplete model output is retried, never defaulted; an unavailable model is shown as a labelled keyword estimate.
- Borderline scores get extra judge runs; the median is shown with its range, and disagreement becomes "Research first".
- Personal details are redacted before anything is sent to the model, and are never scored as missing.

**Measured on six synthetic candidate/JD pairs** (`backend/evals/golden/cases`, `openai/gpt-oss-120b`, 2 repeats):
mean absolute error 0.35 points vs the reference labels, Apply/not-Apply agreement 5 of 6 cases, rank correlation 0.99.

**Limits, stated plainly**
- The reference labels were written by hand by applying the career-ops rubric (AI-assisted). They are a regression
  suite, not independent ground truth. Six cases are too few to claim general accuracy.
- Scores can run high on "preferred" requirements; one case labelled 3.9 scored 4.3.
- Compensation and culture are not scored (they need company research). Redaction is best effort and English-centred.
- Free-tier model limits (about 200K tokens/day per model on Groq) cap how many evaluations the public demo can serve.

Inspired by [career-ops](https://github.com/career-ops-hq/career-ops) (MIT). Kairo is independent and not affiliated with it.

### CV Coach: apply suggestions to your CV

The coach proposes concrete rewrites; the code, not the model, decides what is allowed:
- an edit's "original" must exist exactly once in your CV, so it can be applied precisely;
- a suggestion that adds numbers or tool/employer names your CV does not contain is flagged, and cannot be applied
  until you tick "I confirm these are true";
- applying works from stored, verified edits by id (the browser cannot send arbitrary text), is undoable, and the
  edited CV can be re-scored or downloaded as text. Contact details were redacted on upload, so you can type a header
  at download time; it stays in your browser.
- the coach remembers the recent conversation, sees your edited CV, and returns an honest error if the model is unavailable.
- model output is HTML-escaped before display.

`python -m evals.coach_eval` runs an adversarial set (fake-skill requests, a missing requirement, a posting that
tries to inject an instruction, metric invention) and reports both what the model did and what the code blocks.
