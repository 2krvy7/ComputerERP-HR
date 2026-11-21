import os

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

SECRET = os.environ["JWT_SECRET"]  # must be the SAME value as the user service's JWT_SECRET
DEPT = "PR"
bearer = HTTPBearer(auto_error=False)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if creds is None:
        raise HTTPException(401, "Please log in")
    try:
        return jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, please log in again")


def require_procurement(user: dict = Depends(current_user)) -> dict:
    if user.get("must_change_password"):
        raise HTTPException(403, "Change your password first")
    if user.get("role") != "SuperAdmin" and user.get("department") != DEPT:
        raise HTTPException(403, "You don't have access to Procurement")
    return user


def require_admin(user: dict = Depends(require_procurement)) -> dict:
    if user.get("role") not in ("Admin", "SuperAdmin"):
        raise HTTPException(403, "Admins only")
    return user