from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db_connection

router = APIRouter(
    prefix="/positions",
    tags=["Positions"]
)


class PositionCreate(BaseModel):
    position_name: str
    basic_salary: float


# GET all positions
@router.get("/")
def get_positions():

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                position_id,
                position_name,
                basic_salary
            FROM "Position"
            ORDER BY position_id
        """)

        rows = cur.fetchall()

        positions = []

        for row in rows:
            positions.append({
                "position_id": row[0],
                "position_name": row[1],
                "basic_salary": float(row[2])
            })

        return positions

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()


# GET one position
@router.get("/{position_id}")
def get_position(position_id: int):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                position_id,
                position_name,
                basic_salary
            FROM "Position"
            WHERE position_id = %s
        """, (position_id,))

        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail="Position not found"
            )

        return {
            "position_id": row[0],
            "position_name": row[1],
            "basic_salary": float(row[2])
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


# CREATE position
@router.post("/")
def create_position(position: PositionCreate):

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO "Position" (
                position_name,
                basic_salary
            )
            VALUES (%s, %s)
            RETURNING position_id
        """, (
            position.position_name,
            position.basic_salary
        ))

        position_id = cur.fetchone()[0]

        conn.commit()

        return {
            "message": "Position created successfully",
            "position_id": position_id
        }

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        cur.close()
        conn.close()