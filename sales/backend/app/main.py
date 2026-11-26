
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import DATABASE_URL

# Models
from app.models.customer import Customer
from app.models.item_master import ItemMaster
from app.models.sales_quotation import SalesQuotation
from app.models.sales_quotation_detail import SalesQuotationDetail
from app.models.sales_order import SalesOrder
from app.models.sales_order_detail import SalesOrderDetail
from app.models.warehouse import Warehouse
from app.models.delivery import Delivery
from app.models.sales_invoice import SalesInvoice
from app.models.accounts_receivable import AccountsReceivable
from app.models.payment_collection import PaymentCollection
from app.models.sales_return import SalesReturn

# Authentication models
from app.models.user import User

# Routers
from app.routers.customers import router as customers_router
from app.routers.sales_quotations import router as quotations_router
from app.routers.sales_orders import router as orders_router
from app.routers.deliveries import router as deliveries_router
from app.routers.sales_invoice import router as invoice_router
from app.routers.accounts_receivable import router as accounts_receivable_router
from app.routers.payment_collection import router as payment_collection_router
from app.routers.sales_return import router as sales_return_router

# Authentication routers
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router


app = FastAPI(
    title="Sales Module ERP API",
    description="Backend API for Sales and Customer Management",
    version="1.0.0",
)


# CORS configuration
DEFAULT_ALLOWED_ORIGINS = [
    "https://sales-kenethvivas22.vercel.app",
    "https://sales-pink-iota.vercel.app",
    "https://computer-erp-login.vercel.app",
    "http://localhost:3000",
]

environment_origins = os.getenv("FRONTEND_ORIGINS", "")

ALLOWED_ORIGINS = list(
    dict.fromkeys(
        origin.strip().rstrip("/")
        for origin in [
            *environment_origins.split(","),
            *DEFAULT_ALLOWED_ORIGINS,
        ]
        if origin.strip()
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Accept",
        "Authorization",
        "Content-Type",
        "Origin",
        "X-Requested-With",
    ],
    expose_headers=[
        "Content-Disposition",
    ],
    max_age=600,
)


# Authentication endpoints
app.include_router(auth_router)
app.include_router(users_router)


# ERP endpoints
app.include_router(customers_router)
app.include_router(quotations_router)
app.include_router(orders_router)
app.include_router(deliveries_router)
app.include_router(invoice_router)
app.include_router(accounts_receivable_router)
app.include_router(payment_collection_router)
app.include_router(sales_return_router)


@app.get("/")
def home():
    return {
        "message": "Sales Module ERP API is running",
        "database": "configured" if DATABASE_URL else "not configured",
    }
