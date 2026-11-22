
from app.database import Base, engine
from app.models.user import User
from app.models.auth_session import AuthSession

Base.metadata.create_all(
    bind=engine,
    tables=[
        User.__table__,
        AuthSession.__table__,
    ],
)

print("Authentication tables created successfully.")
