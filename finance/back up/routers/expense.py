from fastapi import APIRouter
from database import get_db_connection

router = APIRouter(
    prefix="/api/expense",
    tags=["Expense"]
)

@router.get("/")
def get_expenses():

    conn = get_db_connection()

    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT *
            FROM "Expense"
        """)

        rows = cur.fetchall()

        return rows

    finally:
        cur.close()
        conn.close()