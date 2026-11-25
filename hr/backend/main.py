import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import employees, positions, attendance, leave, payroll, recruitment, applicants

app = FastAPI(title="HRIS & Payroll API")

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
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