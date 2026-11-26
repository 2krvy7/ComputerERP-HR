import os
import json
import urllib.request
from fastapi import HTTPException

FINANCE_API_URL = os.getenv(
    "FINANCE_API_URL",
    "https://vercel.app",
).rstrip("/")


def validate_sales_price_against_finance(product_id: int, proposed_vat_ex_price: float):
    """
    EXACT FETCH PATH: GET {FINANCE_API_URL}/api/expense/pricing-alerts
    BACKEND ROUTE: finance/backend/routers/expense.py -> get_pricing_alerts()
    DATABASE TABLES: Reads "ProductionOrder" / "Expense"
    PURPOSE: Blocks Sales from creating an invoice below Finance's VAT-exclusive minimum floor price
    """
    try:
        with urllib.request.urlopen(f"{FINANCE_API_URL}/api/expense/pricing-alerts", timeout=5) as resp:
            alerts = json.loads(resp.read().decode())
    except Exception:
        return  # Do not block checkout if Finance service is temporarily unreachable

    for item in alerts:
        if item.get("productID") == product_id:
            floor_price = float(item.get("minSellingPrice") or 0)
            if proposed_vat_ex_price < floor_price:
                raise HTTPException(
                    status_code=400,
                    detail=f"Price {proposed_vat_ex_price:.2f} is below Finance minimum floor price ({floor_price:.2f} VAT-Ex).",
                )
            break
