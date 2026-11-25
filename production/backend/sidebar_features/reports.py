from fastapi import APIRouter, HTTPException
from database import get_db_connection

router = APIRouter()

# PRODUCTION SUMMARY REPORT
@router.get("/production-summary/")
def get_production_summary():

    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:

            # Overall production statistics
            sql_cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_production_runs,

                    COALESCE(
                        SUM("QuantityRequired"), 0
                    ) AS total_quantity_required,

                    COALESCE(
                        SUM("QuantityProduced"), 0
                    ) AS total_quantity_produced,

                    COALESCE(
                        SUM(
                            GREATEST(
                                "QuantityRequired" - "QuantityProduced",
                                0
                            )
                        ), 0
                    ) AS remaining_quantity

                FROM public."PRODUCTION";
                """
            )

            summary = sql_cursor.fetchone()

            # Production status breakdown
            sql_cursor.execute(
                """
                SELECT
                    COALESCE(status, 'Unspecified') AS production_status,
                    COUNT(*) AS total_runs
                FROM public."PRODUCTION"
                GROUP BY status
                ORDER BY production_status;
                """
            )

            status_rows = sql_cursor.fetchall()

        return {
            "total_production_runs": summary[0],
            "total_quantity_required": summary[1],
            "total_quantity_produced": summary[2],
            "remaining_quantity": summary[3],

            "status_breakdown": [
                {
                    "status": row[0],
                    "total_runs": row[1]
                }
                for row in status_rows
            ]
        }

    except Exception as error:
        print(f"Production report error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve production report."
        )

    finally:
        database_connection.close()


# PRODUCT PRODUCTION COMPARISON REPORT
@router.get("/product-comparison/")
def get_product_comparison():

    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:

            sql_cursor.execute(
                """
                SELECT
                    im."Item_Name",
                    COALESCE(SUM(p."QuantityProduced"), 0) AS total_produced
                FROM public."PRODUCTION" p
                JOIN public."PRODUCT_MASTER" pm
                    ON p."PM_ID" = pm."PM_ID"
                JOIN public."ITEM_MASTER" im
                    ON pm."IM_ID" = im."IM_ID"
                WHERE im."status" = 'Active'
                GROUP BY im."IM_ID", im."Item_Name"
                ORDER BY im."Item_Name";
                """
            )

            rows = sql_cursor.fetchall()

        return [
            {
                "item_name": row[0],
                "total_produced": row[1]
            }
            for row in rows
        ]

    except Exception as error:
        print(f"Product comparison report error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve product comparison report."
        )

    finally:
        database_connection.close()
