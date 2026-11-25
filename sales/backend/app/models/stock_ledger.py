
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StockLedger(Base):
    __tablename__ = "STOCK_LEDGER"

    LogID: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
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

    Target_WH_ID: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("WAREHOUSE.WH_ID"),
        nullable=True,
    )

    TransactionType: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    Quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    ActualQuantity: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    ReferenceNo: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    LoggedBy: Mapped[str] = mapped_column(
        String,
        ForeignKey('"User"."UserID"'),
        nullable=False,
    )

    ApprovedBy: Mapped[str | None] = mapped_column(
        String,
        ForeignKey('"User"."UserID"'),
        nullable=True,
    )

    LogDate: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    Remarks: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )
