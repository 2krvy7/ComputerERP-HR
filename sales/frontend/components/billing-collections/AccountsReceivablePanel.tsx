
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  accountsReceivableAPI,
  invoiceAPI,
  salesOrderAPI,
  customerAPI,
} from "../../lib/api";

import type { AccountsReceivable } from "../../types/accounts-receivable";
import type { SalesInvoice } from "../../types/invoice";
import type { SalesOrder } from "../../types/order";
import type { Customer } from "../../types/customer";

type ARRow = {
  AR_ID: number;
  invoice_id: number;
  customer_name: string;
  due_date: string | null;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: string;
};

const PAGE_SIZE = 10;
const DUE_SOON_DAYS = 7;

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);

const amount = (value: string | number) => Number(value) || 0;

const getLocalDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (value: string | null) => {
  if (!value) return "—";

  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const getDaysUntilDue = (
  dueDate: string | null,
  today: string
): number | null => {
  if (!dueDate || !today) return null;

  const dueTimestamp = Date.parse(
    `${dueDate.slice(0, 10)}T00:00:00Z`
  );

  const todayTimestamp = Date.parse(
    `${today}T00:00:00Z`
  );

  if (
    Number.isNaN(dueTimestamp) ||
    Number.isNaN(todayTimestamp)
  ) {
    return null;
  }

  return Math.round(
    (dueTimestamp - todayTimestamp) / 86400000
  );
};

const isOverdue = (record: ARRow, today: string) => {
  const daysUntilDue = getDaysUntilDue(record.due_date, today);

  return (
    record.balance > 0 &&
    daysUntilDue !== null &&
    daysUntilDue < 0
  );
};

const isDueSoon = (record: ARRow, today: string) => {
  const daysUntilDue = getDaysUntilDue(
    record.due_date,
    today
  );

  return (
    record.balance > 0 &&
    daysUntilDue !== null &&
    daysUntilDue >= 0 &&
    daysUntilDue <= DUE_SOON_DAYS
  );
};

export default function AccountsReceivablePanel() {
  const [records, setRecords] = useState<ARRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(getLocalDate());
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [arData, invoiceData, orderData, customerData] =
        await Promise.all([
          accountsReceivableAPI.getAll(),
          invoiceAPI.getAll(),
          salesOrderAPI.getAll(),
          customerAPI.getAll(),
        ]);

      const invoices = new Map<number, SalesInvoice>(
        invoiceData.map((invoice: SalesInvoice) => [
          invoice.invoice_id,
          invoice,
        ])
      );

      const orders = new Map<number, SalesOrder>(
        orderData.map((order: SalesOrder) => [
          order.order_id,
          order,
        ])
      );

      const customers = new Map<number, Customer>(
        customerData.map((customer: Customer) => [
          customer.customer_id,
          customer,
        ])
      );

      const rows: ARRow[] = arData.map(
        (record: AccountsReceivable) => {
          const invoice = invoices.get(record.invoice_id);
          const order = invoice
            ? orders.get(invoice.order_id)
            : undefined;
          const customer = order
            ? customers.get(order.customer_id)
            : undefined;

          return {
            AR_ID: record.AR_ID,
            invoice_id: record.invoice_id,
            customer_name: customer?.name ?? "Unknown Customer",
            due_date: invoice?.due_date ?? null,
            amount_due: amount(record.amount_due),
            amount_paid: amount(record.amount_paid),
            balance: amount(record.balance),
            status: record.status ?? "Unpaid",
          };
        }
      );

      setRecords(rows);
      setPage(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load accounts receivable records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return records;

    return records.filter((record) => {
      const overdue = isOverdue(record, today);
      const dueSoon = isDueSoon(record, today);

      return (
        String(record.AR_ID).includes(keyword) ||
        String(record.invoice_id).includes(keyword) ||
        record.customer_name.toLowerCase().includes(keyword) ||
        record.status.toLowerCase().includes(keyword) ||
        (overdue && "overdue".includes(keyword)) ||
        (dueSoon && "due soon".includes(keyword)) ||
        (record.due_date ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [records, search, today]);

  const totals = useMemo(
    () => ({
      amountDue: records.reduce(
        (sum, record) => sum + record.amount_due,
        0
      ),
      amountPaid: records.reduce(
        (sum, record) => sum + record.amount_paid,
        0
      ),
      balance: records.reduce(
        (sum, record) => sum + record.balance,
        0
      ),
      unpaid: records.filter(
        (record) => record.balance > 0
      ).length,
      overdue: records.filter(
        (record) => isOverdue(record, today)
      ).length,
    }),
    [records, today]
  );

  const paymentAlerts = useMemo(() => {
    return records
      .filter(
        (record) =>
          isOverdue(record, today) ||
          isDueSoon(record, today)
      )
      .sort((a, b) => {
        return (a.due_date ?? "").localeCompare(
          b.due_date ?? ""
        );
      });
  }, [records, today]);

  const dueSoonCount = paymentAlerts.filter(
    (record) => isDueSoon(record, today)
  ).length;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [filteredRecords, startIndex]);

  const statusStyle = (status: string, overdue: boolean) => {
    if (overdue) {
      return "bg-red-100 text-red-700";
    }

    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Partially Paid":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getDisplayStatus = (record: ARRow) => {
    if (isOverdue(record, today)) return "Overdue";
    return record.status;
  };

  const getAlertLabel = (record: ARRow) => {
    const daysUntilDue = getDaysUntilDue(
      record.due_date,
      today
    );

    if (daysUntilDue === null) return "Due date unavailable";
    if (daysUntilDue < 0) return "Overdue";
    if (daysUntilDue === 0) return "Due today";

    return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
  };

  const startRecord =
    filteredRecords.length === 0 ? 0 : startIndex + 1;

  const endRecord = Math.min(
    startIndex + PAGE_SIZE,
    filteredRecords.length
  );

  return (
    <div className="min-w-0 space-y-5 bg-white text-slate-800">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4"
        >
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        <SummaryCard
          title="Total Receivables"
          value={money(totals.amountDue)}
          color="text-blue-700"
        />

        <SummaryCard
          title="Amount Collected"
          value={money(totals.amountPaid)}
          color="text-green-700"
        />

        <SummaryCard
          title="Outstanding Balance"
          value={money(totals.balance)}
          color="text-red-700"
        />

        <SummaryCard
          title="Unpaid Accounts"
          value={String(totals.unpaid)}
          color="text-amber-700"
        />

        <SummaryCard
          title="Overdue Accounts"
          value={String(totals.overdue)}
          color="text-red-700"
        />
      </section>

      {/* Payment Due Alerts */}
      {!loading && (
        <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#D1D5DB] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">
                Payment Due Alerts
              </h3>

              <p className="mt-1 text-xs text-slate-600">
                Unpaid invoices that are overdue or due within the next 7 days.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-700">
                {totals.overdue} Overdue
              </span>

              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">
                {dueSoonCount} Due Soon
              </span>
            </div>
          </div>

          {paymentAlerts.length === 0 ? (
            <div className="px-4 py-8 text-center sm:px-5">
              <p className="text-sm font-medium text-slate-700">
                No payment due alerts.
              </p>

              <p className="mt-1 text-xs text-slate-500">
                There are no overdue invoices or unpaid invoices due within the next 7 days.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#D1D5DB]">
              {paymentAlerts.map((record) => {
                const overdue = isOverdue(record, today);

                return (
                  <div
                    key={record.AR_ID}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          INV-{record.invoice_id}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            overdue
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {getAlertLabel(record)}
                        </span>
                      </div>

                      <p className="mt-1 break-words text-sm text-slate-700">
                        {record.customer_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Due date: {formatDate(record.due_date)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[#D1D5DB] pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
                      <p className="text-xs text-slate-500">
                        Outstanding Balance
                      </p>

                      <p className="font-bold tabular-nums text-slate-900">
                        {money(record.balance)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Receivable Records */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#D1D5DB] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">
              Receivable Records
            </h3>

            <p className="mt-1 text-xs text-slate-600">
              View invoice balances and payment status.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search AR, invoice, customer, or status..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 lg:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-600">
            Loading accounts receivable...
          </div>
        ) : (
          <>
            {/* Mobile Receivable Cards */}
            <div className="space-y-3 p-3 md:hidden">
              {paginatedRecords.map((record) => {
                const overdue = isOverdue(record, today);
                const displayStatus = getDisplayStatus(record);

                return (
                  <article
                    key={record.AR_ID}
                    className="rounded-lg border border-[#D1D5DB] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Accounts Receivable
                        </p>

                        <p className="mt-1 font-bold text-slate-900">
                          AR-{record.AR_ID}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(
                          record.status,
                          overdue
                        )}`}
                      >
                        {displayStatus}
                      </span>
                    </div>

                    <div className="mt-3 border-t border-[#E5E7EB] pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          Invoice Number
                        </span>

                        <span className="text-sm font-semibold text-blue-700">
                          INV-{record.invoice_id}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          Customer
                        </span>

                        <span className="max-w-[65%] break-words text-right text-sm font-medium text-slate-800">
                          {record.customer_name}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          Due Date
                        </span>

                        <span className="text-sm text-slate-700">
                          {formatDate(record.due_date)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#E5E7EB] pt-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          Amount Due
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                          {money(record.amount_due)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          Amount Paid
                        </p>

                        <p className="mt-1 break-words text-sm font-semibold text-green-700">
                          {money(record.amount_paid)}
                        </p>
                      </div>

                      <div className="col-span-2 rounded-lg bg-[#F3F4F6] p-3">
                        <p className="text-xs font-medium text-slate-500">
                          Outstanding Balance
                        </p>

                        <p className="mt-1 break-words text-base font-bold text-slate-900">
                          {money(record.balance)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}

              {paginatedRecords.length === 0 && (
                <div className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {search
                      ? "No matching receivable records found."
                      : "No accounts receivable records yet."}
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Receivable Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-[#D1D5DB] text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-center">AR No.</th>
                    <th className="px-4 py-3 text-center">Invoice No.</th>
                    <th className="px-4 py-3 text-center">Customer</th>
                    <th className="px-4 py-3 text-center">Due Date</th>
                    <th className="px-4 py-3 text-center">Amount Due</th>
                    <th className="px-4 py-3 text-center">Amount Paid</th>
                    <th className="px-4 py-3 text-center">Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#D1D5DB]">
                  {paginatedRecords.map((record) => {
                    const overdue = isOverdue(record, today);

                    return (
                      <tr
                        key={record.AR_ID}
                        className="text-center transition-colors hover:bg-[#DDE1E5]"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          AR-{record.AR_ID}
                        </td>

                        <td className="px-4 py-3 font-medium text-blue-700">
                          INV-{record.invoice_id}
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-800">
                          {record.customer_name}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(record.due_date)}
                        </td>

                        <td className="px-4 py-3 tabular-nums text-slate-700">
                          {money(record.amount_due)}
                        </td>

                        <td className="px-4 py-3 tabular-nums text-green-700">
                          {money(record.amount_paid)}
                        </td>

                        <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                          {money(record.balance)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                              record.status,
                              overdue
                            )}`}
                          >
                            {getDisplayStatus(record)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-slate-600"
                      >
                        {search
                          ? "No matching receivable records found."
                          : "No accounts receivable records yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-[#D1D5DB] bg-[#E5E7EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center text-sm text-slate-600 sm:text-left">
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {startRecord}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-700">
                  {endRecord}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {filteredRecords.length}
                </span>{" "}
                records
              </p>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="min-h-10 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#DDE1E5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="whitespace-nowrap px-1 text-sm font-medium text-slate-600 sm:px-2">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="min-h-10 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#DDE1E5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-600">
        {title}
      </p>

      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${color}`}>
        {value}
      </p>
    </div>
  );
}
