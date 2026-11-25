from fastapi import APIRouter
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/ledger",
    tags=["General Ledger"]
)

@router.get("/")
def get_ledger():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            # Ordered ascending by date/ID so running balance calculates chronologically
            cur.execute("""
                SELECT *
                FROM "GeneralLedger"
                ORDER BY 1 ASC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.get("/accounts")
def get_ledger_accounts():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT *
                FROM "ChartOfAccounts"
                ORDER BY "accountCode" ASC
            """)
            return cur.fetchall()
    finally:
        conn.close()