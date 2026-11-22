
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

  const date = new Date(value);

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
    `rounded-lg px-5 py-3 text-sm font-semibold transition ${
      activeTab === tab
        ? "bg-green-700 text-white shadow-sm"
        : "text-slate-600 hover:bg-[#D1D5DB] hover:text-blue-700"
    }`;

  return (
    <main className="min-h-screen bg-[#F3F4F6] p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap gap-2 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-2 shadow-sm">
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
          <section className="space-y-6">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <section className="grid gap-4 sm:grid-cols-3">
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

            <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-b border-[#D1D5DB] p-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Customer List
                  </h2>

                  <p className="mt-1 text-sm text-slate-600">
                    Search, edit, view transaction history, or update customer status.
                  </p>
                </div>

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search customers..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
          <section>
            <CustomerBalancePage />
          </section>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-lg rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingCustomer ? "Edit Customer" : "Add New Customer"}
              </h2>

              <p className="mt-1 text-sm text-slate-600">
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-modal-title"
            className="w-full max-w-md rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-6 shadow-2xl"
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
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
              className="text-xl font-bold text-slate-900"
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

            <div className="mt-4 rounded-lg border border-[#D1D5DB] bg-[#F3F4F6] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Customer Information
              </p>

              <p className="mt-2 font-semibold text-slate-900">
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

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => setStatusCustomer(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleConfirmStatusChange}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
            className="my-auto max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-[#D1D5DB] bg-[#F3F4F6] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#D1D5DB] bg-[#E5E7EB] p-5">
              <div>
                <h2
                  id="history-modal-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Customer Transaction History
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  {historyCustomer.name} · Customer ID: #{historyCustomer.customer_id}
                </p>
              </div>

              <button
                type="button"
                onClick={closeHistory}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-5">
              {historyError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {historyError}
                </div>
              )}

              <section className="grid gap-4 sm:grid-cols-3">
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

              <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB]">
                <div className="flex flex-col justify-between gap-3 border-b border-[#D1D5DB] p-5 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Transaction Records
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
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
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-blue-600"
                  >
                    {TRANSACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "All" ? "All Transactions" : type}
                      </option>
                    ))}
                  </select>
                </div>

                {historyLoading ? (
                  <div className="p-12 text-center text-sm text-slate-500">
                    Loading transaction history...
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="font-medium text-slate-700">
                      No transactions found.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      This customer has no records for the selected transaction type.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[750px] text-left text-sm">
                      <thead className="bg-[#D1D5DB] text-slate-600">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Date</th>
                          <th className="px-5 py-4 font-semibold">Type</th>
                          <th className="px-5 py-4 font-semibold">Reference</th>
                          <th className="px-5 py-4 text-right font-semibold">Amount</th>
                          <th className="px-5 py-4 font-semibold">Status / Details</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {filteredTransactions.map((transaction) => (
                          <tr
                            key={transaction.id}
                            className="hover:bg-[#DDE1E5]"
                          >
                            <td className="px-5 py-4 text-slate-600">
                              {formatDate(transaction.date)}
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                {transaction.type}
                              </span>
                            </td>

                            <td className="px-5 py-4 font-semibold text-slate-800">
                              {transaction.reference}
                            </td>

                            <td className="px-5 py-4 text-right font-semibold text-slate-800">
                              {formatCurrency(transaction.amount)}
                            </td>

                            <td className="px-5 py-4 text-slate-600">
                              {transaction.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!historyLoading && (
                  <div className="border-t border-[#D1D5DB] px-5 py-3 text-sm text-slate-500">
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
    <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{title}</p>

      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>
        {isCurrency ? formatCurrency(value) : value}
      </p>
    </div>
  );
}
