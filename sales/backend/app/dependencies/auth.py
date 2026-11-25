
import os
import json
import hmac
import hashlib
import base64
import time

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.roles import ADMIN_ROLE_IDS
from app.models.user import User


SESSION_COOKIE = "sales_erp_session"


def get_secret_key():
    secret = os.getenv("AUTH_SECRET_KEY")

    if not secret:
        raise RuntimeError(
            "AUTH_SECRET_KEY is missing from backend/.env"
        )

    return secret.encode("utf-8")


def encode_auth_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "expires": int(time.time()) + 28800,
    }

    encoded = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode().rstrip("=")

    signature = hmac.new(
        get_secret_key(),
        encoded.encode(),
        hashlib.sha256,
    ).digest()

    signed = base64.urlsafe_b64encode(
        signature
    ).decode().rstrip("=")

    return f"{encoded}.{signed}"


def decode_auth_token(token: str):
    try:
        encoded, supplied_signature = token.split(".")

        expected_signature = base64.urlsafe_b64encode(
            hmac.new(
                get_secret_key(),
                encoded.encode(),
                hashlib.sha256,
            ).digest()
        ).decode().rstrip("=")

        if not hmac.compare_digest(
            supplied_signature,
            expected_signature,
        ):
            return None

        padded = encoded + "=" * (-len(encoded) % 4)

        payload = json.loads(
            base64.urlsafe_b64decode(padded)
        )

        if payload["expires"] < int(time.time()):
            return None

        return payload

    except Exception:
        return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:

    token = request.cookies.get(SESSION_COOKIE)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in.",
        )

    payload = decode_auth_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please log in again.",
        )

    user = db.get(User, payload["user_id"])

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found.",
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:

    if current_user.role_id not in ADMIN_ROLE_IDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )

    return current_user


def require_password_change_completed(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Change your temporary password before continuing.",
        )

    return current_user
