from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import get_db_connection

router = APIRouter()

class ProductionProgressInput(BaseModel):
    QuantityProduced: int = Field(ge=0)

# GET: Retrieve production orders
@router.get("/")
def get_orders():
    conn = get_db_connection()
    cur = conn.cursor()
    #return []

    try:
        cur.execute("""
            SELECT
            "Production_ID",
            "ProductionOrder_ID",
            "PM_ID",
            "WH_ID",
            "QuantityRequired",
            "QuantityProduced",
            "StartDate",
            "Deadline",
            status
        FROM public."PRODUCTION"
        ORDER BY "Production_ID" DESC
        """)

        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

        return [dict(zip(columns, row)) for row in rows]

    finally:
        cur.close()
        conn.close()

# GET: Retrieve production orders for Finance
@router.get("/finance")
def get_finance_orders():
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    "productionID",
                    "PM_ID",
                    "WH_ID",
                    "quantity",
                    "productCost",
                    "status",
                    "created_at"
                FROM public."ProductionOrder"
                ORDER BY "productionID" DESC;
            """)

            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

            return [dict(zip(columns, row)) for row in rows]

    finally:
        conn.close()

# GET: Retrieve completed production outputs for Inventory
@router.get("/completed")
def get_completed_orders():
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    p."Production_ID",
                    p."ProductionOrder_ID",
                    po."RR_ID",
                    p."PM_ID",
                    p."WH_ID",
                    p."QuantityRequired",
                    p."QuantityProduced",
                    p."StartDate",
                    p."Deadline",
                    p.status
                FROM public."PRODUCTION" p
                JOIN public."ProductionOrder" po
                    ON p."ProductionOrder_ID" = po."productionID"
                WHERE p.status = 'Completed'
                ORDER BY p."Production_ID" DESC;
            """)

            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

            return [dict(zip(columns, row)) for row in rows]

    finally:
        conn.close()

# PATCH: Update production progress
@router.patch("/{production_id}/progress")
def update_production_progress(
    production_id: int,
    progress: ProductionProgressInput
):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:

            # Retrieve and lock the production order
            sql_cursor.execute(
                """
                SELECT
                    "QuantityRequired",
                    status
                FROM public."PRODUCTION"
                WHERE "Production_ID" = %s
                FOR UPDATE;
                """,
                (production_id,)
            )

            order = sql_cursor.fetchone()

            if order is None:
                raise HTTPException(
                    status_code=404,
                    detail="Production order not found."
                )

            quantity_required = order[0]
            current_status = order[1]
            quantity_produced = progress.QuantityProduced

            # Prevent updates to completed production orders
            if current_status == "Completed":
                raise HTTPException(
                    status_code=400,
                    detail="Completed production orders cannot be updated."
                    
    )

            # Prevent production beyond the required quantity
            if quantity_produced > quantity_required:
                raise HTTPException(
                    status_code=400,
                    detail="Quantity produced cannot exceed quantity required."
                )


            # Only allow production progress when materials are ready
            if current_status not in ["Ready to Start", "In Progress"]:
                raise HTTPException(
                    status_code=400,
                    detail="Production cannot proceed until materials are received."
                )
            # Automatically determine production status
            if quantity_produced == quantity_required:
                status = "Completed"
            else:
                status = "In Progress"

            # Update production quantity and status together
            sql_cursor.execute(
                """
                UPDATE public."PRODUCTION"
                SET
                    "QuantityProduced" = %s,
                    "status" = %s
                WHERE "Production_ID" = %s;
                """,
                (quantity_produced, status, production_id)
            )

        database_connection.commit()

        remaining = quantity_required - quantity_produced
        progress_percentage = round(
            (quantity_produced / quantity_required) * 100, 2
        )

        return {
            "message": "Production progress updated successfully.",
            "Production_ID": production_id,
            "QuantityRequired": quantity_required,
            "QuantityProduced": quantity_produced,
            "Remaining": remaining,
            "Progress": progress_percentage,
            "status": status
        }

    except HTTPException:
        database_connection.rollback()
        raise

    except Exception as error:
        database_connection.rollback()
        print(f"Production progress update error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update production progress."
        )

    finally:
        database_connection.close()