from fastapi import APIRouter, HTTPException
from database import get_db_connection
from pydantic import BaseModel

router = APIRouter()


class ProductRegistration(BaseModel):
    IM_ID: int
    Manual: str | None = None



@router.get("/")
def get_products():
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    pm."PM_ID",
                    pm."IM_ID",
                    im."Item_Name",
                    im."SKU",
                    pm."Manual"
                FROM public."PRODUCT_MASTER" AS pm
                INNER JOIN public."ITEM_MASTER" AS im
                    ON pm."IM_ID" = im."IM_ID"
                ORDER BY pm."PM_ID";
                """
            )

            rows = sql_cursor.fetchall()

        # PUT THE RESPONSE MAPPING HERE
        return [
            {
                "PM_ID": row[0],
                "IM_ID": row[1],
                "Product_Name": row[2],
                "SKU": row[3],
                "Manual": row[4],
                "Availability": (
                    "Unavailable"
                    if row[4] and row[4].startswith("[RETIRED] ")
                    else "Available"
                )
            }
            for row in rows
        ]

    except Exception as error:
        print(f"Product retrieval error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve products."
        )

    finally:
        database_connection.close()


@router.get("/active")
def get_active_products():
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    pm."PM_ID",
                    im."Item_Name",
                    im."SKU"
                FROM public."PRODUCT_MASTER" AS pm
                INNER JOIN public."ITEM_MASTER" AS im
                    ON pm."IM_ID" = im."IM_ID"
                WHERE im.status = 'Active'
                  AND im."ItemType" = 'Finished'
                ORDER BY im."Item_Name";
                """
            )

            rows = sql_cursor.fetchall()

        return [
            {
                "PM_ID": row[0],
                "Product_Name": row[1],
                "SKU": row[2]
            }
            for row in rows
        ]

    except Exception as error:
        print(f"Active product retrieval error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve active products."
        )

    finally:
        database_connection.close()

@router.get("/inventory-items")
def get_inventory_items():
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                "IM_ID",
                "SKU",
                "Item_Name",
                "Description",
                "Category",
                "Brand",
                status
            FROM public."ITEM_MASTER"
            WHERE "ItemType" = 'Finished'
            AND status = 'Active'
            ORDER BY "Item_Name";
                """
            )

            rows = sql_cursor.fetchall()

        return [
        {
            "IM_ID": row[0],
            "SKU": row[1],
            "Item_Name": row[2],
            "Description": row[3],
            "Category": row[4],
            "Brand": row[5],
            "Status": row[6]
        }
        for row in rows
    ]

    except Exception as error:
        print(f"Inventory item retrieval error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve finished goods."
        )

    finally:
        database_connection.close()


@router.get("/{pm_id}/bom")
def get_product_bom(pm_id: int):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT
                    bom."BOM_ID",
                    bom."PM_ID",
                    bom."IM_ID",
                    im."Item_Name",
                    im."SKU",
                    bom."MaterialRequired",
                    im.unit_of_measure
                FROM public."BILL_OF_MATERIALS" AS bom
                INNER JOIN public."ITEM_MASTER" AS im
                    ON bom."IM_ID" = im."IM_ID"
                WHERE bom."PM_ID" = %s
                ORDER BY bom."BOM_ID";
                """,
                (pm_id,)
            )

            rows = sql_cursor.fetchall()

        return [
            {
                "BOM_ID": row[0],
                "PM_ID": row[1],
                "IM_ID": row[2],
                "Material_Name": row[3],
                "SKU": row[4],
                "MaterialRequired": row[5],
                "Unit": row[6]
            }
            for row in rows
        ]

    except Exception as error:
        print(f"BOM retrieval error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve BOM details."
        )

    finally:
        database_connection.close()

@router.post("/")
def register_product(product: ProductRegistration):
    database_connection = get_db_connection()

    try:
        with database_connection.cursor() as sql_cursor:
            sql_cursor.execute(
                """
                SELECT "ItemType", status
                FROM public."ITEM_MASTER"
                WHERE "IM_ID" = %s;
                """,
                (product.IM_ID,)
            )

            inventory_item = sql_cursor.fetchone()

            if not inventory_item:
                raise HTTPException(
                    status_code=404,
                    detail="Inventory item not found."
                )

            if inventory_item[0] != "Finished" or inventory_item[1] != "Active":
                raise HTTPException(
                    status_code=400,
                    detail="Only active finished items can be registered."
                )
            
            sql_cursor.execute(
                """
                INSERT INTO public."PRODUCT_MASTER"
                    ("IM_ID", "Manual")
                VALUES (%s, %s)
                RETURNING "PM_ID", "IM_ID", "Manual";
                """,
                (product.IM_ID, product.Manual)
            )

            row = sql_cursor.fetchone()

        database_connection.commit()

        return {
            "message": "Product successfully registered.",
            "PM_ID": row[0],
            "IM_ID": row[1],
            "Manual": row[2]
        }

    except HTTPException:
        database_connection.rollback()
        raise

    except Exception as error:
        database_connection.rollback()
        print(f"Product registration error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to register product."
        )

    finally:
        database_connection.close()