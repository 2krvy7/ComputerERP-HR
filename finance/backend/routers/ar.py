from fastapi import APIRouter
from database import get_db_connection

router = APIRouter(
    prefix="/api/ar",
    tags=["Accounts Receivable"]
)

@router.get("/")
def get_ar_invoices():

    conn = get_db_connection()

    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT *
            FROM "ARInvoice"
            ORDER BY "dueDate"
        """)

        rows = cur.fetchall()

        return rows

    finally:
        cur.close()
        conn.close()