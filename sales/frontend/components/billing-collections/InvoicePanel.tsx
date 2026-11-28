
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  invoiceAPI,
  salesOrderAPI,
  accountsReceivableAPI,
} from "../../lib/api";

import type {
  SalesInvoice,
  SalesInvoiceCreate,
} from "../../types/invoice";

import type {
  SalesOrder,
  SalesOrderItem,
} from "../../types/order";

import type { AccountsReceivable } from "../../types/accounts-receivable";

const PAGE_SIZE = 10;

const INTEREST_RATES: Record<number, number> = {
  1: 0,
  3: 3,
  6: 5,
  12: 10,
};

const STATUS_STYLES: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-700",
  "Partially Paid": "bg-amber-100 text-amber-700",
  Unpaid: "bg-slate-100 text-slate-700",
  Overdue: "bg-red-100 text-red-700",
  "AR Not Found": "bg-gray-100 text-gray-600",
};

const money = (amount: string | number) =>
  `₱${Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "—").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "—";
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "—";
  }

  return date.toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function calculateDueDate(invoiceDate: string, months: number) {
  if (!invoiceDate) return "";

  const [year, month, day] = invoiceDate.split("-").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return "";
  }

  const date = new Date(year, month - 1, 1);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1
  ) {
    return "";
  }

  const targetYear = year + Math.floor((month - 1 + months) / 12);
  const targetMonth = (month - 1 + months) % 12;

  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const dueDay = Math.min(day, lastDay);

  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(
    dueDay
  ).padStart(2, "0")}`;
}

function SummaryCard({
  label,
  value,
  description,
  valueColor = "text-slate-900",
}: {
  label: string;
  value: string | number;
  description: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>

      <p className={`mt-2 text-2xl font-bold tracking-tight ${valueColor}`}>
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-600">{description}</p>
    </div>
  );
}

