from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date
from database import get_db_connection

router = APIRouter(
    prefix="/recruitment",
    tags=["Recruitment"]
)


# =========================
# REQUEST MODELS
# =========================

class RecruitmentCreate(BaseModel):
    first_name: str
    last_name: str
    birth_date: date
    email: str
    contact_no: str
    address: str
    interview_date: date | None = None
    result: str | None = None


class RecruitmentUpdate(BaseModel):
    applicant_id: int
    first_name: str
    last_name: str
    birth_date: date
    email: str
    contact_no: str
    address: str
    interview_date: date | None = None
    result: str | None = None


class RecruitmentProcessUpdate(BaseModel):
    interview_date: date | None = None
    result: str | None = None


# =========================
# AUTOMATIC RECRUITMENT STATUS
# =========================

def get_recruitment_status(
    interview_date: date | None,
    result: str | None
):
    if not interview_date:
        return "Pending"

    if result == "Passed":
        return "Hired"

    if result == "Failed":
        return "Rejected"

    return "For Interview"


# =========================
# GET EMPLOYEE POSITION
# =========================

def get_employee_position_id(cursor):
    cursor.execute("""
        SELECT position_id
        FROM "Position"
        WHERE LOWER(position_name) = 'employee'
        LIMIT 1
    """)

    row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=400,
            detail="Employee position was not found in the Position table."
        )

    return row[0]


# =========================
# GET ALL RECRUITMENT
# =========================

@router.get("/")
def get_recruitment():

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                r.recruitment_id,
                r.applicant_id,

                a.first_name,
                a.last_name,
                a.first_name || ' ' || a.last_name AS applicant_name,

                a.birth_date,
                a.email,
                a.contact_no,
                a.address,
                a.application_date,

                r.position_id,
                p.position_name,

                r.interview_date,
                r.result,
                r.recruitment_status

            FROM "Recruitment" r

            LEFT JOIN "Applicant" a
                ON r.applicant_id = a.applicant_id

            LEFT JOIN "Position" p
                ON r.position_id = p.position_id

            ORDER BY r.recruitment_id DESC
        """)

        rows = cursor.fetchall()

        columns = [
            desc[0]
            for desc in cursor.description
        ]

        return [
            dict(zip(columns, row))
            for row in rows
        ]

    finally:
        cursor.close()
        conn.close()


# =========================
# GET RECRUITMENT BY ID
# =========================

@router.get("/{recruitment_id}")
def get_recruitment_by_id(recruitment_id: int):

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                r.recruitment_id,
                r.applicant_id,

                a.first_name,
                a.last_name,
                a.first_name || ' ' || a.last_name AS applicant_name,

                a.birth_date,
                a.email,
                a.contact_no,
                a.address,
                a.application_date,

                r.position_id,
                p.position_name,

                r.interview_date,
                r.result,
                r.recruitment_status

            FROM "Recruitment" r

            LEFT JOIN "Applicant" a
                ON r.applicant_id = a.applicant_id

            LEFT JOIN "Position" p
                ON r.position_id = p.position_id

            WHERE r.recruitment_id = %s
        """, (recruitment_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Recruitment record not found"
            )

        columns = [
            desc[0]
            for desc in cursor.description
        ]

        return dict(zip(columns, row))

    finally:
        cursor.close()
        conn.close()


# =========================
# CREATE RECRUITMENT
# =========================

