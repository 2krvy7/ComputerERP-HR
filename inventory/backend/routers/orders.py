
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from database import get_db_connection
from psycopg.rows import dict_row
from security import require_inventory_user, require_inventory_admin


router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)


# ==========================================
# REQUEST MODELS
# ==========================================

class GoodsReceivedInspection(BaseModel):
    quantity_received: int = Field(..., ge=0)
    remarks: Optional[str] = None
    reorder_level: Optional[int] = Field(default=None, ge=0)


class StockReorderLevelUpdate(BaseModel):
    reorder_level: int = Field(..., ge=0)


class RestockRequestCreate(BaseModel):
    stock_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)


# ==========================================
# UPCOMING REQUESTS
# ADMIN + STAFF
# ==========================================


@router.get("/upcoming-requests")
def get_upcoming_requests(
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT
                    s."STOCK_ID",
                    s."IM_ID",
                    im."Item_Name",
                    im."SKU",
                    im."ItemType",
                    s."quantity_on_hand",
                    s."reorder_level",
                    s."WH_ID",
                    w."Warehouse_Name",

                    CASE
                        WHEN s."quantity_on_hand" <= s."reorder_level"
                            THEN 'Low Stock'
                        ELSE 'Approaching Reorder'
                    END AS "stock_status",

                    active_request."RR_ID",
                    active_request."Quantity" AS "RequestedQuantity",

                    CASE
                        WHEN active_request."RR_ID" IS NOT NULL
                            THEN COALESCE(active_request."status", 'Pending')
                        ELSE 'Not Requested'
                    END AS "RequestStatus"

                FROM "STOCK" s

                JOIN "ITEM_MASTER" im
                    ON s."IM_ID" = im."IM_ID"

                JOIN "WAREHOUSE" w
                    ON s."WH_ID" = w."WH_ID"

                LEFT JOIN LATERAL (
                    SELECT
                        rr."RR_ID",
                        rr."Quantity",
                        rr."status"
                    FROM "RestockRequest" rr
                    WHERE rr."IM_ID" = s."IM_ID"
                      AND rr."WH_ID" = s."WH_ID"
                      AND (
                          rr."status" IN ('Pending', 'Approved')
                          OR rr."status" IS NULL
                      )
                    ORDER BY rr."RR_ID" DESC
                    LIMIT 1
                ) active_request ON TRUE

                WHERE im."ItemType" IN ('Raw', 'Finished')
                  AND s."reorder_level" > 0
                  AND s."quantity_on_hand" <= CEIL(
                      s."reorder_level" * 1.2
                  )

                ORDER BY
                    s."quantity_on_hand" ASC,
                    im."Item_Name" ASC
            """)

            return cur.fetchall()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()

# ==========================================
# CREATE RESTOCK REQUEST
# ADMIN + STAFF
# ==========================================


@router.post("/restock-requests")
def create_restock_request(
    request: RestockRequestCreate,
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor(row_factory=dict_row) as cur:

            cur.execute("""
                SELECT
                    s."STOCK_ID",
                    s."IM_ID",
                    s."WH_ID",
                    im."Item_Name",
                    im."ItemType",
                    im."status"
                FROM "STOCK" s
                JOIN "ITEM_MASTER" im
                    ON s."IM_ID" = im."IM_ID"
                WHERE s."STOCK_ID" = %s
                FOR UPDATE OF s
            """, (request.stock_id,))

            stock = cur.fetchone()

            if stock is None:
                raise HTTPException(
                    status_code=404,
                    detail="Stock record not found."
                )

            if stock["status"] != "Active":
                raise HTTPException(
                    status_code=400,
                    detail="Inactive items cannot be requested."
                )

            # Check if an active request already exists
            cur.execute("""
                SELECT
                    rr."RR_ID",
                    rr."status"
                FROM "RestockRequest" rr
                WHERE rr."IM_ID" = %s
                  AND rr."WH_ID" = %s
                  AND (
                      rr."status" IN ('Pending', 'Approved')
                      OR rr."status" IS NULL
                  )
                LIMIT 1
            """, (
                stock["IM_ID"],
                stock["WH_ID"]
            ))

            existing_request = cur.fetchone()

            if existing_request is not None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "An active request already exists "
                        "for this item and warehouse."
                    )
                )

            # Automatically approve the request
            cur.execute("""
                INSERT INTO "RestockRequest" (
                    "IM_ID",
                    "WH_ID",
                    "Quantity",
                    "issued",
                    "status",
                    "approved_date"
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    CURRENT_TIMESTAMP,
                    'Approved',
                    CURRENT_TIMESTAMP
                )
                RETURNING
                    "RR_ID",
                    "IM_ID",
                    "WH_ID",
                    "Quantity",
                    "issued",
                    "status",
                    "approved_date"
            """, (
                stock["IM_ID"],
                stock["WH_ID"],
                request.quantity
            ))
            print("RESTOCK REQUEST RECEIVED:")  
            result = cur.fetchone()

        conn.commit()

        return {
            "message": "Restock request created successfully.",
            "request": result   
        }

    except HTTPException:
        if conn is not None:
            conn.rollback()
        raise

    except Exception as e:
        if conn is not None:
            conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()

# ==========================================
# UPDATE REORDER LEVEL
# ADMIN ONLY
# ==========================================

@router.put("/stock/{stock_id}/reorder-level")
def update_stock_reorder_level(
    stock_id: int,
    update: StockReorderLevelUpdate,
    user: dict = Depends(require_inventory_admin)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                UPDATE "STOCK"
                SET "reorder_level" = %s
                WHERE "STOCK_ID" = %s
                RETURNING
                    "STOCK_ID",
                    "IM_ID",
                    "WH_ID",
                    "quantity_on_hand",
                    "reorder_level"
            """, (
                update.reorder_level,
                stock_id
            ))

            result = cur.fetchone()

            if result is None:
                raise HTTPException(
                    status_code=404,
                    detail="Stock record not found."
                )

        conn.commit()

        return {
            "message": "Reorder level updated successfully.",
            "stock": result
        }

    except HTTPException:
        if conn is not None:
            conn.rollback()
        raise

    except Exception as e:
        if conn is not None:
            conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()


