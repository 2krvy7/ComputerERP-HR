import os

import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import require_procurement
from routers import suppliers, quotations, purchase_requests, orders, invoices, dashboard

load_dotenv()

app = FastAPI()

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(psycopg.OperationalError)
async def db_unavailable(request, exc):
    return JSONResponse(status_code=503, content={"detail": "Database unavailable, try again"})


# Every router is registered once, and only logged-in Procurement users (or SuperAdmin) get in
for module in (suppliers, purchase_requests, quotations, orders, invoices, dashboard):
    app.include_router(module.router, dependencies=[Depends(require_procurement)])


@app.get("/")
def home():
    return {"status": "Online"}