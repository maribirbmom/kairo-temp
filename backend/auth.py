"""Google sign-in + Kairo session tokens.

Flow: browser gets a Google ID token (Google Identity Services) -> POST
/api/auth/google -> we verify it against GOOGLE_CLIENT_ID -> we issue our own
short-lived signed session token (JWT). Google tokens are never stored.
"""
import logging
import os
import secrets
import time
from typing import Any, Dict, Optional

import jwt
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
DEV_AUTH = os.environ.get("DEV_AUTH", "").lower() in ("1", "true", "yes")
TOKEN_TTL_SECONDS = int(os.environ.get("SESSION_TTL_HOURS", "168")) * 3600  # 7 days

_secret = os.environ.get("SESSION_SECRET", "").strip()
if not _secret:
    # Safe default: random per process. Tokens stop working on restart; set
    # SESSION_SECRET in production so sessions survive restarts.
    _secret = secrets.token_urlsafe(48)
    logger.warning("SESSION_SECRET not set - using a random one (sessions reset on restart)")
SESSION_SECRET = _secret


def verify_google_credential(credential: str) -> Dict[str, Any]:
    """Validate a Google ID token. Raises ValueError if invalid."""
    if not GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured")
    info = google_id_token.verify_oauth2_token(credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Bad token issuer")
    if not info.get("email_verified"):
        raise ValueError("Google email is not verified")
    return info


def make_token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + TOKEN_TTL_SECONDS}, SESSION_SECRET, algorithm="HS256")


def read_token(token: str) -> Optional[str]:
    try:
        return jwt.decode(token, SESSION_SECRET, algorithms=["HS256"]).get("sub")
    except jwt.PyJWTError:
        return None
