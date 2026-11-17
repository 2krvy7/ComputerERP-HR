from fastapi import APIRouter
from database import get_db_connection

router = APIRouter(
    prefix="/api/coa",
    tags=["Chart Of Accounts"]
)

@router.get("/")
def get_accounts():

    conn = get_db_connection()

    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT
                "accountID",
                "accountCode",
                "accountName",
                "accountType"
            FROM "ChartOfAccounts"
            ORDER BY "accountCode"
        """)

        rows = cur.fetchall()

        return [
            {
                "accountID": row[0],
                "accountCode": row[1],
                "accountName": row[2],
                "accountType": row[3]
            }
            for row in rows
        ]

    finally:
        cur.close()
        conn.close()