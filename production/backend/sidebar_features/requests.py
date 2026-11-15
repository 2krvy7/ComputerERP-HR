from fastapi import APIRouter, HTTPException
from database import get_db_connection

router = APIRouter()


# MATERIAL REQUIREMENT: BOM PER PRODUCT

@router.get("/material-requirements/")
def get_material_requirements(pm_id: int):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    b."PM_ID",
                    b."IM_ID",
                    iim."SKU",
                    iim."Item_Name",
                    iim."unit_of_measure",
                    b."MaterialRequired"
                FROM public."BILL_OF_MATERIALS" AS b
                INNER JOIN public."ITEM_MASTER" AS iim
                    ON b."IM_ID" = iim."IM_ID"
                WHERE b."PM_ID" = %s
                ORDER BY iim."Item_Name";
                """,
                (pm_id,)
            )

            rows = sql_cursor.fetchall()

        return [
            {
                "PM_ID": row[0],
                "IM_ID": row[1],
                "SKU": row[2],
                "Item_Name": row[3],
                "unit_of_measure": row[4],
                "MaterialRequired": float(row[5])
            }
            for row in rows
        ]

    except Exception as error:
        print(f"Material requirement error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve material requirements."
        )

    finally:
        database_connection.close()


# PRODUCTION REPLENISHMENT REQUESTS

@router.get("/production-requests/")
def get_production_requests():
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    po."productionID",
                    po."PM_ID",
                    im."SKU",
                    im."Item_Name",
                    po."WH_ID",
                    po."quantity",
                    po."productCost",
                    po."status",
                    po."created_at",
                    po."reviewed_by",
                    po."reviewed_at"
                FROM public."ProductionOrder" AS po
                INNER JOIN public."PRODUCT_MASTER" AS pm
                    ON po."PM_ID" = pm."PM_ID"
                INNER JOIN public."ITEM_MASTER" AS im
                    ON pm."IM_ID" = im."IM_ID"
                ORDER BY po."productionID" DESC;
                """
            )

            rows = sql_cursor.fetchall()

        return [
            {
                "productionID": row[0],
                "PM_ID": row[1],
                "SKU": row[2],
                "Item_Name": row[3],
                "WH_ID": row[4],
                "quantity": float(row[5]) if row[5] is not None else None,
                "productCost": float(row[6]) if row[6] is not None else None,
                "status": row[7],
                "created_at": row[8],
                "reviewed_by": row[9],
                "reviewed_at": row[10]
            }
            for row in rows
        ]

    except Exception as error:
        print(f"Production request retrieval error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve production requests."
        )

    finally:
        database_connection.close()


# BATCH MATERIAL REQUIREMENTS
# Only accepted replenishment requests can access this endpoint.

@router.get("/production-requests/{production_id}/material-requirements/")
def get_batch_material_requirements(production_id: int):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:

            # Retrieve the accepted replenishment request.
            sql_cursor.execute(
                """
                SELECT
                    "PM_ID",
                    "quantity",
                    "status"
                FROM public."ProductionOrder"
                WHERE "productionID" = %s;
                """,
                (production_id,)
            )

            request = sql_cursor.fetchone()

            if request is None:
                raise HTTPException(
                    status_code=404,
                    detail="Production request not found."
                )

            pm_id = request[0]
            batch_quantity = request[1]
            request_status = request[2]

            if request_status != "Accepted":
                raise HTTPException(
                    status_code=400,
                    detail="Material requirements are available only for accepted requests."
                )

            if batch_quantity is None or batch_quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="The production request has an invalid quantity."
                )

            # Retrieve BOM and calculate total batch requirements.
            sql_cursor.execute(
                """
                SELECT
                    b."IM_ID",
                    iim."SKU",
                    iim."Item_Name",
                    iim."unit_of_measure",
                    b."MaterialRequired"
                FROM public."BILL_OF_MATERIALS" AS b
                INNER JOIN public."ITEM_MASTER" AS iim
                    ON b."IM_ID" = iim."IM_ID"
                WHERE b."PM_ID" = %s
                ORDER BY iim."Item_Name";
                """,
                (pm_id,)
            )

            materials = sql_cursor.fetchall()

        return [
            {
                "IM_ID": row[0],
                "SKU": row[1],
                "Item_Name": row[2],
                "unit_of_measure": row[3],
                "QuantityPerProduct": float(row[4]),
                "BatchQuantity": float(row[4]) * float(batch_quantity)
            }
            for row in materials
        ]

    except HTTPException:
        raise

    except Exception as error:
        print(f"Batch material requirement error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to calculate batch material requirements."
        )

    finally:
        database_connection.close()


# ACCEPT PRODUCTION REPLENISHMENT REQUEST

@router.patch("/production-requests/{production_id}/accept")
def accept_production_request(production_id: int):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    "status",
                    "reviewed_by",
                    "reviewed_at"
                FROM public."ProductionOrder"
                WHERE "productionID" = %s
                FOR UPDATE;
                """,
                (production_id,)
            )

            request = sql_cursor.fetchone()

            if request is None:
                raise HTTPException(
                    status_code=404,
                    detail="Production request not found."
                )

            current_status, reviewed_by, reviewed_at = request

            if reviewed_by is None or reviewed_at is None:
                raise HTTPException(
                    status_code=400,
                    detail="This request has not been reviewed by Inventory."
                )

            if current_status != "Pending":
                raise HTTPException(
                    status_code=400,
                    detail="Only pending requests can be accepted."
                )

            sql_cursor.execute(
                """
                UPDATE public."ProductionOrder"
                SET "status" = 'Accepted'
                WHERE "productionID" = %s;
                """,
                (production_id,)
            )

        database_connection.commit()

        return {
            "message": "Production request accepted successfully.",
            "productionID": production_id,
            "status": "Accepted"
        }

    except HTTPException:
        database_connection.rollback()
        raise

    except Exception as error:
        database_connection.rollback()
        print(f"Production request acceptance error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to accept production request."
        )

    finally:
        database_connection.close()


# REJECT PRODUCTION REPLENISHMENT REQUEST

@router.patch("/production-requests/{production_id}/reject")
def reject_production_request(production_id: int):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    "status",
                    "reviewed_by",
                    "reviewed_at"
                FROM public."ProductionOrder"
                WHERE "productionID" = %s
                FOR UPDATE;
                """,
                (production_id,)
            )

            request = sql_cursor.fetchone()

            if request is None:
                raise HTTPException(
                    status_code=404,
                    detail="Production request not found."
                )

            current_status, reviewed_by, reviewed_at = request

            if reviewed_by is None or reviewed_at is None:
                raise HTTPException(
                    status_code=400,
                    detail="This request has not been reviewed by Inventory."
                )

            if current_status != "Pending":
                raise HTTPException(
                    status_code=400,
                    detail="Only pending requests can be rejected."
                )

            sql_cursor.execute(
                """
                UPDATE public."ProductionOrder"
                SET "status" = 'Rejected'
                WHERE "productionID" = %s;
                """,
                (production_id,)
            )

        database_connection.commit()

        return {
            "message": "Production request rejected successfully.",
            "productionID": production_id,
            "status": "Rejected"
        }

    except HTTPException:
        database_connection.rollback()
        raise

    except Exception as error:
        database_connection.rollback()
        print(f"Production request rejection error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to reject production request."
        )

    finally:
        database_connection.close()