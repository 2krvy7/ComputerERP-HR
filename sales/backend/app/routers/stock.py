
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_password_change_completed
from app.models.stock import Stock
from app.models.item_master import ItemMaster


router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(require_password_change_completed)],
)


@router.get("/on-hand-stocks")
def get_on_hand_stocks(
    db: Session = Depends(get_db),
):
    statement = (
        select(
            ItemMaster.IM_ID,
            ItemMaster.SKU,
            ItemMaster.Item_Name,
            ItemMaster.Category,
            ItemMaster.unit_of_measure,
            func.coalesce(
                func.sum(Stock.quantity_on_hand), 0
            ).label("quantity_on_hand"),
            func.coalesce(
                func.sum(Stock.quantity_reserved), 0
            ).label("quantity_reserved"),
            func.coalesce(
                func.sum(Stock.reorder_level), 0
            ).label("reorder_level"),
        )
        .outerjoin(
            Stock,
            Stock.IM_ID == ItemMaster.IM_ID,
        )
        .where(
    func.lower(
        func.trim(
            func.coalesce(ItemMaster.ItemType, "")
        )
    ) == "Finished",
    (func.coalesce(Stock.quantity_on_hand, 0) -
     func.coalesce(Stock.quantity_reserved, 0)) > 0
)
        .group_by(
            ItemMaster.IM_ID,
            ItemMaster.SKU,
            ItemMaster.Item_Name,
            ItemMaster.Category,
            ItemMaster.unit_of_measure,
        )
        .order_by(ItemMaster.Item_Name.asc())
    )

    results = db.execute(statement).all()

    stocks = []

    for row in results:
        on_hand = int(row.quantity_on_hand or 0)
        reserved = int(row.quantity_reserved or 0)
        reorder_level = int(row.reorder_level or 0)

        available = on_hand - reserved

        if available <= 0:
            stock_status = "Out of Stock"
        elif available <= reorder_level:
            stock_status = "Low Stock"
        else:
            stock_status = "In Stock"

        stocks.append({
            "IM_ID": row.IM_ID,
            "SKU": row.SKU,
            "Item_Name": row.Item_Name,
            "Category": row.Category,
            "unit_of_measure": row.unit_of_measure,
            "quantity_on_hand": on_hand,
            "quantity_reserved": reserved,
            "available_stock": available,
            "reorder_level": reorder_level,
            "status": stock_status,
        })

    return stocks
