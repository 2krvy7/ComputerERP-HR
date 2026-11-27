import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import employees, positions, attendance, leave, payroll, recruitment, applicants

app = FastAPI(title="HRIS & Payroll API")

# =========================
# CORS
# =========================

origins = [
    o.strip().rstrip("/")
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://computer-erp-[a-z0-9-]+\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTERS
# =========================

app.include_router(employees.router)
app.include_router(positions.router)
app.include_router(attendance.router)
app.include_router(leave.router)
app.include_router(payroll.router)
app.include_router(recruitment.router)
app.include_router(applicants.router)


@app.get("/")
def root():
    return {
        "message": "HR backend is running"
    }