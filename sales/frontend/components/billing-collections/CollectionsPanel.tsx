
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  paymentCollectionAPI,
  accountsReceivableAPI,
  invoiceAPI,
  salesOrderAPI,
  customerAPI,
} from "../../lib/api";

import type { Collection, CollectionCreate } from "../../types/payment";
import type { AccountsReceivable } from "../../types/accounts-receivable";
import type { SalesInvoice } from "../../types/invoice";
import type { SalesOrder } from "../../types/order";
import type { Customer } from "../../types/customer";

type CollectionRow = Collection & {
  customer_name: string;
  invoice_id: number | null;
};

const PAGE_SIZE = 10;

const money = (value: string | number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) || 0);

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (value: string) => {
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

const createEmptyForm = (): CollectionCreate => ({
  AR_ID: 0,
  payment_date: getToday(),
  payment_method: "Cash",
  transaction_number: null,
  amount_paid: 0,
});

export default function CollectionsPage() {
  const [records, setRecords] = useState<CollectionRow[]>([]);
  const [receivables, setReceivables] = useState<AccountsReceivable[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formError, setFormError] = useState("");

  const [form, setForm] = useState<CollectionCreate>({
    AR_ID: 0,
    payment_date: "",
    payment_method: "Cash",
    transaction_number: null,
    amount_paid: 0,
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      payment_date: getToday(),
    }));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        paymentData,
        arData,
        invoiceData,
        orderData,
        customerData,
      ] = await Promise.all([
        paymentCollectionAPI.getAll(),
        accountsReceivableAPI.getAll(),
        invoiceAPI.getAll(),
        salesOrderAPI.getAll(),
        customerAPI.getAll(),
      ]);

      const invoiceMap = new Map<number, SalesInvoice>(
        invoiceData.map((item: SalesInvoice) => [
          item.invoice_id,
          item,
        ])
      );

      const orderMap = new Map<number, SalesOrder>(
        orderData.map((item: SalesOrder) => [
          item.order_id,
          item,
        ])
      );

      const customerMap = new Map<number, Customer>(
        customerData.map((item: Customer) => [
          item.customer_id,
          item,
        ])
      );

      const arMap = new Map<number, AccountsReceivable>(
        arData.map((item: AccountsReceivable) => [
          item.AR_ID,
          item,
        ])
      );

      const rows: CollectionRow[] = paymentData.map(
        (payment: Collection) => {
          const ar = arMap.get(payment.AR_ID);

          const invoice = ar
            ? invoiceMap.get(ar.invoice_id)
            : undefined;

          const order = invoice
            ? orderMap.get(invoice.order_id)
            : undefined;

          const customer = order
            ? customerMap.get(order.customer_id)
            : undefined;

          return {
            ...payment,
            invoice_id: ar?.invoice_id ?? null,
            customer_name: customer?.name ?? "Unknown Customer",
          };
        }
      );

      setRecords(rows);
      setReceivables(arData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payment collections."
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

    return records.filter(
      (record) =>
        String(record.payment_id).includes(keyword) ||
        String(record.invoice_id ?? "").includes(keyword) ||
        String(record.AR_ID).includes(keyword) ||
        record.customer_name.toLowerCase().includes(keyword) ||
        (record.payment_method ?? "").toLowerCase().includes(keyword) ||
        (record.transaction_number ?? "").toLowerCase().includes(keyword)
    );
  }, [records, search]);

  const totals = useMemo(
    () => ({
      collected: records.reduce(
        (sum, record) => sum + Number(record.amount_paid),
        0
      ),
      count: records.length,
      cash: records.filter(
        (record) => record.payment_method === "Cash"
      ).length,
    }),
    [records]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRecords.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const paginatedRecords = useMemo(
    () =>
      filteredRecords.slice(
        startIndex,
        startIndex + PAGE_SIZE
      ),
    [filteredRecords, startIndex]
  );

  const startRecord =
    filteredRecords.length === 0 ? 0 : startIndex + 1;

  const endRecord = Math.min(
    startIndex + PAGE_SIZE,
    filteredRecords.length
  );

  const hasOutstandingAccounts = receivables.some(
    (record) => Number(record.balance) > 0
  );

  const openModal = () => {
    setForm(createEmptyForm());
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setFormError("");
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setFormError("");
    setError("");
    setSuccess("");

    if (!form.AR_ID) {
      setFormError(
        "Please select an unpaid or partially paid account."
      );
      return;
    }

    if (form.amount_paid <= 0) {
      setFormError("Payment amount must be greater than zero.");
      return;
    }

    if (!form.payment_date) {
      setFormError("Please select a payment date.");
      return;
    }

    if (
      form.payment_method === "E-Wallet" &&
      !form.transaction_number?.trim()
    ) {
      setFormError(
        "Please enter the e-wallet transaction number."
      );
      return;
    }

    const selectedAR = receivables.find(
      (record) => record.AR_ID === form.AR_ID
    );

    if (!selectedAR) {
      setFormError(
        "Selected accounts receivable record was not found."
      );
      return;
    }

    if (form.amount_paid > Number(selectedAR.balance)) {
      setFormError(
        "Payment cannot exceed the remaining balance."
      );
      return;
    }

    try {
      setSaving(true);

      const paymentData: CollectionCreate = {
        ...form,
        transaction_number:
          form.payment_method === "E-Wallet"
            ? form.transaction_number?.trim() || null
            : null,
      };

      await paymentCollectionAPI.create(paymentData);

      setModalOpen(false);
      setSuccess("Payment successfully recorded.");
      setForm(createEmptyForm());
      setPage(1);

      await loadData();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to record payment."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-full bg-green-50 p-4 text-slate-800 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Notifications */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        {/* Summary Cards */}
        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Collected"
            value={money(totals.collected)}
            color="text-green-600"
          />

          <SummaryCard
            title="Payment Transactions"
            value={String(totals.count)}
            color="text-blue-600"
          />

          <SummaryCard
            title="Cash Transactions"
            value={String(totals.cash)}
            color="text-orange-600"
          />
        </section>

        {/* Payment History */}
        <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#D1D5DB] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Payment History
              </h2>

              <p className="mt-1 text-xs text-slate-600">
                View and manage recorded customer payments.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                placeholder="Search payment, customer, or transaction..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
              />

              <button
                type="button"
                onClick={openModal}
                disabled={loading || !hasOutstandingAccounts}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-lg leading-none">+</span>
                Add New Payment
              </button>
            </div>
          </div>

          {loading ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Loading payment history...
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="border-b border-[#D1D5DB] bg-[#D1D5DB] text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-center">
                        Payment No.
                      </th>
                      <th className="px-4 py-3 text-center">
                        AR No.
                      </th>
                      <th className="px-4 py-3 text-center">
                        Invoice No.
                      </th>
                      <th className="px-4 py-3 text-center">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-center">
                        Payment Date
                      </th>
                      <th className="px-4 py-3 text-center">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-center">
                        Method
                      </th>
                      <th className="px-4 py-3 text-center">
                        Transaction No.
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#D1D5DB] bg-[#E5E7EB]">
                    {paginatedRecords.map((record) => (
                      <tr
                        key={record.payment_id}
                        className="text-center transition hover:bg-[#DDE1E5]"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          PAY-{record.payment_id}
                        </td>

                        <td className="px-4 py-3">
                          AR-{record.AR_ID}
                        </td>

                        <td className="px-4 py-3">
                          {record.invoice_id
                            ? `INV-${record.invoice_id}`
                            : "—"}
                        </td>

                        <td className="px-4 py-3">
                          {record.customer_name}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDate(record.payment_date)}
                        </td>

                        <td className="px-4 py-3 font-semibold tabular-nums">
                          {money(record.amount_paid)}
                        </td>

                        <td className="px-4 py-3">
                          {record.payment_method ?? "—"}
                        </td>

                        <td className="px-4 py-3">
                          {record.transaction_number || "—"}
                        </td>
                      </tr>
                    ))}

                    {paginatedRecords.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          {search
                            ? "No matching payment records found."
                            : "No payment records yet."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-3 border-t border-[#D1D5DB] bg-gray px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {startRecord}
                  </span>
                  {" "}to{" "}
                  <span className="font-semibold text-slate-700">
                    {endRecord}
                  </span>
                  {" "}of{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredRecords.length}
                  </span>
                  {" "}payments
                </p>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="px-2 text-sm font-medium text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Add Payment Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-[#D1D5DB] bg-white shadow-xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#D1D5DB] px-6 py-4">
              <div>
                <h2
                  id="payment-modal-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Record New Payment
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the customer's payment information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit}>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
                {/* Accounts Receivable */}
                <div>
                  <label
                    htmlFor="payment-ar"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Accounts Receivable
                  </label>

                  <select
                    id="payment-ar"
                    value={form.AR_ID || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        AR_ID: Number(event.target.value),
                      })
                    }
                    required
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select an account</option>

                    {receivables
                      .filter(
                        (record) => Number(record.balance) > 0
                      )
                      .map((record) => (
                        <option
                          key={record.AR_ID}
                          value={record.AR_ID}
                        >
                          AR-{record.AR_ID} · Invoice #
                          {record.invoice_id} · Balance:{" "}
                          {money(record.balance)}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Payment Date */}
                <div>
                  <label
                    htmlFor="payment-date"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Payment Date
                  </label>

                  <input
                    id="payment-date"
                    type="date"
                    value={form.payment_date}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        payment_date: event.target.value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label
                    htmlFor="payment-method"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Payment Method
                  </label>

                  <select
                    id="payment-method"
                    value={form.payment_method ?? "Cash"}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        payment_method: event.target.value,
                        transaction_number: null,
                      })
                    }
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Cash">Cash</option>
                    <option value="E-Wallet">E-Wallet</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* E-Wallet Transaction Number */}
                {form.payment_method === "E-Wallet" && (
                  <div>
                    <label
                      htmlFor="transaction-number"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Transaction Number
                    </label>

                    <input
                      id="transaction-number"
                      type="text"
                      value={form.transaction_number ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          transaction_number: event.target.value,
                        })
                      }
                      required
                      maxLength={100}
                      placeholder="Enter e-wallet transaction number"
                      className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}

                {/* Amount Received */}
                <div>
                  <label
                    htmlFor="payment-amount"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Amount Received (₱)
                  </label>

                  <input
                    id="payment-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount_paid || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        amount_paid: Number(event.target.value),
                      })
                    }
                    required
                    placeholder="Enter payment amount"
                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Selected Account Balance */}
                {form.AR_ID !== 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    {(() => {
                      const selectedAR = receivables.find(
                        (record) => record.AR_ID === form.AR_ID
                      );

                      return selectedAR ? (
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-blue-800">
                            Remaining Balance
                          </span>

                          <span className="font-bold text-blue-900">
                            {money(selectedAR.balance)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Form Error */}
                {formError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse gap-2 border-t border-[#D1D5DB] bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || !hasOutstandingAccounts}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Recording Payment..." : "Save Payment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
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
    <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className={`mt-2 text-2xl font-bold ${color}`}>
        {value}
      </p>
    </div>
  );
}
