from fastapi import APIRouter
from database import get_db_connection

router = APIRouter(
    prefix="/dashboard",
    tags=["Employee Dashboard"]
)


@router.get("/")
def get_dashboard():
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:

            cur.execute("""
                SELECT COUNT(*)
                FROM employeerecords
            """)
            total_employees = cur.fetchone()[0]

            cur.execute("""
                SELECT COUNT(*)
                FROM applicant
            """)
            total_applicants = cur.fetchone()[0]

            cur.execute("""
                SELECT COUNT(*)
                FROM attendance
            """)
            total_attendance = cur.fetchone()[0]

            cur.execute("""
                SELECT COUNT(*)
                FROM leave
                WHERE status = 'Pending'
            """)
            pending_leaves = cur.fetchone()[0]

            return {
                "total_employees": total_employees,
                "total_applicants": total_applicants,
                "total_attendance": total_attendance,
                "pending_leaves": pending_leaves
            }

    finally:
        conn.close()