
import os
import json
import urllib.request
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException


FINANCE_API_URL = os.getenv("FINANCE_API_URL", "").rstrip("/")
FINANCE_PRICING_ALERTS_URL = (
    f"{FINANCE_API_URL}/api/expense/pricing-alerts"
    if FINANCE_API_URL
    else None
)


def get_finance_pricing_alerts() -> list[dict]:
    """
    Fetches Finance pricing alerts.

    Finance endpoint:
    GET /api/expense/pricing-alerts

    Returns the Finance pricing alerts.
    """

    if not FINANCE_PRICING_ALERTS_URL:
        raise HTTPException(
            status_code=503,
            detail="Finance API URL is not configured. Set FINANCE_API_URL.",
        )

    try:
        request = urllib.request.Request(
            FINANCE_PRICING_ALERTS_URL,
            headers={"Accept": "application/json"},
            method="GET",
        )

        with urllib.request.urlopen(request, timeout=5) as response:
            alerts = json.loads(response.read().decode("utf-8"))

        if not isinstance(alerts, list):
            raise ValueError("Invalid Finance pricing alerts response.")

        return alerts

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to retrieve minimum selling prices from Finance: {str(exc)}",
        )


def get_finance_minimum_selling_price(product_id: int) -> Decimal:
    """
    Gets the VAT-exclusive minimum selling price for a product.

    Matches Finance productID with Sales ITEM_MASTER.IM_ID.
    """

    alerts = get_finance_pricing_alerts()

    for item in alerts:
        if item.get("productID") is None:
            continue

        try:
            finance_product_id = int(item["productID"])
        except (TypeError, ValueError):
            continue

        if finance_product_id != product_id:
            continue

        try:
            floor_price = Decimal(str(item.get("minSellingPrice") or 0))
        except (InvalidOperation, TypeError, ValueError):
            raise HTTPException(
                status_code=502,
                detail="Finance returned an invalid minimum selling price.",
            )

        if not floor_price.is_finite() or floor_price < 0:
            raise HTTPException(
                status_code=502,
                detail="Finance returned an invalid minimum selling price.",
            )

        return floor_price

    raise HTTPException(
        status_code=404,
        detail=f"No Finance minimum selling price found for product ID {product_id}.",
    )


def validate_sales_price_against_finance(
    product_id: int,
    proposed_vat_ex_price: Decimal | float,
):
    """
    Blocks invoice creation when the proposed VAT-exclusive
    unit price is below Finance's minimum selling price.
    """

    floor_price = get_finance_minimum_selling_price(product_id)
    proposed_price = Decimal(str(proposed_vat_ex_price))

    if proposed_price < floor_price:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Price {proposed_price:.2f} is below Finance minimum "
                f"floor price ({floor_price:.2f} VAT-Exclusive)."
            ),
        )
