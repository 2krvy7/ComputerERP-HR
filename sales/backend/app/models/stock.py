from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Stock(Base):
    __tablename__ = "STOCK"

    STOCK_ID: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    IM_ID: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ITEM_MASTER.IM_ID"),
        nullable=False,
    )

    WH_ID: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("WAREHOUSE.WH_ID"),
        nullable=False,
    )

    quantity_on_hand: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    reorder_level: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )