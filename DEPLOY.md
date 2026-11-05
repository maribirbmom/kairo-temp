# Deploying Kairo (free tier)

Three free pieces: **MongoDB Atlas** (database), **Hugging Face Spaces**
(backend), **Vercel** (frontend). Secrets go in each host's settings page,
never in the repository.

## 1. Database: MongoDB Atlas
1. Create a free **M0** cluster and a database user with a strong password.
2. Network Access: allow `0.0.0.0/0` (free hosts have no fixed IP, so the password is the barrier).
3. Connect -> Drivers -> Python: copy the `mongodb+srv://...` string and fill in the user/password
   (URL-encode special characters). This becomes `MONGO_URL`.

## 2. Backend: Hugging Face Spaces (Docker)
1. Create a Space: SDK **Docker**, hardware **CPU basic (free)**. Visibility **Public** is fine; it only holds code.
2. Space -> Settings -> **Variables and secrets**. Add as *secrets*:

| Name | Value |
|---|---|
| `MONGO_URL` | your Atlas connection string |
| `DB_NAME` | `kairo` |
| `GROQ_API_KEY` | from console.groq.com/keys |
| `GOOGLE_CLIENT_ID` | OAuth Web client ID |
| `SESSION_SECRET` | long random string: `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://kairo.vercel.app` (no trailing slash) |

   Do **not** set `DEV_AUTH` (it is ignored with a real database anyway).
3. Push the `backend/` folder as the Space's root:
   `git subtree push --prefix backend https://huggingface.co/spaces/<user>/<space> main`
4. Wait for the build (the embedding model is downloaded during the build). Check
   `https://<user>-<space>.hf.space/api/` returns `{"message": "Kairo Resume Screener API"}`.

Free Spaces sleep after a period of inactivity; the first request afterwards is slow.

## 3. Frontend: Vercel
1. Import the GitHub repo. **Root Directory: `frontend`**. Framework: Create React App.
2. Environment variable: `REACT_APP_BACKEND_URL` = `https://<user>-<space>.hf.space` (no trailing slash).
3. Deploy. `vercel.json` makes deep links like `/history` work on refresh.

## 4. Google sign-in
In Google Cloud Console -> Google Auth Platform -> Clients -> your web client:
add the Vercel URL under **Authorized JavaScript origins**. Under **Audience**, click
**Publish app** so anyone (not only test users) can sign in.

## 5. Final checks
- `CORS_ORIGINS` is your exact frontend URL (not `*`).
- Sign in with a second Google account and confirm you cannot see the first account's data.
- Rotate any password that was ever pasted into chat or a ticket.
