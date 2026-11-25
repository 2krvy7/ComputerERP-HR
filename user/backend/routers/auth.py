import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db_connection
from security import create_token, current_user

router = APIRouter(prefix="/auth", tags=["auth"])

USER_SQL = """
    SELECT u."UserID", u."Username", u.email, u.password, u."RoleID", r."RoleName",
           u."DeptID", u.must_change_password
    FROM public."User" u
    JOIN public."Roles" r ON r."RoleID" = u."RoleID"
"""


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


def password_ok(plain: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), stored.encode())
    except ValueError:  # old test accounts with a plain-text password aren't valid hashes
        return False


@router.post("/login")
def login(body: LoginIn):
    with get_db_connection() as conn:
        user = conn.execute(
            USER_SQL + ' WHERE LOWER(u."Username") = LOWER(%s)', (body.username.strip(),)
        ).fetchone()
    if not user or not password_ok(body.password, user["password"]):
        raise HTTPException(401, "Wrong username or password")  # same message for both cases
    return {
        "token": create_token(user),
        "must_change_password": user["must_change_password"],
        "user": {
            "UserID": user["UserID"],
            "Username": user["Username"],
            "role": user["RoleName"],
            "department": user["DeptID"],
        },
    }


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return user


@router.post("/change-password")
def change_password(body: ChangePasswordIn, me: dict = Depends(current_user)):
    if len(body.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    if body.new_password == body.old_password:
        raise HTTPException(400, "New password must be different from the old one")

    with get_db_connection() as conn:
        user = conn.execute(USER_SQL + ' WHERE u."UserID" = %s', (me["sub"],)).fetchone()
        if not user or not password_ok(body.old_password, user["password"]):
            raise HTTPException(401, "Current password is wrong")
        hashed = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
        conn.execute(
            'UPDATE public."User" SET password = %s, must_change_password = false WHERE "UserID" = %s',
            (hashed, me["sub"]),
        )
    user["must_change_password"] = False
    return {"message": "Password changed", "token": create_token(user)}  # fresh token without the flag