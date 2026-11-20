from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import get_db_connection

from routers import auth, users

app = FastAPI(title="User Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3010",
        "http://127.0.0.1:3010",
        "https://vercel.app",
        "https://vercel.app",
    ],
    allow_origin_regex=r"https://computer-erp-f27o.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"service": "user", "status": "ok"}


@app.get("/health")
def health():
    with get_db_connection() as conn:
        conn.execute("SELECT 1")
    return {"db": "ok"}