
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

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);

const amount = (value: string | number) => Number(value) || 0;

const formatDate = (value: string | null) => {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function AccountsReceivablePage() {
  const [records, setRecords] = useState<ARRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    return records.filter(
      (record) =>
        String(record.AR_ID).includes(keyword) ||
        String(record.invoice_id).includes(keyword) ||
        record.customer_name.toLowerCase().includes(keyword) ||
        record.status.toLowerCase().includes(keyword)
    );
  }, [records, search]);

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
        (record) => record.status !== "Paid"
      ).length,
    }),
    [records]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;

    return filteredRecords.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [filteredRecords, currentPage]);

  const startRecord =
    filteredRecords.length === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const endRecord = Math.min(
    currentPage * PAGE_SIZE,
    filteredRecords.length
  );

  const statusStyle = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Partially Paid":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-red-100 text-red-700";
    }
  };

  return (
    <main className="min-h-full bg-white p-5 text-gray-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Receivables"
            value={money(totals.amountDue)}
          />
          <SummaryCard
            title="Amount Collected"
            value={money(totals.amountPaid)}
          />
          <SummaryCard
            title="Outstanding Balance"
            value={money(totals.balance)}
          />
          <SummaryCard
            title="Unpaid Accounts"
            value={String(totals.unpaid)}
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-300 bg-gray-200">
          <div className="flex flex-col gap-3 border-b border-gray-300 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Receivable Records
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Monitor outstanding customer balances.
              </p>
            </div>

            <input
              type="text"
              placeholder="Search AR, invoice, or customer..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-gray-500 sm:max-w-sm"
            />
          </div>

          {error && (
            <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-600">
              Loading accounts receivable...
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="bg-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-center">AR No.</th>
                      <th className="px-4 py-3 text-center">Invoice No.</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3 text-right">Amount Due</th>
                      <th className="px-4 py-3 text-right">Amount Paid</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-300">
                    {paginatedRecords.map((record) => (
                      <tr
                        key={record.AR_ID}
                        className="transition-colors hover:bg-gray-100"
                      >
                        <td className="px-4 py-3 text-center font-medium">
                          AR-{record.AR_ID}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          INV-{record.invoice_id}
                        </td>
                        <td className="px-4 py-3">
                          {record.customer_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {formatDate(record.due_date)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {money(record.amount_due)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-700">
                          {money(record.amount_paid)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {money(record.balance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyle(record.status)}`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {paginatedRecords.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-12 text-center text-gray-600"
                        >
                          {search
                            ? "No matching records found."
                            : "No accounts receivable records yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-300 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">
                  Showing{" "}
                  <span className="font-semibold text-gray-900">
                    {startRecord} to {endRecord}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-900">
                    {filteredRecords.length}
                  </span>{" "}
                  records
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={currentPage === 1}
                    className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="min-w-20 text-center text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages, current + 1)
                      )
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-300 bg-gray-200 p-5">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}
