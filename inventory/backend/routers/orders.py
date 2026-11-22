
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Literal
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
class GoodsReceivedConfirmation(BaseModel):
    quantity_received: int = Field(..., ge=0)
    item_condition: Literal["Good", "Partial", "Damaged"]
    remarks: Optional[str] = None
    reorder_level: Optional[int] = Field(default=None, ge=0)

class StockReorderLevelUpdate(BaseModel):
    reorder_level: int = Field(..., ge=0)


class RestockRequestCreate(BaseModel):
    stock_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)

class GoodsReceivedCreate(BaseModel):
    po_id: int = Field(..., gt=0)
    quantity_received: int = Field(..., ge=0)
    item_condition: str
    remarks: Optional[str] = None

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

        with conn.cursor(row_factory=dict_row) as cur:

            # 1. Automatically create pending Goods Received
            # records for Purchase Orders that do not have one.
            cur.execute("""
                INSERT INTO public."GoodsReceived" ("PO_ID")
                SELECT po."PO_ID"
                FROM public."PurchaseOrder" po
                LEFT JOIN public."GoodsReceived" gr
                    ON gr."PO_ID" = po."PO_ID"
                WHERE gr."PO_ID" IS NULL
                ON CONFLICT ("PO_ID") DO NOTHING
            """)

            # 2. Retrieve all Goods Received records.
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
                    rr."Quantity" AS "RequestedQuantity",
                    gr."QuantityReceived",
                    gr."Remarks",

                    CASE
                        WHEN sl."LogID" IS NULL
                            THEN 'Pending Stock Confirmation'
                        ELSE 'Stock Confirmed'
                    END AS "InspectionStatus"

                FROM public."GoodsReceived" gr

                LEFT JOIN public."STOCK_LEDGER" sl
                    ON sl."ReferenceNo" =
                        'GR-' || gr."GR_ID"::text
                    AND sl."TransactionType" = 'STOCK_IN'

                JOIN public."PurchaseOrder" po
                    ON gr."PO_ID" = po."PO_ID"

                JOIN public."RequestQuotation" rq
                    ON po."RFQ_ID" = rq."RFQ_ID"

                JOIN public."PurchaseRequest" pr
                    ON rq."PR_ID" = pr."PR_ID"

                JOIN public."RestockRequest" rr
                    ON pr."RestockRequestID" = rr."RR_ID"

                JOIN public."Supplier" s
                    ON rq."SupplierID" = s."SupplierID"

                ORDER BY
                    gr."ReceivedDate" DESC NULLS LAST,
                    gr."GR_ID" DESC
            """)

            rows = cur.fetchall()

        # 3. Save the automatically created pending records.
        conn.commit()

        return rows

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
# CONFIRM GOODS RECEIVED
# ADMIN + STAFF
# PROCUREMENT INSPECTION WORKFLOW
# ==========================================
# ==========================================
# CONFIRM GOODS RECEIVED
# ADMIN + STAFF
# ==========================================



@router.put("/goods-received/{gr_id}/confirm-count")
def confirm_goods_received(
    gr_id: int,
    confirmation: GoodsReceivedConfirmation,
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor(row_factory=dict_row) as cur:

            # 1. Get and lock the Goods Received record.
            cur.execute("""
                SELECT
                    gr."GR_ID",
                    gr."PO_ID",
                    rr."RR_ID",
                    rr."IM_ID",
                    rr."WH_ID",
                    rr."Quantity" AS "RequestedQuantity"
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

            gr = cur.fetchone()

            if gr is None:
                raise HTTPException(
                    status_code=404,
                    detail="Goods Received record not found."
                )

            requested_quantity = gr["RequestedQuantity"]
            actual_quantity = confirmation.quantity_received
            item_condition = confirmation.item_condition
            remarks = (
                confirmation.remarks.strip()
                if confirmation.remarks
                else None
            )

            # 2. Validate received quantity and inspection.
            if actual_quantity > requested_quantity:
                raise HTTPException(
                    status_code=400,
                    detail="Received quantity cannot exceed ordered quantity."
                )

            if actual_quantity < requested_quantity and not remarks:
                raise HTTPException(
                    status_code=400,
                    detail="Please provide a reason for the shortage."
                )

            if item_condition in ["Partial", "Damaged"] and not remarks:
                raise HTTPException(
                    status_code=400,
                    detail="Remarks are required for Partial or Damaged items."
                )

            rr_id = gr["RR_ID"]
            im_id = gr["IM_ID"]
            wh_id = gr["WH_ID"]

            # 3. Prevent duplicate stock confirmation.
            reference_no = f"GR-{gr_id}"

            cur.execute("""
                SELECT "LogID"
                FROM "STOCK_LEDGER"
                WHERE "ReferenceNo" = %s
                  AND "TransactionType" = 'STOCK_IN'
                LIMIT 1
            """, (reference_no,))

            if cur.fetchone() is not None:
                raise HTTPException(
                    status_code=409,
                    detail="This Goods Received record has already been confirmed."
                )

            # 4. Find and lock existing stock.
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

            # 5. Increase STOCK using actual received quantity.
            updated_stock = None

            if actual_quantity > 0:

                if stock_row is None:
                    if confirmation.reorder_level is None:
                        raise HTTPException(
                            status_code=400,
                            detail="Reorder level is required because this item has no existing stock record."
                        )

                    stock_reorder_level = confirmation.reorder_level

                else:
                    stock_reorder_level = stock_row["reorder_level"]

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
                    actual_quantity,
                    stock_reorder_level
                ))

                updated_stock = cur.fetchone()

                actual_stock_balance = updated_stock["quantity_on_hand"]

            else:
                actual_stock_balance = (
                    stock_row["quantity_on_hand"]
                    if stock_row is not None
                    else 0
                )

            # 6. Save Goods Received inspection details.
            cur.execute("""
                UPDATE "GoodsReceived"
                SET
                    "QuantityReceived" = %s,
                    "ItemCondition" = %s,
                    "Remarks" = %s,
                    "ReceivedDate" = CURRENT_TIMESTAMP,
                    "ReceivedBy" = %s
                WHERE "GR_ID" = %s
            """, (
                actual_quantity,
                item_condition,
                remarks,
                user["sub"],
                gr_id
            ))

            # 7. Record the stock movement.
            # Quantity = ordered quantity.
            # ActualQuantity = actual quantity received.
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
                requested_quantity,
                actual_quantity,
                reference_no,
                user["sub"],
                remarks
            ))

            ledger_result = cur.fetchone()

            # 8. Update Restock Request status.
            if actual_quantity > 0:
                cur.execute("""
                    UPDATE "RestockRequest"
                    SET "status" = 'Completed'
                    WHERE "RR_ID" = %s
                    RETURNING "RR_ID", "status"
                """, (rr_id,))
            else:
                cur.execute("""
                    SELECT "RR_ID", "status"
                    FROM "RestockRequest"
                    WHERE "RR_ID" = %s
                """, (rr_id,))

            completed_request = cur.fetchone()

            conn.commit()

            return {
                "message": "Goods Received inspection and stock confirmation completed successfully.",
                "GR_ID": gr_id,
                "PO_ID": gr["PO_ID"],
                "RR_ID": completed_request["RR_ID"],
                "RequestStatus": completed_request["status"],
                "OrderedQuantity": requested_quantity,
                "QuantityReceived": actual_quantity,
                "ItemCondition": item_condition,
                "Remarks": remarks,
                "Stock": updated_stock,
                "ActualStockBalance": actual_stock_balance,
                "LogID": ledger_result["LogID"]
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
# CREATE GOODS RECEIVED
# INVENTORY ADMIN + STAFF
# ==========================================

@router.post("/goods-received")
def create_goods_received(
    request: GoodsReceivedCreate,
    user: dict = Depends(require_inventory_user)
):
    conn = None

    try:
        conn = get_db_connection()

        with conn.cursor(row_factory=dict_row) as cur:

            # Get the PO and its requested quantity
            cur.execute("""
                SELECT
                    po."PO_ID",
                    rr."RR_ID",
                    rr."Quantity" AS "RequestedQuantity",
                    rr."IM_ID",
                    rr."WH_ID",
                    s."SupplierName"
                FROM "PurchaseOrder" po
                JOIN "RequestQuotation" rq
                    ON po."RFQ_ID" = rq."RFQ_ID"
                JOIN "PurchaseRequest" pr
                    ON rq."PR_ID" = pr."PR_ID"
                JOIN "RestockRequest" rr
                    ON pr."RestockRequestID" = rr."RR_ID"
                JOIN "Supplier" s
                    ON rq."SupplierID" = s."SupplierID"
                WHERE po."PO_ID" = %s
                FOR UPDATE OF po
            """, (request.po_id,))

            po = cur.fetchone()

            if po is None:
                raise HTTPException(
                    status_code=404,
                    detail="Purchase Order not found."
                )

            # Check if a Goods Received record already exists
            cur.execute("""
                SELECT "GR_ID"
                FROM "GoodsReceived"
                WHERE "PO_ID" = %s
            """, (request.po_id,))

            existing_gr = cur.fetchone()

            if existing_gr is not None:
                raise HTTPException(
                    status_code=409,
                    detail="A Goods Received record already exists for this Purchase Order."
                )

            # Validate accepted quantity
            if request.quantity_received > po["RequestedQuantity"]:
                raise HTTPException(
                    status_code=400,
                    detail="Accepted quantity cannot exceed the requested quantity."
                )

            if request.item_condition not in ("Good", "Partial", "Damaged"):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid item condition."
                )

            if request.item_condition in ("Partial", "Damaged") and not request.remarks:
                raise HTTPException(
                    status_code=400,
                    detail="Remarks are required for Partial or Damaged items."
                )

            # Create Goods Received record
            cur.execute("""
                INSERT INTO "GoodsReceived" (
                    "PO_ID",
                    "ReceivedBy",
                    "ReceivedDate",
                    "ItemCondition",
                    "QuantityReceived",
                    "Remarks"
                )
                VALUES (%s, %s, CURRENT_TIMESTAMP, %s, %s, %s)
                RETURNING
                    "GR_ID",
                    "PO_ID",
                    "ReceivedBy",
                    "ReceivedDate",
                    "ItemCondition",
                    "QuantityReceived",
                    "Remarks"
            """, (
                request.po_id,
                user["sub"],
                request.item_condition,
                request.quantity_received,
                request.remarks
            ))

            result = cur.fetchone()

        conn.commit()

        return {
            "message": "Goods Received record created successfully.",
            "goods_received": result,
            "requested_quantity": po["RequestedQuantity"],
            "supplier_name": po["SupplierName"]
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


@router.get("/material-requests")
def get_material_request_availability(
    user: dict = Depends(require_inventory_user)
):
    query = '''
        SELECT
            mr."MR_ID",
            mr."productionID",
            mr."DateRequested",
            mr."RequiredDate",
            mr."Status",

            mrd."IM_ID",
            i."SKU",
            i."Item_Name",
            mrd."QuantityRequested",

            w."WH_ID",
            w."Warehouse_Name",
            COALESCE(s.quantity_on_hand, 0) AS quantity_on_hand

        FROM public."MaterialRequest" AS mr

        INNER JOIN public."MaterialRequestDetail" AS mrd
            ON mr."MR_ID" = mrd."MR_ID"

        INNER JOIN public."ITEM_MASTER" AS i
            ON mrd."IM_ID" = i."IM_ID"

        CROSS JOIN public."WAREHOUSE" AS w

        LEFT JOIN public."STOCK" AS s
            ON s."IM_ID" = mrd."IM_ID"
            AND s."WH_ID" = w."WH_ID"

        WHERE mr."Status" = 'Pending'

        ORDER BY mr."MR_ID", mrd."IM_ID", w."WH_ID"
    '''

    with get_db_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query)
            rows = cur.fetchall()

    requests = {}

    for row in rows:
        mr_id = row["MR_ID"]

        if mr_id not in requests:
            requests[mr_id] = {
                "MR_ID": mr_id,
                "productionID": row["productionID"],
                "DateRequested": row["DateRequested"],
                "RequiredDate": row["RequiredDate"],
                "Status": row["Status"],
                "materials": {}
            }

        im_id = row["IM_ID"]

        if im_id not in requests[mr_id]["materials"]:
            requests[mr_id]["materials"][im_id] = {
                "IM_ID": im_id,
                "SKU": row["SKU"],
                "Item_Name": row["Item_Name"],
                "QuantityRequested": row["QuantityRequested"],
                "total_available": 0,
                "warehouses": []
            }

        material = requests[mr_id]["materials"][im_id]

        available = int(row["quantity_on_hand"] or 0)

        material["total_available"] += available

        material["warehouses"].append({
            "WH_ID": row["WH_ID"],
            "Warehouse_Name": row["Warehouse_Name"],
            "quantity_on_hand": available
        })

    result = []

    for request in requests.values():
        materials = []

        for material in request["materials"].values():
            requested = material["QuantityRequested"]
            total = material["total_available"]

            best_warehouse_stock = max(
                (w["quantity_on_hand"] for w in material["warehouses"]),
                default=0
            )

            if total < requested:
                status = "Insufficient Stock"
            elif best_warehouse_stock >= requested:
                status = "Ready to Release"
            else:
                status = "Transfer Required"

            material["missing_quantity"] = max(0, requested - total)

            material["transfer_quantity"] = max(
                0, requested - best_warehouse_stock
            )

            material["availability_status"] = status

            materials.append(material)

        request["materials"] = materials
        result.append(request)

    return result