@router.post("/")
def create_recruitment(data: RecruitmentCreate):

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        # Automatically set position to Employee
        position_id = get_employee_position_id(cursor)

        # Automatically set recruitment status
        recruitment_status = get_recruitment_status(
            data.interview_date,
            data.result
        )

        # Automatically set application date
        application_date = date.today()

        # -------------------------
        # CREATE APPLICANT
        # -------------------------

        cursor.execute("""
            INSERT INTO "Applicant"
            (
                first_name,
                last_name,
                birth_date,
                email,
                contact_no,
                address,
                application_date,
                status
            )

            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )

            RETURNING applicant_id
        """, (
            data.first_name,
            data.last_name,
            data.birth_date,
            data.email,
            data.contact_no,
            data.address,
            application_date,
            recruitment_status
        ))

        applicant_id = cursor.fetchone()[0]

        # -------------------------
        # CREATE RECRUITMENT
        # -------------------------

        cursor.execute("""
            INSERT INTO "Recruitment"
            (
                applicant_id,
                position_id,
                interview_date,
                result,
                recruitment_status
            )

            VALUES
            (
                %s,
                %s,
                %s,
                %s,
                %s
            )

            RETURNING recruitment_id
        """, (
            applicant_id,
            position_id,
            data.interview_date,
            data.result,
            recruitment_status
        ))

        recruitment_id = cursor.fetchone()[0]

        conn.commit()

        return {
            "message": "Recruitment record created successfully",
            "recruitment_id": recruitment_id,
            "applicant_id": applicant_id
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
        cursor.close()
        conn.close()


# =========================
# UPDATE RECRUITMENT PROCESS
# =========================
# Used by the recruitment table
# to directly update interview date/result.

@router.patch("/{recruitment_id}/process")
def update_recruitment_process(
    recruitment_id: int,
    data: RecruitmentProcessUpdate
):

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        # -------------------------
        # FIND RECRUITMENT
        # -------------------------

        cursor.execute("""
            SELECT applicant_id
            FROM "Recruitment"
            WHERE recruitment_id = %s
        """, (recruitment_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Recruitment record not found"
            )

        applicant_id = row[0]

        # -------------------------
        # AUTOMATIC STATUS
        # -------------------------

        recruitment_status = get_recruitment_status(
            data.interview_date,
            data.result
        )

        # -------------------------
        # UPDATE RECRUITMENT
        # -------------------------

        cursor.execute("""
            UPDATE "Recruitment"
            SET
                interview_date = %s,
                result = %s,
                recruitment_status = %s
            WHERE recruitment_id = %s
        """, (
            data.interview_date,
            data.result,
            recruitment_status,
            recruitment_id
        ))

        # -------------------------
        # UPDATE APPLICANT STATUS
        # -------------------------

        cursor.execute("""
            UPDATE "Applicant"
            SET
                status = %s
            WHERE applicant_id = %s
        """, (
            recruitment_status,
            applicant_id
        ))

        conn.commit()

        return {
            "message": "Recruitment process updated successfully",
            "recruitment_status": recruitment_status
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
        cursor.close()
        conn.close()


# =========================
# UPDATE RECRUITMENT
# =========================

@router.put("/{recruitment_id}")
def update_recruitment(
    recruitment_id: int,
    data: RecruitmentUpdate
):

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        # -------------------------
        # FIND EXISTING RECRUITMENT
        # -------------------------

        cursor.execute("""
            SELECT applicant_id
            FROM "Recruitment"
            WHERE recruitment_id = %s
        """, (recruitment_id,))

        existing = cursor.fetchone()

        if not existing:
            raise HTTPException(
                status_code=404,
                detail="Recruitment record not found"
            )

        applicant_id = existing[0]

        # -------------------------
        # AUTOMATIC VALUES
        # -------------------------

        position_id = get_employee_position_id(cursor)

        recruitment_status = get_recruitment_status(
            data.interview_date,
            data.result
        )

        # -------------------------
        # UPDATE APPLICANT
        # -------------------------

        cursor.execute("""
            UPDATE "Applicant"
            SET
                first_name = %s,
                last_name = %s,
                birth_date = %s,
                email = %s,
                contact_no = %s,
                address = %s,
                status = %s

            WHERE applicant_id = %s
        """, (
            data.first_name,
            data.last_name,
            data.birth_date,
            data.email,
            data.contact_no,
            data.address,
            recruitment_status,
            applicant_id
        ))

        # -------------------------
        # UPDATE RECRUITMENT
        # -------------------------

        cursor.execute("""
            UPDATE "Recruitment"
            SET
                position_id = %s,
                interview_date = %s,
                result = %s,
                recruitment_status = %s

            WHERE recruitment_id = %s
        """, (
            position_id,
            data.interview_date,
            data.result,
            recruitment_status,
            recruitment_id
        ))

        conn.commit()

        return {
            "message": "Recruitment record updated successfully"
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
        cursor.close()
        conn.close()


# =========================
# DELETE RECRUITMENT
# =========================

@router.delete("/{recruitment_id}")
def delete_recruitment(recruitment_id: int):

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        # -------------------------
        # FIND APPLICANT
        # -------------------------

        cursor.execute("""
            SELECT applicant_id
            FROM "Recruitment"
            WHERE recruitment_id = %s
        """, (recruitment_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Recruitment record not found"
            )

        applicant_id = row[0]

        # -------------------------
        # DELETE RECRUITMENT
        # -------------------------

        cursor.execute("""
            DELETE FROM "Recruitment"
            WHERE recruitment_id = %s
        """, (recruitment_id,))

        # -------------------------
        # DELETE APPLICANT
        # -------------------------

        cursor.execute("""
            DELETE FROM "Applicant"
            WHERE applicant_id = %s
        """, (applicant_id,))

        conn.commit()

        return {
            "message": "Recruitment record deleted successfully"
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
        cursor.close()
        conn.close()