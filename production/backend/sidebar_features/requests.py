from datetime import date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db_connection

router = APIRouter()

class MaterialRequestInput(BaseModel):
    RequiredDate: date
class MaterialReceiptInput(BaseModel):
    ReceivedBy: str

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
                    rr."RR_ID",
                    po."productionID",
                    pm."PM_ID",
                    im."SKU",
                    im."Item_Name",
                    rr."WH_ID",
                    rr."Quantity",
                    po."productCost",
                    COALESCE(po."status", 'Pending'),
                    rr."issued",
                    rr."approved_by",
                    rr."approved_date"
                FROM public."RestockRequest" AS rr
                INNER JOIN public."PRODUCT_MASTER" AS pm
                    ON rr."IM_ID" = pm."IM_ID"
                INNER JOIN public."ITEM_MASTER" AS im
                    ON pm."IM_ID" = im."IM_ID"
                LEFT JOIN public."ProductionOrder" AS po
                    ON rr."RR_ID" = po."RR_ID"
                WHERE rr."status" = 'Approved'
                  AND im."ItemType" = 'Finished'
                ORDER BY rr."RR_ID" DESC;
                """
            )

            rows = sql_cursor.fetchall()

        return [
            {
                "RR_ID": row[0],
                "productionID": row[1],
                "PM_ID": row[2],
                "SKU": row[3],
                "Item_Name": row[4],
                "WH_ID": row[5],
                "quantity": float(row[6]) if row[6] is not None else None,
                "productCost": float(row[7]) if row[7] is not None else None,
                "status": row[8],
                "created_at": row[9],
                "reviewed_by": row[10],
                "reviewed_at": row[11]
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

@router.post("/production-requests/{rr_id}/accept")
def accept_production_request(rr_id: int):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:

            # Retrieve the approved Inventory request.
            sql_cursor.execute(
                """
                SELECT
                    rr."RR_ID",
                    pm."PM_ID",
                    rr."WH_ID",
                    rr."Quantity"
                FROM public."RestockRequest" AS rr
                INNER JOIN public."PRODUCT_MASTER" AS pm
                    ON rr."IM_ID" = pm."IM_ID"
                INNER JOIN public."ITEM_MASTER" AS im
                    ON pm."IM_ID" = im."IM_ID"
                WHERE rr."RR_ID" = %s
                  AND rr."status" = 'Approved'
                  AND im."ItemType" = 'Finished'
                FOR UPDATE OF rr;
                """,
                (rr_id,)
            )

            request = sql_cursor.fetchone()

            if request is None:
                raise HTTPException(
                    status_code=404,
                    detail="Approved finished-product request not found."
                )

            # Prevent duplicate Production Orders.
            sql_cursor.execute(
                """
                SELECT "productionID"
                FROM public."ProductionOrder"
                WHERE "RR_ID" = %s;
                """,
                (rr_id,)
            )

            existing_order = sql_cursor.fetchone()

            if existing_order is not None:
                raise HTTPException(
                    status_code=409,
                    detail="A Production Order already exists for this request."
                )

            # Calculate the product cost using its BOM.
            sql_cursor.execute(
                """
                SELECT
                    COUNT(*) AS material_count,
                    COUNT(*) FILTER (
                        WHERE im."Price" IS NULL
                    ) AS missing_prices,
                    COALESCE(
                        SUM(b."MaterialRequired" * im."Price"),
                        0
                    ) AS product_cost
                FROM public."BILL_OF_MATERIALS" AS b
                INNER JOIN public."ITEM_MASTER" AS im
                    ON b."IM_ID" = im."IM_ID"
                WHERE b."PM_ID" = %s;
                """,
                (request[1],)
            )

            cost_result = sql_cursor.fetchone()

            material_count = cost_result[0]
            missing_prices = cost_result[1]
            product_cost = cost_result[2]

            if material_count == 0:
                raise HTTPException(
                    status_code=400,
                    detail="No Bill of Materials found for this product."
                )

            if missing_prices > 0:
                raise HTTPException(
                    status_code=400,
                    detail="Some BOM materials have no assigned price."
                )

            # Create Production's own record.
            sql_cursor.execute(
                """
                INSERT INTO public."ProductionOrder"
                    ("RR_ID", "PM_ID", "WH_ID", "quantity",
                    "productCost", "status", "created_at")
                VALUES (%s, %s, %s, %s, %s, 'Accepted', NOW())
                RETURNING "productionID";
                """,
                (
                    request[0],
                    request[1],
                    request[2],
                    request[3],
                    product_cost
                ))
            production_id = sql_cursor.fetchone()[0]
            
            # Automatically create the manufacturing progress record.
            sql_cursor.execute(
                """
                INSERT INTO public."PRODUCTION"
                    ("ProductionOrder_ID", "PM_ID", "WH_ID",
                    "QuantityRequired", "QuantityProduced",
                    "StartDate", "Deadline", "status")
                VALUES (%s, %s, %s, %s, 0, NULL, NULL, 'Pending');
                """,
                (
                    production_id,
                    request[1],
                    request[2],
                    request[3]
                )
            )

        database_connection.commit()

        return {
            "message": "Production request accepted successfully.",
            "RR_ID": rr_id,
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

# SUBMIT MATERIAL REQUEST

@router.post("/material-requests/{production_id}/submit")
def submit_material_request(
    production_id: int,
    request_data: MaterialRequestInput
):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:

            # Check whether the Production Order exists and is accepted.
            sql_cursor.execute(
                """
                SELECT
                    po."productionID",
                    po."PM_ID",
                    po."quantity",
                    po."status"
                FROM public."ProductionOrder" AS po
                WHERE po."productionID" = %s;
                """,
                (production_id,)
            )

            production_order = sql_cursor.fetchone()

            if production_order is None:
                raise HTTPException(
                    status_code=404,
                    detail="Production Order not found."
                )

            if production_order[3] != "Accepted":
                raise HTTPException(
                    status_code=400,
                    detail="Only accepted Production Orders can submit Material Requests."
                )

            # Prevent duplicate Material Requests.
            sql_cursor.execute(
                """
                SELECT "MR_ID"
                FROM public."MaterialRequest"
                WHERE "productionID" = %s;
                """,
                (production_id,)
            )

            existing_request = sql_cursor.fetchone()

            if existing_request is not None:
                raise HTTPException(
                    status_code=409,
                    detail="A Material Request already exists for this Production Order."
                )

            # Retrieve the BOM and calculate the required batch quantities.
            sql_cursor.execute(
                """
                SELECT
                    b."IM_ID",
                    b."MaterialRequired" * %s
                FROM public."BILL_OF_MATERIALS" AS b
                WHERE b."PM_ID" = %s;
                """,
                (production_order[2], production_order[1])
            )

            materials = sql_cursor.fetchall()

            if not materials:
                raise HTTPException(
                    status_code=400,
                    detail="No Bill of Materials found for this product."
                )

            # Create the Material Request header.
            sql_cursor.execute(
                """
                INSERT INTO public."MaterialRequest"
                    ("productionID", "DateRequested",
                     "RequiredDate", "Status")
                VALUES (%s, NOW(), %s, 'Pending')
                RETURNING "MR_ID";
                """,
                (production_id, request_data.RequiredDate)
            )

            mr_id = sql_cursor.fetchone()[0]

            # Insert each required raw material into the details table.
            for material in materials:
                sql_cursor.execute(
                    """
                    INSERT INTO public."MaterialRequestDetail"
                        ("MR_ID", "IM_ID", "QuantityRequested")
                    VALUES (%s, %s, %s);
                    """,
                    (mr_id, material[0], material[1])
                )

        database_connection.commit()

        return {
            "message": "Material Request submitted successfully.",
            "MR_ID": mr_id,
            "productionID": production_id,
            "status": "Pending"
        }

    except HTTPException:
        database_connection.rollback()
        raise

    except Exception as error:
        database_connection.rollback()
        print(f"Material Request submission error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to submit Material Request."
        )

    finally:
        database_connection.close()

# MATERIAL REQUESTS IN QUEUE
@router.get("/material-requests/queue/")
def get_material_request_queue():
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    mr."MR_ID",
                    mr."productionID",
                    mr."DateRequested",
                    mr."RequiredDate",
                    mr."Status",
                    pod."PM_ID",
                    im."SKU",
                    im."Item_Name",
                    pod."quantity",
                    mrd."IM_ID",
                    raw."SKU",
                    raw."Item_Name",
                    raw."unit_of_measure",
                    mrd."QuantityRequested"
                FROM public."MaterialRequest" AS mr
                INNER JOIN public."ProductionOrder" AS pod
                    ON mr."productionID" = pod."productionID"
                INNER JOIN public."PRODUCT_MASTER" AS pm
                    ON pod."PM_ID" = pm."PM_ID"
                INNER JOIN public."ITEM_MASTER" AS im
                    ON pm."IM_ID" = im."IM_ID"
                LEFT JOIN public."MaterialRequestDetail" AS mrd
                    ON mr."MR_ID" = mrd."MR_ID"
                LEFT JOIN public."ITEM_MASTER" AS raw
                    ON mrd."IM_ID" = raw."IM_ID"
                WHERE mr."Status" = 'Pending'
                ORDER BY mr."DateRequested" DESC,
                         mr."MR_ID" DESC;
                """
            )

            rows = sql_cursor.fetchall()

        requests = {}

        for row in rows:
            mr_id = row[0]

            if mr_id not in requests:
                requests[mr_id] = {
                    "MR_ID": row[0],
                    "productionID": row[1],
                    "DateRequested": row[2],
                    "RequiredDate": row[3],
                    "Status": row[4],
                    "PM_ID": row[5],
                    "SKU": row[6],
                    "Item_Name": row[7],
                    "quantity": float(row[8]),
                    "materials": []
                }

            if row[9] is not None:
                requests[mr_id]["materials"].append({
                    "IM_ID": row[9],
                    "SKU": row[10],
                    "Item_Name": row[11],
                    "unit_of_measure": row[12],
                    "QuantityRequested": float(row[13])
                })

        return list(requests.values())

    except Exception as error:
        print(f"Material Request queue error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve Material Request queue."
        )

    finally:
        database_connection.close()

