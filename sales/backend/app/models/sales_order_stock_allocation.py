
from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SalesOrderStockAllocation(Base):
    __tablename__ = "sales_order_stock_allocation"

    __table_args__ = (
        UniqueConstraint(
            "order_detail_id",
            "stock_id",
            name="uq_order_detail_stock",
        ),
    )

    allocation_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    order_detail_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "sales_order_detail.order_detail_id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    stock_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("STOCK.STOCK_ID"),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
