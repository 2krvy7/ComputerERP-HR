import re
import secrets

import bcrypt
import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db_connection
from security import require_superadmin

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_superadmin)])

ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no look-alike characters


class AccountIn(BaseModel):
    employee_id: int
    dept_id: str


def one_time_password() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(10))


def no_spaces(s: str | None) -> str:
    return re.sub(r"\s+", "", s or "")


# Employees (from HR's records) that don't have an account yet: fills the dropdown
@router.get("/pending-employees")
def pending_employees():
    with get_db_connection() as conn:
        return conn.execute(
            """SELECT e.employee_id, e.first_name, e.last_name, e.email,
            p.position_name, r."RoleName" AS role_name
            FROM public."EmployeeRecords" e
            LEFT JOIN public."Position" p ON p.position_id = e.position_id
            LEFT JOIN public."Roles" r ON r."RoleID" = p."RoleID"
            WHERE e."UserID" IS NULL
            ORDER BY e.last_name, e.first_name"""
        ).fetchall()


@router.get("/")
def list_users():
    with get_db_connection() as conn:
        return conn.execute(
            """SELECT u."UserID", u."Username", u.email, r."RoleName", d."DeptName", u.must_change_password
               FROM public."User" u
               JOIN public."Roles" r ON r."RoleID" = u."RoleID"
               LEFT JOIN public."Department" d ON d."DeptID" = u."DeptID"
               ORDER BY u."UserID" """
        ).fetchall()


@router.get("/departments")
def departments():
    with get_db_connection() as conn:
        return conn.execute(
            'SELECT "DeptID", "DeptName" FROM public."Department" ORDER BY "DeptName"'
        ).fetchall()


@router.post("/", status_code=201)
def create_account(body: AccountIn):
    with get_db_connection() as conn:
        emp = conn.execute(
            """SELECT e.employee_id, e.first_name, e.last_name, e.email, e."UserID",
              p.position_name, p."RoleID" AS role_id
            FROM public."EmployeeRecords" e
            LEFT JOIN public."Position" p ON p.position_id = e.position_id
            WHERE e.employee_id = %s""",
            (body.employee_id,),
        ).fetchone()

        if not emp:
            raise HTTPException(404, "Employee record not found")
        if emp["UserID"]:
            raise HTTPException(409, "This employee already has an account")
        if not emp["email"]:
            raise HTTPException(400, "This employee record has no email")
        if not emp["position_name"]:
            raise HTTPException(400, "This employee has no position yet. Ask HR to assign one.")

        # The role comes from the HR position: same name in Position and Roles
        if emp["role_id"] == 1:
            raise HTTPException(400, "A position can't map to the SuperAdmin role")
        role_id = emp["role_id"]

        dept = conn.execute(
            'SELECT "DeptID" FROM public."Department" WHERE "DeptID" = %s', (body.dept_id,)
        ).fetchone()
        if not dept:
            raise HTTPException(400, "Unknown department")
        dept_id = dept["DeptID"]

        # UserID = department code + running number, e.g. PR001
        nxt = conn.execute(
            """SELECT COALESCE(MAX(CAST(SUBSTRING("UserID" FROM %s::int) AS integer)), 0) + 1 AS n
               FROM public."User" WHERE "UserID" ~ %s""",
            (len(dept_id) + 1, f"^{dept_id}[0-9]+$"),
        ).fetchone()["n"]
        user_id = f"{dept_id}{nxt:03d}"

        # Username = LastName-FirstName; add a number if someone already has it
        base = f"{no_spaces(emp['last_name'])}-{no_spaces(emp['first_name'])}"
        username, i = base, 1
        while conn.execute(
            'SELECT 1 FROM public."User" WHERE LOWER("Username") = LOWER(%s)', (username,)
        ).fetchone():
            i += 1
            username = f"{base}{i}"

        password = one_time_password()
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        try:
            conn.execute(
                """INSERT INTO public."User"
                   ("UserID", "Username", email, password, "RoleID", "DeptID", must_change_password)
                   VALUES (%s, %s, %s, %s, %s, %s, true)""",
                (user_id, username, emp["email"], hashed, role_id, dept_id),
            )
        except psycopg.errors.UniqueViolation:
            raise HTTPException(409, "That email or ID is already used by another account. Try again.")

        conn.execute(
            'UPDATE public."EmployeeRecords" SET "UserID" = %s WHERE employee_id = %s',
            (user_id, body.employee_id),
        )

    # The plain password exists only in this response; the database keeps the hash
    return {
        "UserID": user_id,
        "Username": username,
        "email": emp["email"],
        "one_time_password": password,
    }


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str):
    password = one_time_password()
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    with get_db_connection() as conn:
        row = conn.execute(
            """UPDATE public."User" SET password = %s, must_change_password = true
               WHERE "UserID" = %s RETURNING "UserID", "Username" """,
            (hashed, user_id),
        ).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return {**row, "one_time_password": password}