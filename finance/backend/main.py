from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.coa import router as coa_router
from routers.journal import router as journal_router
from routers.ledger import router as ledger_router
from routers.apinvoices import router as apinvoices_router
from routers.payments import router as payments_router
from routers.ar import router as ar_router
from routers.bank import router as bank_router
from routers.expense import router as expense_router
from routers.reports import router as reports_router
from routers.dashboard import router as dashboard_router



app = FastAPI(title="Finance ERP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(coa_router)
app.include_router(journal_router)
app.include_router(ledger_router)

app.include_router(apinvoices_router)
app.include_router(payments_router)
app.include_router(ar_router)
app.include_router(bank_router)
app.include_router(expense_router)
app.include_router(reports_router)
app.include_router(dashboard_router)

@app.get("/")
def home():
    return {
        "message": "Finance ERP API Running"
    }