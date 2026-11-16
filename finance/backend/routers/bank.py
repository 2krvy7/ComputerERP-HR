from fastapi import APIRouter
from database import get_db_connection

router = APIRouter(
    prefix="/api/bank",
    tags=["Bank"]
)

@router.get("/")
def get_bank_accounts():

    conn = get_db_connection()

    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT *
            FROM "BankAccount"
        """)

        rows = cur.fetchall()

        return rows

    finally:
        cur.close()
        conn.close()