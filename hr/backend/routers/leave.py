from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date
from database import get_db_connection

router = APIRouter(prefix="/leave", tags=["Leave Management"])


class LeaveCreate(BaseModel):
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    reason: str
    status: str


class LeaveUpdate(BaseModel):
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    reason: str
    status: str


@router.get("/")
def get_leaves():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            l.leave_id,
            l.employee_id,
            e.first_name || ' ' || e.last_name AS employee_name,
            l.leave_type,
            l.start_date,
            l.end_date,
            l.reason,
            l.status
        FROM "Leave" l
        JOIN "EmployeeRecords" e
            ON l.employee_id = e.employee_id
        ORDER BY l.leave_id DESC
    """)

    rows = cursor.fetchall()

    columns = [
        "leave_id",
        "employee_id",
        "employee_name",
        "leave_type",
        "start_date",
        "end_date",
        "reason",
        "status"
    ]

    result = [dict(zip(columns, row)) for row in rows]

    cursor.close()
    conn.close()

    return result


@router.get("/{leave_id}")
def get_leave(leave_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            l.leave_id,
            l.employee_id,
            e.first_name || ' ' || e.last_name AS employee_name,
            l.leave_type,
            l.start_date,
            l.end_date,
            l.reason,
            l.status
        FROM "Leave" l
        JOIN "EmployeeRecords" e
            ON l.employee_id = e.employee_id
        WHERE l.leave_id = %s
    """, (leave_id,))

    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Leave record not found")

    columns = [
        "leave_id",
        "employee_id",
        "employee_name",
        "leave_type",
        "start_date",
        "end_date",
        "reason",
        "status"
    ]

    return dict(zip(columns, row))


@router.post("/")
def create_leave(leave: LeaveCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if employee exists
    cursor.execute("""
        SELECT employee_id
        FROM "EmployeeRecords"
        WHERE employee_id = %s
    """, (leave.employee_id,))

    employee = cursor.fetchone()

    if not employee:
        cursor.close()
        conn.close()
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    cursor.execute("""
        INSERT INTO "Leave"
        (
            employee_id,
            leave_type,
            start_date,
            end_date,
            reason,
            status
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING leave_id
    """, (
        leave.employee_id,
        leave.leave_type,
        leave.start_date,
        leave.end_date,
        leave.reason,
        leave.status
    ))

    leave_id = cursor.fetchone()[0]

    conn.commit()
    cursor.close()
    conn.close()

    return {
        "message": "Leave record created successfully",
        "leave_id": leave_id
    }


@router.put("/{leave_id}")
def update_leave(leave_id: int, leave: LeaveUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT leave_id
        FROM "Leave"
        WHERE leave_id = %s
    """, (leave_id,))

    existing = cursor.fetchone()

    if not existing:
        cursor.close()
        conn.close()
        raise HTTPException(
            status_code=404,
            detail="Leave record not found"
        )

    cursor.execute("""
        UPDATE "Leave"
        SET
            employee_id = %s,
            leave_type = %s,
            start_date = %s,
            end_date = %s,
            reason = %s,
            status = %s
        WHERE leave_id = %s
    """, (
        leave.employee_id,
        leave.leave_type,
        leave.start_date,
        leave.end_date,
        leave.reason,
        leave.status,
        leave_id
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return {
        "message": "Leave record updated successfully"
    }


@router.delete("/{leave_id}")
def delete_leave(leave_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM "Leave"
        WHERE leave_id = %s
        RETURNING leave_id
    """, (leave_id,))

    deleted = cursor.fetchone()

    if not deleted:
        cursor.close()
        conn.close()
        raise HTTPException(
            status_code=404,
            detail="Leave record not found"
        )

    conn.commit()
    cursor.close()
    conn.close()

    return {
        "message": "Leave record deleted successfully"
    }