import json
import logging
import os
from decimal import Decimal, InvalidOperation
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import HTTPException, status


logger = logging.getLogger(__name__)


def fetch_finance_pricing_alerts() -> list[dict] | None:
    finance_api_url = os.getenv("FINANCE_API_URL", "").strip().rstrip("/")

    if not finance_api_url:
        logger.warning(
            "FINANCE_API_URL is not configured; skipping Finance price-floor validation."
        )
        return None

    url = (
        f"{finance_api_url}/api/expense/pricing-alerts"
        "?margin_pct=20"
    )

    try:
        with urlopen(url, timeout=3) as response:
            alerts = json.loads(response.read().decode("utf-8"))

        if not isinstance(alerts, list):
            raise ValueError("Finance pricing alerts response must be a list.")

        return alerts
    except (URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError) as exc:
        # Match the supplied policy: allow invoice creation if Finance is offline.
        logger.warning("Finance price-floor lookup failed; allowing invoice: %s", exc)
        return None


def validate_sales_price_against_finance(
    product_id: int,
    proposed_vat_ex_price: Decimal,
    alerts: list[dict] | None,
) -> None:
    if alerts is None:
        return

    for item in alerts:
        try:
            alert_product_id = int(item.get("productID"))
        except (AttributeError, TypeError, ValueError):
            continue

        if alert_product_id != product_id:
            continue

        try:
            floor_price = Decimal(str(item.get("minSellingPrice") or "0"))
        except (InvalidOperation, TypeError, ValueError):
            logger.warning(
                "Finance returned an invalid floor price for product %s; allowing invoice.",
                product_id,
            )
            return

        if proposed_vat_ex_price < floor_price:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Price {proposed_vat_ex_price:.2f} is below Finance minimum "
                    f"floor price ({floor_price:.2f} VAT-Ex)."
                ),
            )

        return
