from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date
from database import get_db_connection

router = APIRouter(
    prefix="/employees",
    tags=["Employees"]
)


# =========================
# Request Models
# =========================

class EmployeeCreate(BaseModel):
    userid: str | None = None
    position_id: int | None = None
    first_name: str
    last_name: str
    birth_date: date | None = None
    contact_no: str
    email: str
    address: str
    hire_date: date
    employment_status: str


class EmployeeUpdate(BaseModel):
    userid: str | None = None
    position_id: int | None = None
    first_name: str
    last_name: str
    birth_date: date | None = None
    contact_no: str
    email: str
    address: str
    hire_date: date
    employment_status: str


# =========================
# GET ALL EMPLOYEES
# =========================

@router.get("/")
def get_employees():

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                employee_id,
                "UserID",
                position_id,
                first_name,
                last_name,
                birth_date,
                contact_no,
                email,
                address,
                hire_date,
                employment_status
            FROM "EmployeeRecords"
            ORDER BY employee_id
        """)

        rows = cur.fetchall()

        employees = []

        for row in rows:
            employees.append({
                "employee_id": row[0],
                "userid": row[1],
                "position_id": row[2],
                "first_name": row[3],
                "last_name": row[4],
                "birth_date": row[5],
                "contact_no": row[6],
                "email": row[7],
                "address": row[8],
                "hire_date": row[9],
                "employment_status": row[10]
            })

        return employees

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# =========================
# GET ONE EMPLOYEE
# =========================

@router.get("/{employee_id}")
def get_employee(employee_id: int):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                employee_id,
                "UserID",
                position_id,
                first_name,
                last_name,
                birth_date,
                contact_no,
                email,
                address,
                hire_date,
                employment_status
            FROM "EmployeeRecords"
            WHERE employee_id = %s
        """, (employee_id,))

        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        return {
            "employee_id": row[0],
            "userid": row[1],
            "position_id": row[2],
            "first_name": row[3],
            "last_name": row[4],
            "birth_date": row[5],
            "contact_no": row[6],
            "email": row[7],
            "address": row[8],
            "hire_date": row[9],
            "employment_status": row[10]
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


# =========================
# CREATE EMPLOYEE
# =========================

@router.post("/")
def create_employee(employee: EmployeeCreate):

    conn = get_db_connection()
    cur = conn.cursor()

    try:

        # ---------------------------------
        # CREATE EMPLOYEE RECORD
        # ---------------------------------
        #
        # UserID is intentionally NULL when
        # the employee is created.
        #
        # The Superadmin will assign the
        # UserID later based on the employee's
        # department and ID.
        # ---------------------------------

        cur.execute("""
            INSERT INTO "EmployeeRecords" (
                "UserID",
                position_id,
                first_name,
                last_name,
                birth_date,
                contact_no,
                email,
                address,
                hire_date,
                employment_status
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            RETURNING employee_id
        """, (
            employee.userid,
            employee.position_id,
            employee.first_name,
            employee.last_name,
            employee.birth_date,
            employee.contact_no,
            employee.email,
            employee.address,
            employee.hire_date,
            employee.employment_status
        ))

        employee_id = cur.fetchone()[0]

        # ---------------------------------
        # COMMIT EMPLOYEE RECORD
        # ---------------------------------

        conn.commit()

        return {
            "message": "Employee created successfully",
            "employee_id": employee_id,
            "userid": employee.userid
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


# =========================
# UPDATE EMPLOYEE
# =========================

@router.put("/{employee_id}")
def update_employee(
    employee_id: int,
    employee: EmployeeUpdate
):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            UPDATE "EmployeeRecords"
            SET
                "UserID" = %s,
                position_id = %s,
                first_name = %s,
                last_name = %s,
                birth_date = %s,
                contact_no = %s,
                email = %s,
                address = %s,
                hire_date = %s,
                employment_status = %s
            WHERE employee_id = %s
        """, (
            employee.userid,
            employee.position_id,
            employee.first_name,
            employee.last_name,
            employee.birth_date,
            employee.contact_no,
            employee.email,
            employee.address,
            employee.hire_date,
            employee.employment_status,
            employee_id
        ))

        if cur.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Employee not found"
            )

        conn.commit()

        return {
            "message": "Employee updated successfully",
            "employee_id": employee_id
        }

    except HTTPException:
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