
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "Users"

    user_id: Mapped[str] = mapped_column(
        "UserID",
        String,
        primary_key=True,
    )

    username: Mapped[str] = mapped_column(
        "Username",
        String(255),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        "email",
        String(255),
        nullable=False,
    )

    password: Mapped[str] = mapped_column(
        "password",
        String(255),
        nullable=False,
    )

    role_id: Mapped[int] = mapped_column(
        "RoleID",
        Integer,
        nullable=False,
    )

    dept_id: Mapped[str | None] = mapped_column(
        "DeptID",
        String,
        nullable=True,
    )
