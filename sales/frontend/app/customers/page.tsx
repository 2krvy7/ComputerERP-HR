
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  customerAPI,
  quotationAPI,
  salesOrderAPI,
  invoiceAPI,
  accountsReceivableAPI,
  paymentCollectionAPI,
  salesReturnAPI,
} from "../../lib/api";

import type {
  Customer,
  CustomerCreate,
} from "../../types/customer";

import type { SalesQuotation } from "../../types/quotation";
import type { SalesOrder } from "../../types/order";
import type { SalesInvoice } from "../../types/invoice";
import type { AccountsReceivable } from "../../types/accounts-receivable";
import type { Collection } from "../../types/payment";
import type { SalesReturn } from "../../types/return";

import CustomerForm from "../../components/customers/CustomerForm";
import CustomerTable from "../../components/customers/CustomerTable";
import CustomerBalancePage from "../customer-balance/page";

type CustomerTab = "customers" | "balance";

type TransactionType =
  | "Quotation"
  | "Sales Order"
  | "Invoice"
  | "Payment"
  | "Return";

type CustomerTransaction = {
  id: string;
  date: string;
  type: TransactionType;
  reference: string;
  amount: number;
  status: string;
};

const TRANSACTION_TYPES: Array<"All" | TransactionType> = [
  "All",
  "Quotation",
  "Sales Order",
  "Invoice",
  "Payment",
  "Return",
];

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "—";

  const datePart = value.split("T")[0];
  const date = new Date(`${datePart}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInvoiceStatus(
  invoice: SalesInvoice,
  receivables: AccountsReceivable[]
): string {
  const receivable = receivables.find(
    (item) => item.invoice_id === invoice.invoice_id
  );

  if (!receivable) return "No AR Record";
  if (toNumber(receivable.balance) <= 0) return "Paid";

  if (toNumber(receivable.amount_paid) > 0) {
    return "Partially Paid";
  }

  return receivable.status || "Unpaid";
}

const summaryCardClass =
  "min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5";

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState<CustomerTab>("customers");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);
  const [statusCustomer, setStatusCustomer] =
    useState<Customer | null>(null);

  const [historyCustomer, setHistoryCustomer] =
    useState<Customer | null>(null);
  const [historyTransactions, setHistoryTransactions] =
    useState<CustomerTransaction[]>([]);
  const [historyReceivables, setHistoryReceivables] =
    useState<AccountsReceivable[]>([]);
  const [historyPayments, setHistoryPayments] =
    useState<Collection[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [transactionFilter, setTransactionFilter] =
    useState<"All" | TransactionType>("All");

  const [historyOrderCount, setHistoryOrderCount] = useState(0);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await customerAPI.getAll(search);
      setCustomers(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load customers."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadCustomers();
    }, 300);

    return () => clearTimeout(timeout);
  }, [loadCustomers]);

  async function handleSave(data: CustomerCreate) {
    setSaving(true);
    setError("");

    try {
      if (editingCustomer) {
        await customerAPI.update(editingCustomer.customer_id, data);
      } else {
        await customerAPI.create(data);
      }

      setShowForm(false);
      setEditingCustomer(null);
      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save customer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusCustomer) return;

    const customer = statusCustomer;
    const nextStatus = !customer.status;

    setUpdatingStatus(true);
    setError("");

    try {
      await customerAPI.updateStatus(
        customer.customer_id,
        nextStatus
      );

      setStatusCustomer(null);
      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update customer status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function openCustomerHistory(customer: Customer) {
    setHistoryCustomer(customer);
    setHistoryTransactions([]);
    setHistoryReceivables([]);
    setHistoryPayments([]);
    setHistoryOrderCount(0);
    setTransactionFilter("All");
    setHistoryError("");
    setHistoryLoading(true);

    try {
      const [
        quotations,
        orders,
        invoices,
        receivables,
        payments,
        returns,
      ] = await Promise.all([
        quotationAPI.getAll(),
        salesOrderAPI.getAll(),
        invoiceAPI.getAll(),
        accountsReceivableAPI.getAll(),
        paymentCollectionAPI.getAll(),
        salesReturnAPI.getAll(),
      ]);

      const customerId = customer.customer_id;

      const customerOrders = orders.filter(
        (order) => order.customer_id === customerId
      );

      const customerQuotations = quotations.filter(
        (quotation) => quotation.customer_id === customerId
      );

      const customerInvoices = invoices.filter((invoice) => {
        const order = orders.find(
          (item) => item.order_id === invoice.order_id
        );

        return order?.customer_id === customerId;
      });

      const customerReceivables = receivables.filter(
        (item) => item.customer_id === customerId
      );

      const customerReceivableIds = new Set(
        customerReceivables.map((item) => item.AR_ID)
      );

      const customerPayments = payments.filter((payment) =>
        customerReceivableIds.has(payment.AR_ID)
      );

      const customerInvoiceIds = new Set(
        customerInvoices.map((invoice) => invoice.invoice_id)
      );

      const customerReturns = returns.filter((item) =>
        customerInvoiceIds.has(item.invoice_id)
      );

      const transactions: CustomerTransaction[] = [];

      customerQuotations.forEach((quotation: SalesQuotation) => {
        transactions.push({
          id: `quotation-${quotation.quotation_id}`,
          date: quotation.quotation_date,
          type: "Quotation",
          reference: `QUO-${quotation.quotation_id}`,
          amount: toNumber(quotation.total_amount),
          status: quotation.status,
        });
      });

      customerOrders.forEach((order: SalesOrder) => {
        transactions.push({
          id: `order-${order.order_id}`,
          date: order.order_date,
          type: "Sales Order",
          reference: `SO-${order.order_id}`,
          amount: toNumber(order.total_amount),
          status: order.status,
        });
      });

      customerInvoices.forEach((invoice: SalesInvoice) => {
        transactions.push({
          id: `invoice-${invoice.invoice_id}`,
          date: invoice.invoice_date,
          type: "Invoice",
          reference: `INV-${invoice.invoice_id}`,
          amount: toNumber(invoice.total_due),
          status: getInvoiceStatus(invoice, customerReceivables),
        });
      });

      customerPayments.forEach((payment: Collection) => {
        transactions.push({
          id: `payment-${payment.payment_id}`,
          date: payment.payment_date,
          type: "Payment",
          reference: `PAY-${payment.payment_id}`,
          amount: toNumber(payment.amount_paid),
          status: payment.payment_method || "Recorded",
        });
      });

      customerReturns.forEach((item: SalesReturn) => {
        transactions.push({
          id: `return-${item.return_id}`,
          date: item.return_date,
          type: "Return",
          reference: `RET-${item.return_id}`,
          amount: toNumber(item.return_amount),
          status: item.reason || "Recorded",
        });
      });

      transactions.sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setHistoryTransactions(transactions);
      setHistoryReceivables(customerReceivables);
      setHistoryPayments(customerPayments);
      setHistoryOrderCount(customerOrders.length);
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : "Unable to load customer transaction history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  function openAddForm() {
    setEditingCustomer(null);
    setShowForm(true);
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);
    setShowForm(true);
  }

  function closeHistory() {
    setHistoryCustomer(null);
    setHistoryTransactions([]);
    setHistoryReceivables([]);
    setHistoryPayments([]);
    setHistoryError("");
  }

  const activeCount = customers.filter(
    (customer) => customer.status
  ).length;

  const inactiveCount = customers.length - activeCount;

  const totalPayments = historyPayments.reduce(
    (sum, payment) => sum + toNumber(payment.amount_paid),
    0
  );

  const outstandingBalance = historyReceivables.reduce(
    (sum, item) => sum + toNumber(item.balance),
    0
  );

  const filteredTransactions =
    transactionFilter === "All"
      ? historyTransactions
      : historyTransactions.filter(
          (transaction) => transaction.type === transactionFilter
        );

  const tabClass = (tab: CustomerTab) =>
    `flex-1 rounded-lg px-3 py-3 text-center text-xs font-semibold transition sm:flex-none sm:px-5 sm:text-sm ${
      activeTab === tab
        ? "bg-green-700 text-white shadow-sm"
        : "text-slate-600 hover:bg-[#D1D5DB] hover:text-blue-700"
    }`;

  return (
    <main className="min-h-full w-full min-w-0 bg-white p-3 text-slate-900 sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex w-full gap-1 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-1.5 shadow-sm sm:w-fit sm:gap-2 sm:p-2">
          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={tabClass("customers")}
          >
            Customers
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("balance")}
            className={tabClass("balance")}
          >
            Customer Balance
          </button>
        </div>

        {activeTab === "customers" && (
          <section className="min-w-0 space-y-4 sm:space-y-6">
            {error && (
              <div
                role="alert"
                className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4"
              >
                {error}
              </div>
            )}

            <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <SummaryCard
                title="Total Customers"
                value={customers.length}
              />

              <SummaryCard
                title="Active Customers"
                value={activeCount}
                valueClass="text-green-600"
              />

              <SummaryCard
                title="Inactive Customers"
                value={inactiveCount}
                valueClass="text-slate-500"
              />
            </section>

            <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[#D1D5DB] p-3 sm:gap-4 sm:p-5">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Customer List
                  </h2>

                  <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                    Search, edit, view transaction history, or update customer status.
                  </p>
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customers..."
                    aria-label="Search customers"
                    className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:max-w-sm sm:py-2.5 sm:text-sm"
                  />

                  <button
                    type="button"
                    onClick={openAddForm}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:w-auto sm:py-2.5"
                  >
                    <span className="text-lg leading-none">+</span>
                    Add Customer
                  </button>
                </div>
              </div>

              <CustomerTable
                customers={customers}
                loading={loading}
                onEdit={openEditForm}
                onToggleStatus={setStatusCustomer}
                onViewHistory={openCustomerHistory}
              />
            </section>
          </section>
        )}

        {activeTab === "balance" && (
          <section className="min-w-0">
            <CustomerBalancePage />
          </section>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="my-auto max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-xl sm:max-h-[90dvh] sm:p-6">
            <div className="mb-5 sm:mb-6">
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                {editingCustomer ? "Edit Customer" : "Add New Customer"}
              </h2>

              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                Enter the customer information below.
              </p>
            </div>

            <CustomerForm
              key={editingCustomer?.customer_id ?? "new"}
              initialData={editingCustomer}
              loading={saving}
              onSubmit={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingCustomer(null);
              }}
            />
          </div>
        </div>
      )}

      {statusCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-modal-title"
            className="my-auto w-full max-w-md rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-2xl sm:p-6"
          >
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full sm:h-12 sm:w-12 ${
                statusCustomer.status
                  ? "bg-red-100 text-red-600"
                  : "bg-green-100 text-green-600"
              }`}
            >
              <span className="text-2xl font-bold">
                {statusCustomer.status ? "!" : "✓"}
              </span>
            </div>

            <h2
              id="status-modal-title"
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              {statusCustomer.status
                ? "Deactivate Customer Account?"
                : "Activate Customer Account?"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to{" "}
              {statusCustomer.status ? "deactivate" : "activate"} this
              customer account?
            </p>

            <div className="mt-4 rounded-lg border border-[#D1D5DB] bg-[#F3F4F6] p-3 sm:p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Customer Information
              </p>

              <p className="mt-2 break-words font-semibold text-slate-900">
                {statusCustomer.name}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Customer ID: #{statusCustomer.customer_id}
              </p>

              <p className="mt-2 text-sm">
                Current Status:{" "}
                <span className="font-semibold">
                  {statusCustomer.status ? "Active" : "Inactive"}
                </span>
              </p>

              <p className="mt-1 text-sm">
                New Status:{" "}
                <span
                  className={`font-semibold ${
                    statusCustomer.status
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {statusCustomer.status ? "Inactive" : "Active"}
                </span>
              </p>
            </div>

            {statusCustomer.status && (
              <p className="mt-4 text-xs leading-5 text-slate-600">
                Deactivating this account will mark the customer as
                inactive. Existing customer records will remain in
                the system.
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => setStatusCustomer(null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:py-2.5"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleConfirmStatusChange}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5 ${
                  statusCustomer.status
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {updatingStatus
                  ? "Updating..."
                  : statusCustomer.status
                    ? "Confirm Deactivation"
                    : "Confirm Activation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyCustomer && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            className="my-auto flex max-h-[calc(100dvh-16px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#F3F4F6] shadow-2xl sm:max-h-[92dvh]"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D1D5DB] bg-[#E5E7EB] p-3 sm:items-center sm:p-5">
              <div className="min-w-0">
                <h2
                  id="history-modal-title"
                  className="text-base font-bold text-slate-900 sm:text-xl"
                >
                  Customer Transaction History
                </h2>

                <p className="mt-1 break-words text-xs text-slate-600 sm:text-sm">
                  {historyCustomer.name} · Customer ID: #{historyCustomer.customer_id}
                </p>
              </div>

              <button
                type="button"
                onClick={closeHistory}
                aria-label="Close transaction history"
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 sm:text-sm"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:space-y-5 sm:p-5">
              {historyError && (
                <div
                  role="alert"
                  className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4"
                >
                  {historyError}
                </div>
              )}

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <SummaryCard
                  title="Total Sales Orders"
                  value={historyOrderCount}
                />

                <SummaryCard
                  title="Total Payments"
                  value={totalPayments}
                  isCurrency
                />

                <SummaryCard
                  title="Outstanding Balance"
                  value={outstandingBalance}
                  isCurrency
                  valueClass={
                    outstandingBalance > 0
                      ? "text-red-600"
                      : "text-green-600"
                  }
                />
              </section>

              <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB]">
                <div className="flex flex-col gap-3 border-b border-[#D1D5DB] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Transaction Records
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                      All transactions recorded for this customer.
                    </p>
                  </div>

                  <select
                    value={transactionFilter}
                    onChange={(event) =>
                      setTransactionFilter(
                        event.target.value as "All" | TransactionType
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-700 outline-none focus:border-blue-600 sm:w-auto sm:min-w-[190px] sm:py-2 sm:text-sm"
                  >
                    {TRANSACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "All" ? "All Transactions" : type}
                      </option>
                    ))}
                  </select>
                </div>

                {historyLoading ? (
                  <div className="p-10 text-center text-sm text-slate-500 sm:p-12">
                    Loading transaction history...
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center sm:p-12">
                    <p className="font-medium text-slate-700">
                      No transactions found.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      This customer has no records for the selected transaction type.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-[#D1D5DB] text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold sm:px-5 sm:py-4">
                            Date
                          </th>
                          <th className="px-4 py-3 font-semibold sm:px-5 sm:py-4">
                            Type
                          </th>
                          <th className="px-4 py-3 font-semibold sm:px-5 sm:py-4">
                            Reference
                          </th>
                          <th className="px-4 py-3 text-right font-semibold sm:px-5 sm:py-4">
                            Amount
                          </th>
                          <th className="px-4 py-3 font-semibold sm:px-5 sm:py-4">
                            Status / Details
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredTransactions.map((transaction) => (
                          <tr
                            key={transaction.id}
                            className="hover:bg-[#DDE1E5]"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600 sm:px-5 sm:py-4">
                              {formatDate(transaction.date)}
                            </td>

                            <td className="px-4 py-3 sm:px-5 sm:py-4">
                              <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                {transaction.type}
                              </span>
                            </td>

                            <td className="px-4 py-3 font-semibold text-slate-800 sm:px-5 sm:py-4">
                              {transaction.reference}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800 sm:px-5 sm:py-4">
                              {formatCurrency(transaction.amount)}
                            </td>

                            <td className="max-w-[220px] break-words px-4 py-3 text-slate-600 sm:px-5 sm:py-4">
                              {transaction.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!historyLoading && (
                  <div className="border-t border-[#D1D5DB] px-3 py-3 text-xs text-slate-500 sm:px-5 sm:text-sm">
                    Showing {filteredTransactions.length} of{" "}
                    {historyTransactions.length} transactions
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  title,
  value,
  valueClass = "text-slate-900",
  isCurrency = false,
}: {
  title: string;
  value: number;
  valueClass?: string;
  isCurrency?: boolean;
}) {
  return (
    <div className={summaryCardClass}>
      <p className="text-xs font-medium text-slate-600 sm:text-sm">
        {title}
      </p>

      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${valueClass}`}>
        {isCurrency ? formatCurrency(value) : value.toLocaleString("en-PH")}
      </p>
    </div>
  );
}
