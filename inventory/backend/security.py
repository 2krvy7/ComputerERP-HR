
import os
import jwt

from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

SECRET = os.environ["JWT_SECRET"]
ALGORITHM = "HS256"

INVENTORY_DEPARTMENT = "IN"
ALLOWED_ROLES = {"Admin", "Staff"}

bearer = HTTPBearer(auto_error=False)


# ==========================================
# VERIFY JWT TOKEN
# ==========================================

def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> dict:

    if creds is None:
        raise HTTPException(
            status_code=401,
            detail="Please log in."
        )

    try:
        payload = jwt.decode(
            creds.credentials,
            SECRET,
            algorithms=[ALGORITHM]
        )

        if not isinstance(payload.get("sub"), str):
            raise HTTPException(
                status_code=401,
                detail="Invalid user identification."
            )

        if payload.get("must_change_password") is True:
            raise HTTPException(
                status_code=403,
                detail="Please change your password first."
            )

        return payload

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid. Please log in again."
        )


# ==========================================
# INVENTORY ACCESS: ADMIN AND STAFF
# ==========================================

def require_inventory_user(
    user: dict = Depends(current_user)
) -> dict:

    department = user.get("department")
    role = user.get("role")

    if department != INVENTORY_DEPARTMENT:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to the Inventory department."
        )

    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to access Inventory."
        )

    return user


# ==========================================
# INVENTORY ADMIN ACCESS ONLY
# ==========================================

def require_inventory_admin(
    user: dict = Depends(require_inventory_user)
) -> dict:

    if user.get("role") != "Admin":
        raise HTTPException(
            status_code=403,
            detail="Admin permission required."
        )

    return user
