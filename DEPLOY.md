# Deploying Kairo (free tier)

Everything runs on free plans: **MongoDB Atlas** (database) and **Vercel**
(frontend and API as two projects). Secrets go in each host's settings,
never in the repository.

Why not Hugging Face Spaces? Docker Spaces now require a paid plan. The API is slim enough
for Vercel's Python functions (about 270 MB installed, under their 500 MB limit).

## 1. Database: MongoDB Atlas
1. Create a free **M0** cluster and a database user with a strong password.
2. Network Access: allow `0.0.0.0/0` (serverless hosts have no fixed IP, so the password is the barrier).
3. Connect -> Drivers -> Python: copy the `mongodb+srv://...` string and fill in user/password
   (URL-encode special characters). This becomes `MONGO_URL`.

## 2. API: Vercel project "kairo-api"
- Import the GitHub repo, **Root Directory: `backend`**. Vercel detects the FastAPI `app` in `server.py`.
- Environment variables:

| Name | Value |
|---|---|
| `MONGO_URL` | your Atlas connection string |
| `DB_NAME` | `kairo` |
| `GROQ_API_KEY` | from console.groq.com/keys |
| `GOOGLE_CLIENT_ID` | OAuth Web client ID |
| `SESSION_SECRET` | long random string: `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | the frontend URL, e.g. `https://kairo-web.vercel.app` (no trailing slash) |

- Do **not** set `DEV_AUTH` (it is ignored with a real database anyway).
- Check `https://<api-domain>/api/` returns `{"message": "Kairo Resume Screener API"}`.
- Limits to know: request bodies over about 4.5 MB are rejected by Vercel, so uploads are capped at 4 MB.
  The embedding model (67 MB) downloads on the first request after a cold start, so that request is slower.

## 3. Frontend: Vercel project "kairo-web"
- Same repo, **Root Directory: `frontend`**, framework Create React App.
- Environment variable: `REACT_APP_BACKEND_URL` = the API URL (no trailing slash).
- `vercel.json` makes deep links like `/history` work on refresh.

## 4. Google sign-in
Google Cloud Console -> Google Auth Platform -> Clients -> your web client: add the frontend URL under
**Authorized JavaScript origins**. Under **Audience**, click **Publish app** so anyone (not only test
users) can sign in.

## 5. Final checks
- `CORS_ORIGINS` is the exact frontend URL (not `*`).
- Sign in with a second Google account and confirm you cannot see the first account's data.
- Rotate any password that was ever pasted into chat or a ticket.

Deploy note: `backend/vercel.json` raises the function limit to 60 s (scoring makes 2-4 model calls; confirm your plan allows it) and excludes tests/evals from the bundle. `fastembed` is not installed by default because the default evidence mode (`full`) does not use embeddings; install it only for `KAIRO_EVIDENCE_MODE=rag`.
