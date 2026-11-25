from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date, time, datetime, timedelta
from zoneinfo import ZoneInfo
from database import get_db_connection

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)


class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    time_in: time | None = None
    time_out: time | None = None
    status: str


class AttendanceUpdate(BaseModel):
    employee_id: int
    date: date
    time_in: time | None = None
    time_out: time | None = None
    status: str


class TimeInRequest(BaseModel):
    employee_id: int


# =========================================================
# AUTOMATIC ABSENCE
# =========================================================

def mark_missing_days_absent(conn, cur):
    """
    Automatically marks active employees as Absent for
    every missing attendance date from their hire date
    up to yesterday.

    Existing attendance records are not changed.
    Today's date is not automatically marked Absent.

    Uses the existing database connection from the
    attendance endpoint.
    """

    # Get current Philippine date
    philippines_now = datetime.now(
        ZoneInfo("Asia/Manila")
    )

    today = philippines_now.date()

    # Only finalize dates before today.
    yesterday = today - timedelta(days=1)

    # Get active employees who have already been hired.
    cur.execute("""
        SELECT
            employee_id,
            hire_date
        FROM "EmployeeRecords"
        WHERE employment_status = 'Active'
          AND hire_date IS NOT NULL
          AND hire_date <= %s
    """, (yesterday,))

    employees = cur.fetchall()

    for employee in employees:
        employee_id = employee[0]
        hire_date = employee[1]

        # Convert datetime to date if necessary.
        if isinstance(hire_date, datetime):
            hire_date = hire_date.date()

        # Start checking from the employee's hire date.
        current_date = hire_date

        # Check every date from hire date through yesterday.
        while current_date <= yesterday:

            # Check whether an attendance record already exists.
            cur.execute("""
                SELECT attendance_id
                FROM "Attendance"
                WHERE employee_id = %s
                  AND date = %s
                LIMIT 1
            """, (
                employee_id,
                current_date
            ))

            existing_record = cur.fetchone()

            # Only create Absent when there is no record.
            if not existing_record:
                cur.execute("""
                    INSERT INTO "Attendance" (
                        employee_id,
                        date,
                        time_in,
                        time_out,
                        status
                    )
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    employee_id,
                    current_date,
                    None,
                    None,
                    "Absent"
                ))

            # Move to the next date.
            current_date += timedelta(days=1)


# =========================================================
# GET ALL ATTENDANCE
# =========================================================

@router.get("/")
def get_attendance():

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Automatically create missing attendance records
        # from each employee's hire date up to yesterday.
        mark_missing_days_absent(conn, cur)

        # Save any automatically created Absent records.
        conn.commit()

        cur.execute("""
            SELECT
                a.attendance_id,
                a.employee_id,
                e.first_name,
                e.last_name,
                a.date,
                a.time_in,
                a.time_out,
                a.status
            FROM "Attendance" a
            JOIN "EmployeeRecords" e
                ON a.employee_id = e.employee_id
            ORDER BY a.date DESC, a.attendance_id DESC
        """)

        rows = cur.fetchall()

        attendance = []

        for row in rows:
            attendance.append({
                "attendance_id": row[0],
                "employee_id": row[1],
                "employee_name": f"{row[2]} {row[3]}",
                "date": row[4],
                "time_in": row[5],
                "time_out": row[6],
                "status": row[7]
            })

        return attendance

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# GET ONE ATTENDANCE RECORD
# =========================================================

@router.get("/{attendance_id}")
def get_attendance_record(attendance_id: int):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                a.attendance_id,
                a.employee_id,
                e.first_name,
                e.last_name,
                a.date,
                a.time_in,
                a.time_out,
                a.status
            FROM "Attendance" a
            JOIN "EmployeeRecords" e
                ON a.employee_id = e.employee_id
            WHERE a.attendance_id = %s
        """, (attendance_id,))

        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Attendance record not found"
            )

        return {
            "attendance_id": row[0],
            "employee_id": row[1],
            "employee_name": f"{row[2]} {row[3]}",
            "date": row[4],
            "time_in": row[5],
            "time_out": row[6],
            "status": row[7]
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# EMPLOYEE TIME IN
# =========================================================

@router.post("/time-in")
def employee_time_in(request: TimeInRequest):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if employee exists
        cur.execute("""
            SELECT employee_id
            FROM "EmployeeRecords"
            WHERE employee_id = %s
        """, (request.employee_id,))

        employee = cur.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        # Get current Philippine date and time
        philippines_now = datetime.now(
            ZoneInfo("Asia/Manila")
        )

        today = philippines_now.date()

        current_time = philippines_now.time().replace(
            microsecond=0
        )

        # Check if employee already has
        # an attendance record today
        cur.execute("""
            SELECT
                attendance_id,
                time_in,
                time_out,
                status
            FROM "Attendance"
            WHERE employee_id = %s
              AND date = %s
            ORDER BY attendance_id ASC
            LIMIT 1
        """, (
            request.employee_id,
            today
        ))

        existing_record = cur.fetchone()

        if existing_record:

            # Already timed in
            if existing_record[1]:
                raise HTTPException(
                    status_code=400,
                    detail="You have already timed in today."
                )

            # If a record exists but has no time in,
            # update that record.
            cur.execute("""
                UPDATE "Attendance"
                SET
                    time_in = %s,
                    status = 'Present'
                WHERE attendance_id = %s
            """, (
                current_time,
                existing_record[0]
            ))

            attendance_id = existing_record[0]

        else:

            # Create today's attendance record
            cur.execute("""
                INSERT INTO "Attendance" (
                    employee_id,
                    date,
                    time_in,
                    time_out,
                    status
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING attendance_id
            """, (
                request.employee_id,
                today,
                current_time,
                None,
                "Present"
            ))

            attendance_id = cur.fetchone()[0]

        conn.commit()

        return {
            "message": "Time In recorded successfully",
            "attendance_id": attendance_id,
            "date": today,
            "time_in": current_time,
            "status": "Present"
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# EMPLOYEE TIME OUT
# =========================================================

@router.put("/time-out/{attendance_id}")
def employee_time_out(attendance_id: int):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get current Philippine time
        philippines_now = datetime.now(
            ZoneInfo("Asia/Manila")
        )

        current_time = philippines_now.time().replace(
            microsecond=0
        )

        # Check attendance record
        cur.execute("""
            SELECT
                attendance_id,
                employee_id,
                date,
                time_in,
                time_out,
                status
            FROM "Attendance"
            WHERE attendance_id = %s
        """, (attendance_id,))

        record = cur.fetchone()

        if not record:
            raise HTTPException(
                status_code=404,
                detail="Attendance record not found"
            )

        # Employee must Time In first
        if not record[3]:
            raise HTTPException(
                status_code=400,
                detail="You need to Time In first."
            )

        # Prevent multiple Time Outs
        if record[4]:
            raise HTTPException(
                status_code=400,
                detail="You have already timed out today."
            )

        # Update Time Out
        cur.execute("""
            UPDATE "Attendance"
            SET time_out = %s
            WHERE attendance_id = %s
        """, (
            current_time,
            attendance_id
        ))

        conn.commit()

        return {
            "message": "Time Out recorded successfully",
            "attendance_id": attendance_id,
            "time_out": current_time
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# CREATE ATTENDANCE
# =========================================================

@router.post("/")
def create_attendance(attendance: AttendanceCreate):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if employee exists
        cur.execute("""
            SELECT employee_id
            FROM "EmployeeRecords"
            WHERE employee_id = %s
        """, (attendance.employee_id,))

        employee = cur.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        # Check if an attendance record already exists
        # for this employee on this date.
        cur.execute("""
            SELECT attendance_id
            FROM "Attendance"
            WHERE employee_id = %s
              AND date = %s
            LIMIT 1
        """, (
            attendance.employee_id,
            attendance.date
        ))

        existing_record = cur.fetchone()

        if existing_record:
            raise HTTPException(
                status_code=400,
                detail="Attendance record already exists for this employee on this date."
            )

        # Create attendance record
        cur.execute("""
            INSERT INTO "Attendance" (
                employee_id,
                date,
                time_in,
                time_out,
                status
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING attendance_id
        """, (
            attendance.employee_id,
            attendance.date,
            attendance.time_in,
            attendance.time_out,
            attendance.status
        ))

        attendance_id = cur.fetchone()[0]

        conn.commit()

        return {
            "message": "Attendance created successfully",
            "attendance_id": attendance_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# UPDATE ATTENDANCE
# =========================================================

@router.put("/{attendance_id}")
def update_attendance(
    attendance_id: int,
    attendance: AttendanceUpdate
):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check if the attendance record exists
        cur.execute("""
            SELECT attendance_id
            FROM "Attendance"
            WHERE attendance_id = %s
        """, (attendance_id,))

        existing_attendance = cur.fetchone()

        if not existing_attendance:
            raise HTTPException(
                status_code=404,
                detail="Attendance record not found"
            )

        # Check if the employee exists
        cur.execute("""
            SELECT employee_id
            FROM "EmployeeRecords"
            WHERE employee_id = %s
        """, (attendance.employee_id,))

        employee = cur.fetchone()

        if not employee:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        # Check if another attendance record already
        # exists for the same employee and date.
        # Exclude the record currently being updated.
        cur.execute("""
            SELECT attendance_id
            FROM "Attendance"
            WHERE employee_id = %s
              AND date = %s
              AND attendance_id != %s
            LIMIT 1
        """, (
            attendance.employee_id,
            attendance.date,
            attendance_id
        ))

        duplicate_record = cur.fetchone()

        if duplicate_record:
            raise HTTPException(
                status_code=400,
                detail="Another attendance record already exists for this employee on this date."
            )

        # Update attendance
        cur.execute("""
            UPDATE "Attendance"
            SET
                employee_id = %s,
                date = %s,
                time_in = %s,
                time_out = %s,
                status = %s
            WHERE attendance_id = %s
        """, (
            attendance.employee_id,
            attendance.date,
            attendance.time_in,
            attendance.time_out,
            attendance.status,
            attendance_id
        ))

        conn.commit()

        return {
            "message": "Attendance updated successfully",
            "attendance_id": attendance_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================================================
# DELETE ATTENDANCE
# =========================================================

@router.delete("/{attendance_id}")
def delete_attendance(attendance_id: int):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            DELETE FROM "Attendance"
            WHERE attendance_id = %s
        """, (attendance_id,))

        if cur.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Attendance record not found"
            )

        conn.commit()

        return {
            "message": "Attendance deleted successfully",
            "attendance_id": attendance_id
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()