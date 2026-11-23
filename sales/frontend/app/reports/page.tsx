
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  invoiceAPI,
  salesOrderAPI,
  paymentCollectionAPI,
  accountsReceivableAPI,
  salesReturnAPI,
} from "../../lib/api";

import type { SalesInvoice } from "../../types/invoice";
import type { SalesOrder } from "../../types/order";
import type { Collection } from "../../types/payment";
import type { AccountsReceivable } from "../../types/accounts-receivable";
import type { SalesReturn } from "../../types/return";

type ReportCategory =
  | "Dashboard"
  | "Customer Management"
  | "Sales Processing"
  | "Delivery & Returns"
  | "Billing & Collections";

type ReportRow = {
  title: string;
  period: string;
  count: number;
  amount: number;
  category: ReportCategory;
};

const PAGE_CATEGORIES: ReportCategory[] = [
  "Dashboard",
  "Customer Management",
  "Sales Processing",
  "Delivery & Returns",
  "Billing & Collections",
];

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

function isWithinDateRange(
  dateValue: string | null | undefined,
  startDate: string,
  endDate: string
) {
  if (!startDate && !endDate) return true;
  if (!dateValue) return false;

  const dateString = dateValue.slice(0, 10);

  if (startDate && dateString < startDate) return false;
  if (endDate && dateString > endDate) return false;

  return true;
}

const categoryDescriptions: Record<ReportCategory, string> = {
  Dashboard: "Overall summary of your sales operations.",
  "Customer Management":
    "Customer balances and receivables information.",
  "Sales Processing":
    "Sales order transactions and order values.",
  "Delivery & Returns":
    "Sales return transactions and returned amounts.",
  "Billing & Collections":
    "Invoices, payment collections, and outstanding receivables.",
};

