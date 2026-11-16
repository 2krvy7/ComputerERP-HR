from fastapi import APIRouter
from psycopg.rows import dict_row
from database import get_db_connection

router = APIRouter(
    prefix="/api/journal",
    tags=["Journal"]
)

@router.get("/")
def get_journal_entries():
    conn = get_db_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('SELECT * FROM "JournalEntry" ORDER BY 1 DESC')
            return cur.fetchall()
    finally:
        conn.close()