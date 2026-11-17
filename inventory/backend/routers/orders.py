
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from database import get_db_connection
from psycopg.rows import dict_row


router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)


class GoodsReceivedInspection(BaseModel):
    quantity_received: int = Field(..., ge=0)
    remarks: Optional[str] = None
    logged_by: str
    reorder_level: Optional[int] = Field(default=None, ge=0)

class RestockRequestApproval(BaseModel):
    approved_by: str

class StockReorderLevelUpdate(BaseModel):
    reorder_level: int = Field(..., ge=0)


@router.get("/upcoming-requests")
def get_upcoming_requests():
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
                    END AS "stock_status"
                FROM "STOCK" s
                JOIN "ITEM_MASTER" im
                    ON s."IM_ID" = im."IM_ID"
                JOIN "WAREHOUSE" w
                    ON s."WH_ID" = w."WH_ID"
                WHERE im."ItemType" = 'Raw'
                  AND s."WH_ID" IN (1, 7)
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


@router.put("/stock/{stock_id}/reorder-level")
def update_stock_reorder_level(
    stock_id: int,
    update: StockReorderLevelUpdate
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

@router.get("/incoming-requests")
def get_incoming_requests():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

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
            ORDER BY rr."issued" DESC
        """)

        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]

        results = [
            dict(zip(columns, row))
            for row in rows
        ]

        cur.close()
        conn.close()

        return results

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.put("/upcoming-requests/{rr_id}/approve")
def approve_restock_request(
    rr_id: int,
    approval: RestockRequestApproval
):
    conn = get_db_connection()

    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                UPDATE "RestockRequest"
                SET
                    "status" = 'Approved',
                    "approved_by" = %s,
                    "approved_date" = CURRENT_TIMESTAMP
                WHERE "RR_ID" = %s
                  AND (
                      "status" IS NULL
                      OR "status" = 'Pending'
                  )
                RETURNING
                    "RR_ID",
                    "IM_ID",
                    "Quantity",
                    "WH_ID",
                    "status",
                    "approved_by",
                    "approved_date"
            """, (
                approval.approved_by,
                rr_id
            ))

            result = cur.fetchone()

            if result is None:
                conn.rollback()

                raise HTTPException(
                    status_code=404,
                    detail="Request not found or it has already been approved."
                )

        conn.commit()

        return {
            "message": "Restock Request approved and sent to Procurement.",
            "request": result
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
        conn.close()

@router.get("/purchase-requests")
def get_purchase_requests():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

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

        results = [
            dict(zip(columns, row))
            for row in rows
        ]

        cur.close()
        conn.close()

        return results

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/purchase-orders")
def get_purchase_orders():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

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

        results = [
            dict(zip(columns, row))
            for row in rows
        ]

        cur.close()
        conn.close()

        return results

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.get("/goods-received")
def get_goods_received():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

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
                WHEN gr."ItemCondition" IS NULL
                    THEN 'Pending Inspection'
                ELSE 'Inspected'
            END AS "InspectionStatus"
        FROM "GoodsReceived" gr
        LEFT JOIN "STOCK_LEDGER" sl
            ON sl."ReferenceNo" = 'GR-' || gr."GR_ID"::text
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

        results = [
            dict(zip(columns, row))
            for row in rows
        ]

        cur.close()
        conn.close()

        return results

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.put("/goods-received/{gr_id}/confirm-count")
def confirm_goods_received(
    gr_id: int,
    inspection: GoodsReceivedInspection
):
    conn = get_db_connection()

    try:
        with conn.cursor() as cur:

            # Get the item and warehouse linked to this delivery
            cur.execute("""
                SELECT
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
                    detail="Goods Received record or its linked item and warehouse was not found."
                )

            im_id = stock_info[0]
            wh_id = stock_info[1]
            original_quantity = stock_info[2]

            accepted_quantity = inspection.quantity_received

            if accepted_quantity > original_quantity:
                raise HTTPException(
                    status_code=400,
                    detail="Accepted quantity cannot be greater than the original delivered quantity."
                )

            # Automatically determine item condition
            if accepted_quantity == original_quantity:
                item_condition = "Good"
            elif accepted_quantity == 0:
                item_condition = "Damaged"
            else:
                item_condition = "Partial"

            # Prevent duplicate Stock In for the same GoodsReceived record
            reference_no = f"GR-{gr_id}"

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
                    detail="This Goods Received record has already been processed."
                )

            # Update inspection details without changing original delivered quantity
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
            
            # Add accepted quantity to STOCK
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
                            detail="Reorder level is required when creating a new stock record."
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


            # Record original and accepted quantities in STOCK_LEDGER
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
                    %s, %s, 'STOCK_IN', %s, %s, %s, %s,
                    CURRENT_TIMESTAMP, %s
                )
                RETURNING "LogID"
            """, (
                im_id,
                wh_id,
                original_quantity,
                accepted_quantity,
                reference_no,
                inspection.logged_by,
                inspection.remarks
            ))

            ledger_result = cur.fetchone()

            conn.commit()

            return {
            "message": "Inspection count confirmed successfully.",
            "GR_ID": result[0],
            "PO_ID": result[1],
            "DeliveredQuantity": original_quantity,
            "AcceptedQuantity": accepted_quantity,
            "ItemCondition": result[3],
            "Remarks": result[4],
            "Stock": updated_stock,
            "LogID": ledger_result[0] if ledger_result else None
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
        conn.close()
