import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

SECRET = os.environ["JWT_SECRET"]
ALGORITHM = "HS256"
EXPIRE_HOURS = 8
ROLE_SUPERADMIN = 1

bearer = HTTPBearer(auto_error=False)  # also gives you an "Authorize" button in /docs


def create_token(user: dict) -> str:
    payload = {
        "sub": user["UserID"],
        "username": user["Username"],
        "role_id": user["RoleID"],
        "role": user["RoleName"],
        "department": user["DeptID"],  # the code, e.g. "PR"
        "must_change_password": user["must_change_password"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if creds is None:
        raise HTTPException(401, "Please log in")
    try:
        return jwt.decode(creds.credentials, SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, please log in again")


def require_superadmin(user: dict = Depends(current_user)) -> dict:
    if user.get("must_change_password"):
        raise HTTPException(403, "Change your password first")
    if user.get("role_id") != ROLE_SUPERADMIN:
        raise HTTPException(403, "Superadmins only")
    return user