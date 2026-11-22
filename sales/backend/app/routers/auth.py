
import os
import hmac

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.core.security import hash_password, verify_password
from app.dependencies.auth import (
    SESSION_COOKIE,
    encode_auth_token,
    get_current_user,
)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

COOKIE_SECURE = (
    os.getenv("COOKIE_SECURE", "false").lower() == "true"
)


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    username: str | None = None
    email: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


def user_response(user: User):
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "role_id": user.role_id,
        "role": "Admin" if user.role_id == 1 else "Staff",
        "dept_id": user.dept_id,
    }


@router.post("/login")
def login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    identifier = data.email.strip()

    user = db.scalar(
        select(User).where(
            or_(
                User.email == identifier,
                User.username == identifier,
            )
        )
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
        )

    stored_password = user.password

    if stored_password.startswith("$argon2"):
        try:
            password_valid = verify_password(
                data.password,
                stored_password,
            )
        except Exception:
            password_valid = False
    else:
        password_valid = hmac.compare_digest(
            data.password,
            stored_password,
        )

        if password_valid:
            user.password = hash_password(data.password)
            db.commit()
            db.refresh(user)

    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
        )

    token = encode_auth_token(user.user_id)

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=28800,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    return user_response(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )

    return {
        "message": "Successfully logged out."
    }


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    return user_response(current_user)


@router.patch("/me")
def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.username is None and data.email is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile changes were provided.",
        )

    if data.username is not None:
        username = data.username.strip()

        if not username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username cannot be empty.",
            )

        existing_username = db.scalar(
            select(User).where(
                func.lower(User.username) == username.lower(),
                User.user_id != current_user.user_id,
            )
        )

        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That username is already in use.",
            )

        current_user.username = username

    if data.email is not None:
        email = data.email.strip().lower()

        if not email or "@" not in email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid email address.",
            )

        existing_email = db.scalar(
            select(User).where(
                func.lower(User.email) == email,
                User.user_id != current_user.user_id,
            )
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That email address is already in use.",
            )

        current_user.email = email

    db.commit()
    db.refresh(current_user)

    return user_response(current_user)


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not data.current_password or not data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please complete all password fields.",
        )

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long.",
        )

    stored_password = current_user.password

    if stored_password.startswith("$argon2"):
        try:
            password_valid = verify_password(
                data.current_password,
                stored_password,
            )
        except Exception:
            password_valid = False
    else:
        password_valid = hmac.compare_digest(
            data.current_password,
            stored_password,
        )

    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your current password is incorrect.",
        )

    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your new password must be different from your current password.",
        )

    current_user.password = hash_password(data.new_password)

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Your password has been changed successfully."
    }
