
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

type CustomerBalanceRow = {
  customer_id: number;
  customer_name: string;
  total_invoiced: number;
  total_paid: number;
  balance: number;
  invoice_count: number;
  status: string;
};

const PAGE_SIZE = 10;

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);

const amount = (value: string | number) => Number(value) || 0;

export default function CustomerBalancePage() {
  const [records, setRecords] = useState<CustomerBalanceRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
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

      const balances = new Map<number, CustomerBalanceRow>();

      arData.forEach((record: AccountsReceivable) => {
        const invoice = invoices.get(record.invoice_id);
        const order = invoice ? orders.get(invoice.order_id) : undefined;

        if (!order) return;

        const customer = customers.get(order.customer_id);

        if (!customer) return;

        const existing = balances.get(customer.customer_id);

        if (existing) {
          existing.total_invoiced += amount(record.amount_due);
          existing.total_paid += amount(record.amount_paid);
          existing.balance += amount(record.balance);
          existing.invoice_count += 1;
        } else {
          balances.set(customer.customer_id, {
            customer_id: customer.customer_id,
            customer_name: customer.name,
            total_invoiced: amount(record.amount_due),
            total_paid: amount(record.amount_paid),
            balance: amount(record.balance),
            invoice_count: 1,
            status: "Unpaid",
          });
        }
      });

      const rows = Array.from(balances.values()).map((customer) => {
        let status = "Unpaid";

        if (customer.balance <= 0) {
          status = "Paid";
        } else if (customer.total_paid > 0) {
          status = "Partially Paid";
        }

        return {
          ...customer,
          status,
        };
      });

      setRecords(rows);
      setCurrentPage(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load customer balances."
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

    return records.filter((record) => {
      const matchesSearch =
        String(record.customer_id).includes(keyword) ||
        record.customer_name.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "All" || record.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;

  const paginatedRecords = filteredRecords.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const totals = useMemo(
    () => ({
      invoiced: records.reduce(
        (sum, record) => sum + record.total_invoiced,
        0
      ),
      paid: records.reduce(
        (sum, record) => sum + record.total_paid,
        0
      ),
      balance: records.reduce(
        (sum, record) => sum + record.balance,
        0
      ),
      customers: records.length,
    }),
    [records]
  );

  const statusStyle = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Partially Paid":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-red-100 text-red-700";
    }
  };

  return (
    <main className="min-h-full w-full min-w-0 bg-white p-3 text-gray-900 sm:p-4 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6 lg:space-y-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Customers"
            value={String(totals.customers)}
            color="text-gray-900"
          />

          <SummaryCard
            title="Total Invoiced"
            value={money(totals.invoiced)}
            color="text-gray-900"
          />

          <SummaryCard
            title="Total Paid"
            value={money(totals.paid)}
            color="text-green-600"
          />

          <SummaryCard
            title="Outstanding Balance"
            value={money(totals.balance)}
            color="text-red-600"
          />
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
          <div className="p-3 sm:p-5">
            <div className="mb-5 flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                  Customer Balance Records
                </h2>

                <p className="mt-1 text-xs text-gray-600 sm:text-sm">
                  Consolidated balances from all accounts receivable records.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:shrink-0">
                <input
                  type="search"
                  placeholder="Search customer..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 sm:w-64 sm:text-sm"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 outline-none focus:border-blue-500 sm:text-sm"
                >
                  <option value="All">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-gray-600">
                Loading customer balances...
              </p>
            ) : (
              <>
                {/* Mobile customer balance cards */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {paginatedRecords.map((record) => (
                    <div
                      key={record.customer_id}
                      className="min-w-0 rounded-lg border border-[#D1D5DB] bg-white p-4 shadow-sm"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-500">
                            CUS-{record.customer_id}
                          </p>
                          <h3 className="mt-1 break-words text-sm font-semibold text-gray-900">
                            {record.customer_name}
                          </h3>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium sm:text-xs ${statusStyle(record.status)}`}
                        >
                          {record.status}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Invoices</p>
                          <p className="mt-1 text-sm font-semibold text-gray-800">
                            {record.invoice_count}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">
                            Total Invoiced
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-gray-800">
                            {money(record.total_invoiced)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Total Paid</p>
                          <p className="mt-1 break-words text-sm font-semibold text-green-700">
                            {money(record.total_paid)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Balance</p>
                          <p className="mt-1 break-words text-sm font-semibold text-red-700">
                            {money(record.balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredRecords.length === 0 && (
                    <div className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-10 text-center text-sm text-gray-600">
                      {search || statusFilter !== "All"
                        ? "No matching customer balances found."
                        : "No customer balance records yet."}
                    </div>
                  )}
                </div>

                {/* Desktop and tablet table */}
                <div className="hidden overflow-x-auto rounded-lg border border-[#D1D5DB] bg-white md:block">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="border-b border-[#D1D5DB] bg-[#D1D5DB] text-xs uppercase text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-center">
                          Customer ID
                        </th>
                        <th className="px-4 py-3 text-center">Customer</th>
                        <th className="px-4 py-3 text-center">Invoices</th>
                        <th className="px-4 py-3 text-center">
                          Total Invoiced
                        </th>
                        <th className="px-4 py-3 text-center">Total Paid</th>
                        <th className="px-4 py-3 text-center">Balance</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#D1D5DB]">
                      {paginatedRecords.map((record) => (
                        <tr
                          key={record.customer_id}
                          className="transition-colors hover:bg-[#F3F4F6]"
                        >
                          <td className="px-4 py-3 text-center font-medium text-gray-800">
                            CUS-{record.customer_id}
                          </td>

                          <td className="px-4 py-3 text-center font-medium text-gray-800">
                            {record.customer_name}
                          </td>

                          <td className="px-4 py-3 text-center text-gray-700">
                            {record.invoice_count}
                          </td>

                          <td className="px-4 py-3 text-center text-gray-800">
                            {money(record.total_invoiced)}
                          </td>

                          <td className="px-4 py-3 text-center text-green-700">
                            {money(record.total_paid)}
                          </td>

                          <td className="px-4 py-3 text-center font-semibold text-red-700">
                            {money(record.balance)}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusStyle(record.status)}`}
                            >
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredRecords.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-10 text-center text-gray-600"
                          >
                            {search || statusFilter !== "All"
                              ? "No matching customer balances found."
                              : "No customer balance records yet."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {!loading && (
            <div className="flex flex-col gap-3 border-t border-[#D1D5DB] bg-[#E5E7EB] px-3 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
              <p className="text-center text-xs text-gray-600 sm:text-sm md:text-left">
                Showing{" "}
                <span className="font-semibold text-gray-800">
                  {filteredRecords.length === 0 ? 0 : startIndex + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-gray-800">
                  {Math.min(
                    startIndex + PAGE_SIZE,
                    filteredRecords.length
                  )}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-800">
                  {filteredRecords.length}
                </span>{" "}
                customers
              </p>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage(safePage - 1)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                >
                  Previous
                </button>

                <span className="whitespace-nowrap px-1 text-xs font-medium text-gray-600 sm:px-2 sm:text-sm">
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage(safePage + 1)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
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
      <p className="text-xs text-gray-600 sm:text-sm">{title}</p>

      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${color}`}>
        {value}
      </p>
    </div>
  );
}