export default function ReportsPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);

  const [activeCategory, setActiveCategory] =
    useState<ReportCategory>("Dashboard");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        invoiceData,
        orderData,
        collectionData,
        receivableData,
        returnData,
      ] = await Promise.all([
        invoiceAPI.getAll(),
        salesOrderAPI.getAll(),
        paymentCollectionAPI.getAll(),
        accountsReceivableAPI.getAll(),
        salesReturnAPI.getAll(),
      ]);

      setInvoices(invoiceData);
      setOrders(orderData);
      setCollections(collectionData);
      setReceivables(receivableData);
      setReturns(returnData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load sales reports."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function applyDateRange() {
    setRangeError("");

    if (!startDate || !endDate) {
      setRangeError("Please select both a start date and an end date.");
      return;
    }

    if (startDate > endDate) {
      setRangeError("Start date cannot be later than end date.");
      return;
    }

    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  }

  function clearDateRange() {
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setRangeError("");
  }

  const dateRangeLabel = useMemo(() => {
    if (!appliedStartDate && !appliedEndDate) {
      return "All Time";
    }

    const formatDate = (value: string) =>
      new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    return `${formatDate(appliedStartDate)} – ${formatDate(appliedEndDate)}`;
  }, [appliedStartDate, appliedEndDate]);

  const filtered = useMemo(
    () => ({
      invoices: invoices.filter((item) =>
        isWithinDateRange(
          item.invoice_date,
          appliedStartDate,
          appliedEndDate
        )
      ),
      orders: orders.filter((item) =>
        isWithinDateRange(
          item.order_date,
          appliedStartDate,
          appliedEndDate
        )
      ),
      collections: collections.filter((item) =>
        isWithinDateRange(
          item.payment_date,
          appliedStartDate,
          appliedEndDate
        )
      ),
      returns: returns.filter((item) =>
        isWithinDateRange(
          item.return_date,
          appliedStartDate,
          appliedEndDate
        )
      ),
    }),
    [
      invoices,
      orders,
      collections,
      returns,
      appliedStartDate,
      appliedEndDate,
    ]
  );

  const totals = useMemo(
    () => ({
      revenue: filtered.invoices.reduce(
        (sum, item) => sum + Number(item.total_due || 0),
        0
      ),
      orderAmount: filtered.orders.reduce(
        (sum, item) => sum + Number(item.total_amount || 0),
        0
      ),
      collected: filtered.collections.reduce(
        (sum, item) => sum + Number(item.amount_paid || 0),
        0
      ),
      outstanding: receivables.reduce(
        (sum, item) => sum + Number(item.balance || 0),
        0
      ),
      returned: filtered.returns.reduce(
        (sum, item) => sum + Number(item.return_amount || 0),
        0
      ),
    }),
    [filtered, receivables]
  );

  const reportRows = useMemo<ReportRow[]>(
    () => [
      {
        title: "Customer Balances",
        period: "Current Balance",
        count: receivables.length,
        amount: totals.outstanding,
        category: "Customer Management",
      },
      {
        title: "Sales Orders",
        period: "Order Date",
        count: filtered.orders.length,
        amount: totals.orderAmount,
        category: "Sales Processing",
      },
      {
        title: "Sales Returns",
        period: "Return Date",
        count: filtered.returns.length,
        amount: totals.returned,
        category: "Delivery & Returns",
      },
      {
        title: "Sales Revenue",
        period: "Invoice Date",
        count: filtered.invoices.length,
        amount: totals.revenue,
        category: "Billing & Collections",
      },
      {
        title: "Payment Collections",
        period: "Payment Date",
        count: filtered.collections.length,
        amount: totals.collected,
        category: "Billing & Collections",
      },
      {
        title: "Accounts Receivable",
        period: "Current Balance",
        count: receivables.length,
        amount: totals.outstanding,
        category: "Billing & Collections",
      },
    ],
    [filtered, totals, receivables]
  );

  const visibleRows = useMemo(() => {
    if (activeCategory === "Dashboard") {
      return reportRows.filter(
        (row) =>
          row.category === "Sales Processing" ||
          row.category === "Delivery & Returns" ||
          row.category === "Billing & Collections"
      );
    }

    return reportRows.filter(
      (row) => row.category === activeCategory
    );
  }, [reportRows, activeCategory]);

  function exportCSV() {
    const rows = [
      [
        "Report",
        "Category",
        "Period",
        "Total Records",
        "Total Amount (PHP)",
      ],
      ...visibleRows.map((row) => [
        row.title,
        row.category,
        row.period,
        String(row.count),
        row.amount.toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sales-reports-${activeCategory
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${getToday()}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-full space-y-5 bg-green-50 p-4 text-slate-800 sm:p-6">
      <section className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Reporting Date Range
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Select the start and end dates to filter your report data.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="w-full lg:flex-1">
            <label
              htmlFor="report-start-date"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Start Date
            </label>
            <input
              id="report-start-date"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => {
                setStartDate(event.target.value);
                setRangeError("");
              }}
              className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="w-full lg:flex-1">
            <label
              htmlFor="report-end-date"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              End Date
            </label>
            <input
              id="report-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => {
                setEndDate(event.target.value);
                setRangeError("");
              }}
              className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyDateRange}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Apply Filter
            </button>

            <button
              type="button"
              onClick={clearDateRange}
              className="rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        {rangeError && (
          <p className="mt-3 text-xs font-medium text-red-600">
            {rangeError}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            Applied date range:
          </span>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
            {dateRangeLabel}
          </span>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="font-semibold hover:text-red-900"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Report Categories
        </h2>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {PAGE_CATEGORIES.map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                    : "border-[#D1D5DB] bg-[#E5E7EB] text-slate-700 hover:bg-[#DDE1E5]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-10 text-center text-sm text-slate-500">
          Loading sales reports...
        </div>
      ) : !error ? (
        <>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                {activeCategory}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {categoryDescriptions[activeCategory]}
              </p>
            </div>

            <p className="text-sm text-slate-600">
              Period:{" "}
              <span className="font-semibold text-slate-900">
                {dateRangeLabel}
              </span>
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeCategory === "Dashboard" && (
              <>
                <SummaryCard
                  title="Sales Revenue"
                  value={money(totals.revenue)}
                  description="Based on invoice dates"
                  color="text-green-700"
                />

                <SummaryCard
                  title="Sales Orders"
                  value={String(filtered.orders.length)}
                  description={`${money(totals.orderAmount)} total order value`}
                  color="text-blue-700"
                />

                <SummaryCard
                  title="Total Collections"
                  value={money(totals.collected)}
                  description="Based on payment dates"
                  color="text-purple-700"
                />

                <SummaryCard
                  title="Outstanding Receivables"
                  value={money(totals.outstanding)}
                  description="Current balance across all periods"
                  color="text-orange-700"
                />

                <SummaryCard
                  title="Sales Returns"
                  value={money(totals.returned)}
                  description="Based on return dates"
                  color="text-red-700"
                />

                <SummaryCard
                  title="Invoices Issued"
                  value={String(filtered.invoices.length)}
                  description="Based on invoice dates"
                  color="text-indigo-700"
                />
              </>
            )}

            {activeCategory === "Customer Management" && (
              <SummaryCard
                title="Customer Balances"
                value={money(totals.outstanding)}
                description={`${receivables.length} receivable records`}
                color="text-orange-700"
              />
            )}

            {activeCategory === "Sales Processing" && (
              <SummaryCard
                title="Sales Orders"
                value={String(filtered.orders.length)}
                description={`${money(totals.orderAmount)} total order value`}
                color="text-blue-700"
              />
            )}

            {activeCategory === "Delivery & Returns" && (
              <SummaryCard
                title="Sales Returns"
                value={money(totals.returned)}
                description={`${filtered.returns.length} return records`}
                color="text-red-700"
              />
            )}

            {activeCategory === "Billing & Collections" && (
              <>
                <SummaryCard
                  title="Sales Revenue"
                  value={money(totals.revenue)}
                  description="Based on invoice dates"
                  color="text-green-700"
                />

                <SummaryCard
                  title="Total Collections"
                  value={money(totals.collected)}
                  description="Based on payment dates"
                  color="text-purple-700"
                />

                <SummaryCard
                  title="Outstanding Receivables"
                  value={money(totals.outstanding)}
                  description="Current balance across all periods"
                  color="text-orange-700"
                />
              </>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
            <div className="border-b border-[#D1D5DB] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Report Summary
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {visibleRows.length} report{" "}
                    {visibleRows.length === 1 ? "record" : "records"}{" "}
                    displayed.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={exportCSV}
                  disabled={visibleRows.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden="true">↓</span>
                  Export to CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#D1D5DB] bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3">
                      Report
                    </th>
                    <th className="whitespace-nowrap px-5 py-3">
                      Date Basis
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 text-center">
                      Total Records
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">
                      Total Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#D1D5DB]">
                  {visibleRows.length > 0 ? (
                    visibleRows.map((row) => (
                      <tr
                        key={`${row.category}-${row.title}`}
                        className="transition-colors hover:bg-[#DDE1E5]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                          {row.title}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {row.period}
                        </td>

                        <td className="px-5 py-4 text-center text-slate-700">
                          {row.count.toLocaleString("en-PH")}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-800">
                          {money(row.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-sm text-slate-500"
                      >
                        No report records available for this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  color,
}: {
  title: string;
  value: string;
  description: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}
