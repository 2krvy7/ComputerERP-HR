
1. System Architecture & Tech Stack

• System Name: ComputerERP (a 7-module unified ERP for a computer hardware manufacturing, assembly, and distribution company).
• My Role: Team 5 — Finance & Accounting Management Module
• Frontend: Next.js 16 (App Router, TypeScript .tsx, Client Components) running on http://localhost:3000.
• Backend: Python FastAPI (uvicorn, psycopg with dict_row, Pydantic BaseModel) running on http://127.0.0.1:8000 (or --host 0.0.0.0 --port 8000 for multi-laptop LAN demos).
• Database: Shared PostgreSQL database (public schema) connecting all 7 modules.

2. Core Finance Database Tables (public)

• Accounting & Ledger:
	• "ChartOfAccounts" (accountID, accountCode, accountName, accountType — Asset, Liability, Equity, Revenue, Expense).
	• "JournalEntry" (journalID, journalDate, referenceNo, sourceModule, description, sourceID).
	• "JournalEntryLine" (lineID, journalID, accountID, debit, credit).
	• "GeneralLedger" (ledgerID, accountID, journalID, debitAmount, creditAmount, runningBalance).
• Accounts Payable & Receivable:
	• "APInvoice" (apInvoiceID, piID, poID, supplierID, amount, totalPaid, remainingBalance, status, dueDate).
	• "APPayment" (paymentID, apInvoiceID, bankAccountID, paymentDate, amount).
	• "ARInvoice" (arInvoiceID, salesInvoiceID, customerID, amount, totalPaid, remainingBalance, status, dueDate).
	• "ARReceipt" (receiptID, arInvoiceID, bankAccountID, paymentDate, amount).
• Cash, Expenses & Payroll:
	• "BankAccount" (bankAccountID, bankName, accountNumber — live balance calculated dynamically as SUM(ARReceipt) - SUM(APPayment)).
	• "ProductionOrder" (productionID, productID, quantity, totalCost).
	• "Expense" (expenseID, accountID, productionID, postingID, amount).
	• "PayrollExpense" (payrollExpenseID, payroll_id, amount).

3. Connected Finance Modules & Pages

1. Chart of Accounts (/chart-of-accounts → routers/coa.py): Lists accounts, adds new accounts (POST /api/coa/), and supports red-highlighted Modify mode with checkboxes to Archive and Restore accounts.
2. Journal Entries & General Ledger (/journal-entries, /general-ledger → routers/journal.py, routers/ledger.py): Records double-entry debits and credits and displays running account balances.
3. AP Invoices (/accounts-payable/invoices → routers/apinvoices.py): Features an Awaiting Finance queue for incoming Procurement bills (GET /api/apinvoices/awaiting-finance), performs Three-Way Matching (PO + GoodsReceived + PurchaseInvoice), and sets payment due dates (POST /api/apinvoices/create-from-pi).
4. AP Payments (/accounts-payable/payments → routers/payments.py): Populates unpaid AP bills and Bank Accounts (GET /api/payments/options), allows typable full or partial payment amounts (POST /api/payments/), and updates APInvoice balances and status (Paid / Partial).
5. AR Invoices & Collections (/accounts-receivable/invoices, /collections → routers/arinvoices.py, routers/collections.py): Tracks customer receivables and records incoming collections into bank accounts.
6. Cash & Bank (/cash-bank/accounts, /transactions → routers/bank.py, routers/transactions.py): Tracks live bank balances and merges all ARReceipt inflows and APPayment outflows into a unified transaction ledger.
7. Expenses (/expenses → routers/expense.py): Tracks production costs (ProductionOrder), manual operating expenses, and payroll totals (PayrollExpense).
8. Financial Reports (/reports/... → routers/reports.py):
	• Trial Balance (/reports/trial-balance): Verifies Total Debits = Total Credits.
	• Income Statement (/reports/income-statement): Computes Revenue, COGS, Gross Profit, Operating Expenses, and Net Income.
	• Balance Sheet (/reports/balance-sheet): Verifies Assets = Liabilities + Equity (including current Net Income) and calculates Working Capital.
	• Cash Flow Statement (/reports/cash-flow): Tracks operating cash inflows (ARReceipt) minus outflows (APPayment).
	• AP Aging & AR Aging (/reports/ap-aging, /reports/ar-aging): Groups unpaid bills and customer invoices into Current, 1-30 Days, 31-60 Days, 61-90 Days, and 90+ Days overdue buckets.

4. Cross-Team Integrations (How Other Teams Connect to Finance)

• Team 1 (Procurement):
	• Saves bills into "PurchaseInvoice" (linked to "PurchaseOrder" for "SupplierID"), which automatically appear in Finance's Awaiting Finance tab.
	• Reads live payment status (Awaiting Finance, Unpaid, Partially Paid, Paid, Overdue) via GET /api/apinvoices/procurement-status.
• Team 3 (Production):
	• Pushes completed manufacturing batch costs to Finance via POST /api/expense/from-production ({ productionID, productID, quantity, totalCost, accountID }).
• Team 4 (Sales):
	• Pulls Finance's calculated floor price (unitCost = totalCost / quantity + 20% markup) via GET /api/expense/pricing-alerts?margin_pct=20 to prevent selling below minimum cost.
• Team 6 (HRIS & Payroll):
	• Sends finalized payroll totals via POST /api/expense/from-payroll ({ payroll_id, amount }), which Finance disburses from BankAccount via POST /api/expense/pay-payroll.

5. Key Project Rules

• Always include explicit comments above every fetch() call showing the HTTP method, endpoint, backend router file, and database tables involved.
• Split long code files into short modular parts so nothing is truncated when copying.
• In Next.js 16 Client Components ("use client"), always set new Date() inside useEffect() rather than during render or useMemo().
• Always double-quote camelCase/PascalCase table and column names in PostgreSQL SQL queries ("ChartOfAccounts", "accountID").