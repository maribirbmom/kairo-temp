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
