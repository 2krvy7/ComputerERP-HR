import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.coa import router as coa_router
from routers.journal import router as journal_router
from routers.ledger import router as ledger_router
from routers.apinvoices import router as apinvoices_router
from routers.payments import router as payments_router
from routers.arinvoices import router as arinvoices_router
from routers.collections import router as collections_router
from routers.bank import router as bank_router
from routers.transactions import router as transactions_router
from routers.expense import router as expense_router
from routers.reports import router as reports_router
from routers.dashboard import router as dashboard_router

app = FastAPI(title="Finance ERP API")

# Extra origins can still be added in the Vercel env var CORS_ORIGINS (comma separated, no trailing slash)
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # any of our deployed ERP sites, e.g. https://computer-erp-procurement.vercel.app
    allow_origin_regex=r"https://computer-erp-[a-z0-9-]+\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(coa_router)
app.include_router(journal_router)
app.include_router(ledger_router)
app.include_router(apinvoices_router)
app.include_router(payments_router)
app.include_router(arinvoices_router)
app.include_router(collections_router)
app.include_router(bank_router)
app.include_router(transactions_router)
app.include_router(expense_router)
app.include_router(reports_router)
app.include_router(dashboard_router)

@app.get("/")
def home():
    return {
        "message": "Finance ERP API Running"
    }








from fastapi import Query
from psycopg.rows import dict_row
from database import get_db_connection

@app.get("/api/me")
def get_current_user_profile(
    user_id: str | None = Query(default=None),
    username: str | None = Query(default=None),
):
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            if user_id:
                cur.execute(
                    'SELECT "UserID", "Username", email, "RoleID", "DeptID" FROM public."User" WHERE "UserID" = %s LIMIT 1',
                    (user_id,),
                )
            elif username:
                cur.execute(
                    'SELECT "UserID", "Username", email, "RoleID", "DeptID" FROM public."User" WHERE "Username" = %s LIMIT 1',
                    (username,),
                )
            else:
                cur.execute(
                    'SELECT "UserID", "Username", email, "RoleID", "DeptID" FROM public."User" WHERE "DeptID" = \'FN\' ORDER BY "UserID" ASC LIMIT 1'
                )

            row = cur.fetchone()
            if not row:
                return {"UserID": "FN001", "Username": "Finance User", "RoleID": 2, "DeptID": "FN"}

            role_map = {1: "SuperAdmin", 2: "Finance Staff", 3: "Administrator"}
            return {
                "UserID": row["UserID"],
                "Username": row["Username"],
                "email": row.get("email"),
                "RoleID": row.get("RoleID"),
                "roleName": role_map.get(row.get("RoleID"), "Finance Staff"),
                "DeptID": row.get("DeptID") or "FN",
            }
    finally:
        conn.close()