export default function InvoicePanel() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);

  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printingInvoiceId, setPrintingInvoiceId] = useState<number | null>(
    null
  );

  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [today, setToday] = useState("");


  useEffect(() => {
    const currentDate = getLocalDate();

    setToday(currentDate);
    setInvoiceDate(currentDate);
  }, []);

  const selectedOrder = orders.find((item) => item.order_id === Number(orderId));
  const selectedMonths = selectedOrder?.installment_months ?? 1;
  const interestRate = INTEREST_RATES[selectedMonths] ?? 0;
  const orderAmount = Number(selectedOrder?.total_amount ?? 0) || 0;
  const taxType = selectedOrder?.tax_type ?? "VAT";
  const taxRate = Number(selectedOrder?.tax_rate ?? 12);

  const interestAmount = Number(
    ((orderAmount * interestRate) / 100).toFixed(2)
  );

  const taxAmount = Number(
    selectedOrder?.tax_amount ?? ((orderAmount * taxRate) / 100).toFixed(2)
  );

  const finalInvoiceAmount =
    orderAmount + interestAmount + taxAmount;

  const getInvoiceStatus = (invoice: SalesInvoice) => {
    const ar = receivables.find(
      (record) => record.invoice_id === invoice.invoice_id
    );

    if (!ar) return "AR Not Found";

    const amountPaid = Number(ar.amount_paid) || 0;
    const balance = Number(ar.balance) || 0;

    if (balance <= 0) return "Paid";

    if (
      invoice.due_date &&
      today &&
      invoice.due_date.slice(0, 10) < today
    ) {
      return "Overdue";
    }

    if (amountPaid > 0) return "Partially Paid";

    return "Unpaid";
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [invoiceData, orderData, arData] = await Promise.all([
        invoiceAPI.getAll(),
        salesOrderAPI.getAll(),
        accountsReceivableAPI.getAll(),
      ]);

      setInvoices(invoiceData);
      setOrders(orderData);
      setReceivables(arData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const invoicedOrderIds = useMemo(
    () => new Set(invoices.map((invoice) => invoice.order_id)),
    [invoices]
  );

  const availableOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          !invoicedOrderIds.has(order.order_id) &&
          ["Accepted", "Approved", "Processing", "Completed"].includes(order.status)
      ),
    [orders, invoicedOrderIds]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(invoices.length / PAGE_SIZE)
  );

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;

    return invoices.slice(startIndex, startIndex + PAGE_SIZE);
  }, [invoices, currentPage]);

  const totalInvoiced = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total_due),
    0
  );

  const totalTax = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.tax_amount ?? 0),
    0
  );

  const overdueInvoices = invoices.filter(
    (invoice) => getInvoiceStatus(invoice) === "Overdue"
  ).length;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function resetForm() {
    if (saving) return;

    setOrderId("");
    setInvoiceDate(today);
    setShowForm(false);
    setError("");
  }

  async function handleCreateInvoice() {
    setError("");

    if (!orderId) {
      setError("Please select a sales order.");
      return;
    }

    if (!invoiceDate) {
      setError("Please select an invoice date.");
      return;
    }

    const calculatedDueDate = calculateDueDate(
      invoiceDate,
      selectedMonths
    );

    if (!calculatedDueDate) {
      setError("Unable to calculate the invoice due date.");
      return;
    }

    const data: SalesInvoiceCreate = {
      order_id: Number(orderId),
      invoice_date: invoiceDate,
      due_date: calculatedDueDate,
      installment_months: selectedMonths as 1 | 3 | 6 | 12,
    };

    setSaving(true);

    try {
      await invoiceAPI.create(data);

      setOrderId("");
      setInvoiceDate(today);
      setShowForm(false);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintInvoice(invoice: SalesInvoice) {
    if (printingInvoiceId !== null) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      setError("Please allow pop-ups to print the invoice.");
      return;
    }

    setPrintingInvoiceId(invoice.invoice_id);
    setError("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice SI-${String(invoice.invoice_id).padStart(4, "0")}</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 30px;">
          <p>Preparing invoice...</p>
        </body>
      </html>
    `);
    printWindow.document.close();

    try {
      const [order, catalogItems] = await Promise.all([
        salesOrderAPI.getById(invoice.order_id),
        salesOrderAPI.getItems(),
      ]);

      const itemMap = new Map<number, SalesOrderItem>(
        catalogItems.map((item) => [item.IM_ID, item])
      );

      const orderDetails = order.details ?? [];

      const lineItemsHtml = orderDetails.length
        ? orderDetails
            .map((detail) => {
              const product = itemMap.get(detail.IM_ID);

              return `
                <tr>
                  <td>${escapeHtml(product?.SKU ?? `Item ${detail.IM_ID}`)}</td>
                  <td>${escapeHtml(product?.Item_Name ?? `Item ${detail.IM_ID}`)}</td>
                  <td class="center">${escapeHtml(detail.quantity)}</td>
                  <td class="right">${escapeHtml(money(detail.unit_price))}</td>
                  <td class="right">${escapeHtml(money(detail.discount))}</td>
                  <td class="right">${escapeHtml(money(detail.line_total))}</td>
                </tr>
              `;
            })
            .join("")
        : `
          <tr>
            <td colspan="6" class="center">No order item details available.</td>
          </tr>
        `;

      const installmentLabel =
        invoice.installment_months === 12
          ? "1 Year"
          : `${invoice.installment_months} Month${invoice.installment_months > 1 ? "s" : ""}`;

      const subtotal = Number(order.total_amount) || 0;
      const interest = Number(invoice.interest_amount) || 0;
      const invoiceTax = Number(invoice.tax_amount ?? 0);
      const invoiceTaxRate = Number(invoice.tax_rate ?? 0);
      const invoiceTaxType = invoice.tax_type ?? "Non-VAT";
      const total = Number(invoice.total_due) || 0;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Invoice SI-${String(invoice.invoice_id).padStart(4, "0")}</title>

            <style>
              * { box-sizing: border-box; }

              body {
                margin: 0;
                padding: 35px;
                font-family: Arial, Helvetica, sans-serif;
                color: #24363B;
                font-size: 13px;
              }

              .invoice {
                max-width: 850px;
                margin: 0 auto;
              }

              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding-bottom: 25px;
                border-bottom: 3px solid #315F68;
              }

              .company {
                font-size: 23px;
                font-weight: bold;
                color: #315F68;
              }

              .subtitle {
                margin-top: 5px;
                color: #64748b;
                font-size: 12px;
              }

              .invoice-title { text-align: right; }

              .invoice-title h1 {
                margin: 0;
                font-size: 28px;
                letter-spacing: 2px;
              }

              .invoice-number {
                margin-top: 8px;
                font-weight: bold;
                color: #315F68;
              }

              .details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 30px;
                margin: 30px 0;
              }

              .section-title {
                margin-bottom: 12px;
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 1px;
                color: #64748b;
                text-transform: uppercase;
              }

              .detail-row, .total-row {
                display: flex;
                justify-content: space-between;
                gap: 15px;
                margin: 8px 0;
              }

              .detail-row strong { text-align: right; }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 25px;
              }

              thead {
                background: #315F68;
                color: white;
              }

              th, td {
                padding: 11px 9px;
                border-bottom: 1px solid #dce7ea;
                text-align: left;
              }

              th { font-size: 11px; }

              .center { text-align: center; }
              .right { text-align: right; }

              .totals {
                width: 350px;
                margin: 25px 0 0 auto;
              }

              .grand-total {
                margin-top: 8px;
                padding: 14px;
                background: #e6f0f0;
                border-top: 2px solid #315F68;
                font-size: 17px;
                font-weight: bold;
              }

              .footer {
                margin-top: 60px;
                padding-top: 18px;
                border-top: 1px solid #dce7ea;
                text-align: center;
                color: #64748b;
                font-size: 11px;
              }

              .print-actions {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin-bottom: 25px;
              }

              .print-actions button {
                padding: 10px 22px;
                border: none;
                border-radius: 6px;
                background: #315F68;
                color: white;
                font-weight: bold;
                cursor: pointer;
              }

              .print-actions button:last-child {
                background: #64748b;
              }

              @media print {
                body { padding: 0; }
                .print-actions { display: none; }
                .invoice { max-width: none; }
              }

              @page {
                size: A4;
                margin: 15mm;
              }
            </style>
          </head>

          <body>
            <div class="print-actions">
              <button onclick="window.print()">Print Invoice</button>
              <button onclick="window.close()">Close</button>
            </div>

            <main class="invoice">
              <header class="header">
                <div>
                  <div class="company">SALES ERP</div>
                  <div class="subtitle">Sales Management System</div>
                </div>

                <div class="invoice-title">
                  <h1>INVOICE</h1>
                  <div class="invoice-number">
                    SI-${String(invoice.invoice_id).padStart(4, "0")}
                  </div>
                </div>
              </header>

              <section class="details">
                <div>
                  <div class="section-title">Customer Information</div>

                  <div class="detail-row">
                    <span>Customer ID</span>
                    <strong>${escapeHtml(order.customer_id)}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Sales Order</span>
                    <strong>SO-${String(order.order_id).padStart(4, "0")}</strong>
                  </div>
                </div>

                <div>
                  <div class="section-title">Invoice Information</div>

                  <div class="detail-row">
                    <span>Invoice Date</span>
                    <strong>${escapeHtml(formatDate(invoice.invoice_date))}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Due Date</span>
                    <strong>${escapeHtml(formatDate(invoice.due_date))}</strong>
                  </div>

                  <div class="detail-row">
                    <span>Installment</span>
                    <strong>${escapeHtml(installmentLabel)}</strong>
                  </div>
                </div>
              </section>

              <div class="section-title">Invoice Items</div>

              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th class="center">Qty</th>
                    <th class="right">Unit Price</th>
                    <th class="right">Discount</th>
                    <th class="right">Line Total</th>
                  </tr>
                </thead>

                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>

              <section class="totals">
                <div class="total-row">
                  <span>Sales Order Amount</span>
                  <strong>${escapeHtml(money(subtotal))}</strong>
                </div>

                <div class="total-row">
                  <span>Tax Type</span>
                  <strong>${escapeHtml(invoiceTaxType)}</strong>
                </div>

                <div class="total-row">
                  <span>Tax Rate</span>
                  <strong>${escapeHtml(invoiceTaxRate.toFixed(2))}%</strong>
                </div>

                <div class="total-row">
                  <span>Tax Amount</span>
                  <strong>${escapeHtml(money(invoiceTax))}</strong>
                </div>

                <div class="total-row">
                  <span>Interest Rate</span>
                  <strong>${escapeHtml(Number(invoice.interest_rate).toFixed(2))}%</strong>
                </div>

                <div class="total-row">
                  <span>Interest Amount</span>
                  <strong>${escapeHtml(money(interest))}</strong>
                </div>

                <div class="total-row grand-total">
                  <span>Total Due</span>
                  <span>${escapeHtml(money(total))}</span>
                </div>
              </section>

              <footer class="footer">
                <p>Thank you for your purchase!</p>
                <p>This document was generated by Sales ERP.</p>
              </footer>
            </main>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    } catch (err) {
      printWindow.close();

      setError(
        err instanceof Error
          ? `Unable to prepare invoice for printing: ${err.message}`
          : "Unable to prepare invoice for printing."
      );
    } finally {
      setPrintingInvoiceId(null);
    }
  }

  return (
    <div className="min-h-full space-y-5 bg-green-50 text-slate-800">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Invoices"
          value={invoices.length}
          description="Recorded sales invoices"
        />

        <SummaryCard
          label="Total Invoiced Amount"
          value={money(totalInvoiced)}
          description="Combined invoice value including tax and interest"
        />

        <SummaryCard
          label="Total Tax Amount"
          value={money(totalTax)}
          description="Tax recorded on sales invoices"
        />

        <SummaryCard
          label="Overdue Invoices"
          value={overdueInvoices}
          description="Invoices past their due date"
          valueColor="text-red-600"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-[#D1D5DB] p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-900">
              Sales Invoice List
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              View and manage invoices generated from sales orders.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setShowForm(true);
            }}
            disabled={availableOrders.length === 0 || loading || !today}
            className="whitespace-nowrap rounded-lg bg-green-900 px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add Sales Invoice
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-[#D1D5DB] text-slate-700">
              <tr>
                <th className="px-4 py-4 text-center font-semibold">
                  Invoice No.
                </th>
                <th className="px-4 py-4 text-center font-semibold">
                  Order No.
                </th>
                <th className="px-4 py-4 text-center font-semibold">
                  Invoice Date
                </th>
                <th className="px-4 py-4 text-center font-semibold">
                  Due Date
                </th>
                <th className="px-4 py-4 text-right font-semibold">
                  Total Due
                </th>
                <th className="px-4 py-4 text-center font-semibold">
                  Status
                </th>
                <th className="px-4 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#D1D5DB]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-600">
                    Loading invoices...
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-600">
                    No sales invoices found.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => {
                  const invoiceStatus = getInvoiceStatus(invoice);

                  return (
                    <tr
                      key={invoice.invoice_id}
                      className="transition hover:bg-[#DDE1E5]"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-center font-semibold text-slate-900">
                        SI-{String(invoice.invoice_id).padStart(4, "0")}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                        SO-{String(invoice.order_id).padStart(4, "0")}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                        {formatDate(invoice.invoice_date)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-center text-slate-700">
                        {formatDate(invoice.due_date)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-900">
                        {money(invoice.total_due)}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                            STATUS_STYLES[invoiceStatus] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {invoiceStatus}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => void handlePrintInvoice(invoice)}
                          disabled={printingInvoiceId !== null}
                          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-[#315F68] bg-white px-3 py-2 text-xs font-semibold text-[#315F68] transition hover:bg-[#315F68] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span aria-hidden="true">▤</span>
                          {printingInvoiceId === invoice.invoice_id
                            ? "Preparing..."
                            : "Print"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-[#D1D5DB] px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-600">
            Showing{" "}
            {invoices.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
            {" "}to{" "}
            {Math.min(currentPage * PAGE_SIZE, invoices.length)}
            {" "}of {invoices.length} invoices
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={currentPage === 1}
              className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#DDE1E5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-sm font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#DDE1E5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Add Sales Invoice
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Generate an invoice from an uninvoiced sales order.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-[#D1D5DB] hover:text-slate-900 disabled:opacity-40"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Sales Order
                </label>

                <select
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  className="w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select sales order</option>

                  {availableOrders.map((order) => (
                    <option
                      key={order.order_id}
                      value={order.order_id}
                    >
                      SO-{String(order.order_id).padStart(4, "0")} —{" "}
                      {money(order.total_amount)}
                    </option>
                  ))}
                </select>

                {availableOrders.length === 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    No uninvoiced sales orders are currently available.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Invoice Date
                </label>

                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                  className="w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Installment
                </label>

                <p className="w-full rounded-lg border border-[#D1D5DB] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                  {selectedMonths === 12 ? "1 Year" : `${selectedMonths} Month${selectedMonths === 1 ? "" : "s"}`} — {interestRate}% Interest
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  Calculated Due Date:{" "}
                  <span className="font-semibold text-slate-800">
                    {formatDate(
                      calculateDueDate(invoiceDate, selectedMonths)
                    )}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Installment terms are taken from the selected sales order.
                </p>
              </div>

              <div className="rounded-lg border border-[#D1D5DB] bg-slate-50 p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Order tax</span>
                  <strong className="text-slate-800">{taxType} ({taxRate.toFixed(2)}%)</strong>
                </div>
                <p className="mt-1 text-xs text-slate-500">Tax is taken from the selected sales order.</p>
              </div>

              {orderId && (
                <div className="rounded-xl border border-[#D1D5DB] bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold text-slate-800">
                    Invoice Computation
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">
                        Sales Order Amount
                      </span>
                      <span className="font-medium text-slate-800">
                        {money(orderAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">
                        Tax Type
                      </span>
                      <span className="font-medium text-slate-800">
                        {taxType}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">
                        Tax Rate
                      </span>
                      <span className="font-medium text-slate-800">
                        {Number.isFinite(taxRate)
                          ? `${taxRate.toFixed(2)}%`
                          : "Invalid rate"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">
                        Tax Amount
                      </span>
                      <span className="font-medium text-slate-800">
                        {money(taxAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">
                        Interest Rate
                      </span>
                      <span className="font-medium text-slate-800">
                        {interestRate}%
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">
                        Interest Amount
                      </span>
                      <span className="font-medium text-slate-800">
                        {money(interestAmount)}
                      </span>
                    </div>

                    <div className="border-t border-[#D1D5DB] pt-3">
                      <div className="flex justify-between gap-4">
                        <span className="font-bold text-slate-900">
                          Final Invoice Total
                        </span>
                        <span className="text-lg font-bold text-blue-900">
                          {money(finalInvoiceAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse justify-end gap-3 border-t border-[#D1D5DB] pt-5 sm:flex-row">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#DDE1E5] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleCreateInvoice()}
                disabled={
                  saving ||
                  availableOrders.length === 0 ||
                  !orderId ||
                  !invoiceDate
                }
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating..." : "Add Sales Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
