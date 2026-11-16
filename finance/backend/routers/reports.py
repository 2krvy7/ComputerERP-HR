from fastapi import APIRouter

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"]
)

@router.get("/trial-balance")
def trial_balance():
    return {
        "report": "Trial Balance"
    }

@router.get("/income-statement")
def income_statement():
    return {
        "report": "Income Statement"
    }

@router.get("/balance-sheet")
def balance_sheet():
    return {
        "report": "Balance Sheet"
    }

@router.get("/cash-flow")
def cash_flow():
    return {
        "report": "Cash Flow"
    }