# MATERIAL ISSUANCE HISTORY

@router.get("/material-requests/history/")
def get_material_request_history():
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    mr."MR_ID",
                    mr."productionID",
                    mr."DateRequested",
                    mr."RequiredDate",
                    mr."Status",
                    mr."ReleasedBy",
                    mr."ReleasedAt",
                    mr."ReceivedBy",
                    mr."ReceivedAt",
                    im."SKU",
                    im."Item_Name",
                    pod."quantity",
                    mrd."IM_ID",
                    raw."SKU",
                    raw."Item_Name",
                    raw."unit_of_measure",
                    mrd."QuantityRequested"
                FROM public."MaterialRequest" AS mr
                INNER JOIN public."ProductionOrder" AS pod
                    ON mr."productionID" = pod."productionID"
                INNER JOIN public."PRODUCT_MASTER" AS pm
                    ON pod."PM_ID" = pm."PM_ID"
                INNER JOIN public."ITEM_MASTER" AS im
                    ON pm."IM_ID" = im."IM_ID"
                LEFT JOIN public."MaterialRequestDetail" AS mrd
                    ON mr."MR_ID" = mrd."MR_ID"
                LEFT JOIN public."ITEM_MASTER" AS raw
                    ON mrd."IM_ID" = raw."IM_ID"
                WHERE mr."Status" IN ('Released', 'Received')
                ORDER BY mr."DateRequested" DESC,
                         mr."MR_ID" DESC;
                """
            )

            rows = sql_cursor.fetchall()

        requests = {}

        for row in rows:
            mr_id = row[0]

            if mr_id not in requests:
                requests[mr_id] = {
                    "MR_ID": row[0],
                    "productionID": row[1],
                    "DateRequested": row[2],
                    "RequiredDate": row[3],
                    "Status": row[4],
                    "ReleasedBy": row[5],
                    "ReleasedAt": row[6],
                    "ReceivedBy": row[7],
                    "ReceivedAt": row[8],
                    "SKU": row[9],
                    "Item_Name": row[10],
                    "quantity": float(row[11]),
                    "materials": []
                }

            if row[12] is not None:
                requests[mr_id]["materials"].append({
                    "IM_ID": row[12],
                    "SKU": row[13],
                    "Item_Name": row[14],
                    "unit_of_measure": row[15],
                    "QuantityRequested": float(row[16])
                })

        return list(requests.values())

    except Exception as error:
        print(f"Material Issuance history error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve Material Issuance history."
        )

    finally:
        database_connection.close()

# CONFIRM MATERIAL RECEIPT

@router.post("/material-requests/{mr_id}/confirm-receipt")
def confirm_material_receipt(
    mr_id: int,
    receipt_data: MaterialReceiptInput
):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:

            # Check whether the request exists and has been released.
            sql_cursor.execute(
                """
                SELECT "Status"
                FROM public."MaterialRequest"
                WHERE "MR_ID" = %s
                FOR UPDATE;
                """,
                (mr_id,)
            )

            material_request = sql_cursor.fetchone()

            if material_request is None:
                raise HTTPException(
                    status_code=404,
                    detail="Material Request not found."
                )

            if material_request[0] != "Released":
                raise HTTPException(
                    status_code=400,
                    detail="Only released Material Requests can be marked as received."
                )

            # Record Production's receipt confirmation.
            sql_cursor.execute(
                """
                UPDATE public."MaterialRequest"
                SET
                    "Status" = 'Received',
                    "ReceivedBy" = %s,
                    "ReceivedAt" = NOW()
                WHERE "MR_ID" = %s;
                """,
                (receipt_data.ReceivedBy, mr_id)
            )

        database_connection.commit()

        return {
            "message": "Materials received successfully.",
            "MR_ID": mr_id,
            "Status": "Received"
        }

    except HTTPException:
        database_connection.rollback()
        raise

    except Exception as error:
        database_connection.rollback()
        print(f"Material receipt confirmation error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to confirm material receipt."
        )

    finally:
        database_connection.close()