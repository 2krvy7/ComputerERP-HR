from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/coa",
    tags=["Chart Of Accounts"]
)

class NewAccountPayload(BaseModel):
    accountCode: str
    accountName: str
    accountType: str

def get_coa_info(cur):
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND LOWER(table_name) = 'chartofaccounts'
        LIMIT 1
    """)
    t_row = cur.fetchone()
    table_name = t_row["table_name"] if t_row else "ChartOfAccounts"

    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
    """, (table_name,))
    cols = {r["column_name"].lower(): r["column_name"] for r in cur.fetchall()}
    return table_name, cols

@router.get("/")
def get_accounts():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            table_name, cols = get_coa_info(cur)
            c_id = cols.get("accountid", "accountID")
            c_code = cols.get("accountcode", "accountCode")
            c_name = cols.get("accountname", "accountName")
            c_type = cols.get("accounttype", "accountType")

            cur.execute(f"""
                SELECT
                    "{c_id}" AS "accountID",
                    "{c_code}" AS "accountCode",
                    "{c_name}" AS "accountName",
                    "{c_type}" AS "accountType"
                FROM "{table_name}"
                ORDER BY "{c_code}" ASC
            """)
            return cur.fetchall()
    finally:
        conn.close()

@router.post("/")
def create_account(payload: NewAccountPayload):
    code = payload.accountCode.strip()
    name = payload.accountName.strip()
    acc_type = payload.accountType.strip()

    if not code or not name or not acc_type:
        raise HTTPException(status_code=400, detail="All fields are required.")

    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            table_name, cols = get_coa_info(cur)
            c_id = cols.get("accountid", "accountID")
            c_code = cols.get("accountcode", "accountCode")
            c_name = cols.get("accountname", "accountName")
            c_type = cols.get("accounttype", "accountType")

            cur.execute(f"""
                INSERT INTO "{table_name}" ("{c_code}", "{c_name}", "{c_type}")
                VALUES (%s, %s, %s)
                RETURNING
                    "{c_id}" AS "accountID",
                    "{c_code}" AS "accountCode",
                    "{c_name}" AS "accountName",
                    "{c_type}" AS "accountType"
            """, (code, name, acc_type))
            created = cur.fetchone()
            conn.commit()
            return created
    except Exception as e:
        conn.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail=f"Account code '{code}' already exists.")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()