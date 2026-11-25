
from getpass import getpass

from sqlalchemy import select

from app.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password


def main():
    db = SessionLocal()

    try:
        existing_admin = db.scalar(
            select(User).where(User.role == "Admin")
        )

        if existing_admin:
            print("An Admin account already exists.")
            return

        full_name = input("Admin full name: ").strip()
        email = input("Admin email: ").strip().lower()
        password = getpass("Admin password: ")
        confirm_password = getpass("Confirm password: ")

        if not full_name or not email:
            print("Name and email are required.")
            return

        if len(password) < 12:
            print("Password must contain at least 12 characters.")
            return

        if password != confirm_password:
            print("Passwords do not match.")
            return

        existing_user = db.scalar(
            select(User).where(User.email == email)
        )

        if existing_user:
            print("This email is already registered.")
            return

        admin = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role="Admin",
            status=True,
        )

        db.add(admin)
        db.commit()

        print("First Admin account created successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
