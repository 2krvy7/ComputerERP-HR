import os

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

# This MUST be the same JWT_SECRET used by the login/user service.
SECRET = os.environ["JWT_SECRET"]

# HR department
DEPT = "HR"

bearer = HTTPBearer(auto_error=False)


# =========================
# GET CURRENT USER
# =========================

def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> dict:
    if creds is None:
        raise HTTPException(
            status_code=401,
            detail="Please log in"
        )

    try:
        return jwt.decode(
            creds.credentials,
            SECRET,
            algorithms=["HS256"]
        )

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Session expired, please log in again"
        )


# =========================
# REQUIRE HR ACCESS
# =========================

def require_hr(user: dict = Depends(current_user)) -> dict:
    # User must change password first
    if user.get("must_change_password"):
        raise HTTPException(
            status_code=403,
            detail="Change your password first"
        )

    # SuperAdmin can access HR
    if user.get("role") == "SuperAdmin":
        return user

    # HR department can access HR
    if user.get("department") != DEPT:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to HR"
        )

    return user


# =========================
# REQUIRE HR ADMIN
# =========================

def require_admin(user: dict = Depends(require_hr)) -> dict:
    if user.get("role") not in ("Admin", "SuperAdmin"):
        raise HTTPException(
            status_code=403,
            detail="Admins only"
        )

    return user