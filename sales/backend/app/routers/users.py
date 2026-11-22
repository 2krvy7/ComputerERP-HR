
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserStatusUpdate, UserResponse
from app.core.security import hash_password
from app.dependencies.auth import require_admin

router = APIRouter(
    prefix="/api/users",
    tags=["User Management"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db)):
    statement = (
        select(User)
        .where(User.role == "Staff")
        .order_by(User.user_id.desc())
    )

    return db.scalars(statement).all()


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
):
    email = str(data.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    user = User(
        full_name=data.full_name,
        email=email,
        password_hash=hash_password(data.password),
        role="Staff",
        status=True,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if user is None or user.role != "Staff":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff account not found.",
        )

    updates = data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide information to update.",
        )

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if user is None or user.role != "Staff":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff account not found.",
        )

    user.status = data.status

    db.commit()
    db.refresh(user)

    return user