# ==========================================
# INCOMING REQUESTS
# ADMIN + STAFF
# ==========================================

@router.get("/incoming-requests")
def get_incoming_requests(
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    rr."RR_ID",
                    rr."IM_ID",
                    im."Item_Name",
                    im."SKU",
                    im."ItemType",
                    rr."Quantity",
                    rr."WH_ID",
                    w."Warehouse_Name",
                    rr."issued",
                    rr."approved_by",
                    rr."approved_date",
                    rr."status"
                FROM "RestockRequest" rr
                JOIN "ITEM_MASTER" im
                    ON rr."IM_ID" = im."IM_ID"
                JOIN "WAREHOUSE" w
                    ON rr."WH_ID" = w."WH_ID"
                WHERE rr."status" = 'Approved'
                AND im."ItemType" = 'Raw'
                ORDER BY rr."issued" DESC
            """)

            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

            return [
                dict(zip(columns, row))
                for row in rows
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()


# ==========================================
# APPROVE RESTOCK REQUEST
# ADMIN ONLY
# ==========================================

# ==========================================
# PURCHASE REQUESTS
# ADMIN + STAFF
# ==========================================

@router.get("/purchase-requests")
def get_purchase_requests(
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    pr."PR_ID",
                    pr."Status",
                    pr."DateIssued",
                    pr."RestockRequestID",
                    rr."IM_ID",
                    im."Item_Name",
                    im."SKU",
                    im."ItemType",
                    rr."Quantity",
                    rr."WH_ID",
                    w."Warehouse_Name"
                FROM "PurchaseRequest" pr
                LEFT JOIN "RestockRequest" rr
                    ON pr."RestockRequestID" = rr."RR_ID"
                LEFT JOIN "ITEM_MASTER" im
                    ON rr."IM_ID" = im."IM_ID"
                LEFT JOIN "WAREHOUSE" w
                    ON rr."WH_ID" = w."WH_ID"
                ORDER BY pr."DateIssued" DESC
            """)

            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

            return [
                dict(zip(columns, row))
                for row in rows
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()


# ==========================================
# PURCHASE ORDERS
# ADMIN + STAFF
# ==========================================

@router.get("/purchase-orders")
def get_purchase_orders(
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    po."PO_ID",
                    po."RFQ_ID",
                    rq."PR_ID",
                    rq."SupplierID",
                    s."SupplierName",
                    rq."QuotedAmount",
                    rq."DeliveryTerms",
                    po."Total_Amount",
                    po."OrderDate"
                FROM "PurchaseOrder" po
                JOIN "RequestQuotation" rq
                    ON po."RFQ_ID" = rq."RFQ_ID"
                JOIN "Supplier" s
                    ON rq."SupplierID" = s."SupplierID"
                ORDER BY po."OrderDate" DESC
            """)

            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

            return [
                dict(zip(columns, row))
                for row in rows
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()


# ==========================================
# GOODS RECEIVED
# ADMIN + STAFF
# ==========================================

@router.get("/goods-received")
def get_goods_received(
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    gr."GR_ID",
                    gr."PO_ID",
                    po."RFQ_ID",
                    rq."PR_ID",
                    s."SupplierName",
                    gr."ReceivedBy",
                    gr."ReceivedDate",
                    gr."ItemCondition",
                    gr."QuantityReceived" AS "DeliveredQuantity",
                    sl."ActualQuantity" AS "AcceptedQuantity",
                    gr."Remarks",

                    CASE
                        WHEN sl."LogID" IS NULL
                            THEN 'Pending Inspection'
                        ELSE 'Inspected'
                    END AS "InspectionStatus"

                FROM "GoodsReceived" gr

                LEFT JOIN "STOCK_LEDGER" sl
                    ON sl."ReferenceNo" =
                        'GR-' || gr."GR_ID"::text
                    AND sl."TransactionType" = 'STOCK_IN'

                JOIN "PurchaseOrder" po
                    ON gr."PO_ID" = po."PO_ID"

                JOIN "RequestQuotation" rq
                    ON po."RFQ_ID" = rq."RFQ_ID"

                JOIN "Supplier" s
                    ON rq."SupplierID" = s."SupplierID"

                ORDER BY gr."ReceivedDate" DESC
            """)

            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

            return [
                dict(zip(columns, row))
                for row in rows
            ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()


# ==========================================
# CONFIRM GOODS RECEIVED
# ADMIN + STAFF
# PROCUREMENT INSPECTION WORKFLOW
# ==========================================

@router.put("/goods-received/{gr_id}/confirm-count")
def confirm_goods_received(
    gr_id: int,
    inspection: GoodsReceivedInspection,
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor() as cur:

            # Find the item, warehouse, and original request.
            # Lock the Goods Received record during inspection.
            cur.execute("""
                SELECT
                    rr."RR_ID",
                    rr."IM_ID",
                    rr."WH_ID",
                    gr."QuantityReceived"
                FROM "GoodsReceived" gr

                JOIN "PurchaseOrder" po
                    ON gr."PO_ID" = po."PO_ID"

                JOIN "RequestQuotation" rq
                    ON po."RFQ_ID" = rq."RFQ_ID"

                JOIN "PurchaseRequest" pr
                    ON rq."PR_ID" = pr."PR_ID"

                JOIN "RestockRequest" rr
                    ON pr."RestockRequestID" = rr."RR_ID"

                WHERE gr."GR_ID" = %s
                FOR UPDATE OF gr
            """, (gr_id,))

            stock_info = cur.fetchone()

            if stock_info is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "Goods Received record or its linked "
                        "item and warehouse was not found."
                    )
                )

            rr_id = stock_info[0]
            im_id = stock_info[1]
            wh_id = stock_info[2]
            original_quantity = stock_info[3]

            accepted_quantity = inspection.quantity_received

            if accepted_quantity > original_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Accepted quantity cannot be greater "
                        "than the original delivered quantity."
                    )
                )

            # Determine the item condition.
            if accepted_quantity == original_quantity:
                item_condition = "Good"
            elif accepted_quantity == 0:
                item_condition = "Damaged"
            else:
                item_condition = "Partial"

            reference_no = f"GR-{gr_id}"

            # Prevent duplicate stock-in transactions.
            cur.execute("""
                SELECT "LogID"
                FROM "STOCK_LEDGER"
                WHERE "ReferenceNo" = %s
                  AND "TransactionType" = 'STOCK_IN'
                FOR UPDATE
            """, (reference_no,))

            existing_transaction = cur.fetchone()

            if existing_transaction is not None:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This Goods Received record "
                        "has already been processed."
                    )
                )

            # Update inspection information.
            cur.execute("""
                UPDATE "GoodsReceived"
                SET
                    "ItemCondition" = %s,
                    "Remarks" = %s
                WHERE "GR_ID" = %s
                RETURNING
                    "GR_ID",
                    "PO_ID",
                    "QuantityReceived",
                    "ItemCondition",
                    "Remarks"
            """, (
                item_condition,
                inspection.remarks,
                gr_id
            ))

            result = cur.fetchone()

            if result is None:
                raise HTTPException(
                    status_code=404,
                    detail="Goods Received record not found."
                )

            updated_stock = None

            # Add accepted quantity to stock.
            if accepted_quantity > 0:

                cur.execute("""
                    SELECT
                        "STOCK_ID",
                        "quantity_on_hand",
                        "reorder_level"
                    FROM "STOCK"
                    WHERE "IM_ID" = %s
                      AND "WH_ID" = %s
                    FOR UPDATE
                """, (im_id, wh_id))

                stock_row = cur.fetchone()

                if stock_row is None:
                    if inspection.reorder_level is None:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                "Reorder level is required when "
                                "creating a new stock record."
                            )
                        )

                    stock_reorder_level = inspection.reorder_level

                else:
                    stock_reorder_level = stock_row[2]

                cur.execute("""
                    INSERT INTO "STOCK" (
                        "IM_ID",
                        "WH_ID",
                        "quantity_on_hand",
                        "reorder_level"
                    )
                    VALUES (%s, %s, %s, %s)

                    ON CONFLICT ("IM_ID", "WH_ID")
                    DO UPDATE SET
                        "quantity_on_hand" =
                            "STOCK"."quantity_on_hand"
                            + EXCLUDED."quantity_on_hand"

                    RETURNING
                        "STOCK_ID",
                        "quantity_on_hand",
                        "reorder_level"
                """, (
                    im_id,
                    wh_id,
                    accepted_quantity,
                    stock_reorder_level
                ))

                updated_stock = cur.fetchone()

            # Record the stock movement.
            # Even when accepted quantity is zero,
            # this records that inspection was completed.
            cur.execute("""
                INSERT INTO "STOCK_LEDGER" (
                    "IM_ID",
                    "WH_ID",
                    "TransactionType",
                    "Quantity",
                    "ActualQuantity",
                    "ReferenceNo",
                    "LoggedBy",
                    "LogDate",
                    "Remarks"
                )
                VALUES (
                    %s,
                    %s,
                    'STOCK_IN',
                    %s,
                    %s,
                    %s,
                    %s,
                    CURRENT_TIMESTAMP,
                    %s
                )
                RETURNING "LogID"
            """, (
                im_id,
                wh_id,
                original_quantity,
                accepted_quantity,
                reference_no,
                user["sub"],
                inspection.remarks
            ))

            ledger_result = cur.fetchone()

            # Mark the original Restock Request completed.
            cur.execute("""
                UPDATE "RestockRequest"
                SET "status" = 'Completed'
                WHERE "RR_ID" = %s
                RETURNING "RR_ID", "status"
            """, (rr_id,))

            completed_request = cur.fetchone()

            if completed_request is None:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Inspection was recorded, but the "
                        "Restock Request could not be completed."
                    )
                )

            conn.commit()

            return {
                "message": (
                    "Inspection confirmed and Restock Request "
                    "completed successfully."
                ),
                "GR_ID": result[0],
                "PO_ID": result[1],
                "RR_ID": completed_request[0],
                "RequestStatus": completed_request[1],
                "DeliveredQuantity": original_quantity,
                "AcceptedQuantity": accepted_quantity,
                "ItemCondition": result[3],
                "Remarks": result[4],
                "Stock": updated_stock,
                "LogID": ledger_result[0] if ledger_result else None
            }

    except HTTPException:
        if conn is not None:
            conn.rollback()
        raise

    except Exception as e:
        if conn is not None:
            conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        if conn is not None:
            conn.close()
