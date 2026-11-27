
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

type ReceivableOption = AccountsReceivable & {
  customer_name: string;
};

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

const formatDate = (value: string | null | undefined) => {
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
  const [receivables, setReceivables] = useState<ReceivableOption[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const [arSearch, setArSearch] = useState("");
  const [arDropdownOpen, setArDropdownOpen] = useState(false);

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

      const arRows: ReceivableOption[] = arData.map(
        (record: AccountsReceivable) => {
          const invoice = invoiceMap.get(record.invoice_id);
          const order = invoice
            ? orderMap.get(invoice.order_id)
            : undefined;
          const customer = order
            ? customerMap.get(order.customer_id)
            : undefined;

          return {
            ...record,
            customer_name: customer?.name ?? "Unknown Customer",
          };
        }
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
      setReceivables(arRows);
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

  const unpaidReceivables = useMemo(
    () =>
      receivables.filter(
        (record) => Number(record.balance) > 0
      ),
    [receivables]
  );

  const filteredReceivables = useMemo(() => {
    const keyword = arSearch.trim().toLowerCase();

    if (!keyword) return unpaidReceivables;

    return unpaidReceivables.filter((record) => {
      return (
        String(record.AR_ID).includes(keyword) ||
        String(record.invoice_id).includes(keyword) ||
        record.customer_name.toLowerCase().includes(keyword) ||
        String(record.balance).includes(keyword) ||
        money(record.balance).toLowerCase().includes(keyword)
      );
    });
  }, [unpaidReceivables, arSearch]);

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

  const hasOutstandingAccounts = unpaidReceivables.length > 0;

  const selectedAR = receivables.find(
    (record) => record.AR_ID === form.AR_ID
  );

  const openModal = () => {
    setForm(createEmptyForm());
    setArSearch("");
    setArDropdownOpen(false);
    setFormError("");
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setArSearch("");
    setArDropdownOpen(false);
    setFormError("");
  };

  const selectReceivable = (record: ReceivableOption) => {
    setForm((current) => ({
      ...current,
      AR_ID: record.AR_ID,
      amount_paid: 0,
    }));

    setArSearch(
      `AR-${record.AR_ID} · INV-${record.invoice_id} · ${record.customer_name}`
    );

    setArDropdownOpen(false);
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

    if (
      !Number.isFinite(form.amount_paid) ||
      form.amount_paid <= 0
    ) {
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

    const selectedAccount = receivables.find(
      (record) => record.AR_ID === form.AR_ID
    );

    if (!selectedAccount) {
      setFormError(
        "Selected accounts receivable record was not found."
      );
      return;
    }

    if (form.amount_paid > Number(selectedAccount.balance)) {
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
      setArSearch("");
      setArDropdownOpen(false);
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
    <main className="min-h-full w-full bg-white p-3 text-slate-800 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
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

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <SummaryCard
            title="Total Collected"
            value={money(totals.collected)}
            color="text-green-700"
          />

          <SummaryCard
            title="Payment Transactions"
            value={String(totals.count)}
            color="text-blue-700"
          />

          <SummaryCard
            title="Cash Transactions"
            value={String(totals.cash)}
            color="text-orange-700"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#D1D5DB] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-800 sm:text-lg">
                Payment History
              </h2>

              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                View and manage recorded customer payments.
              </p>
            </div>

            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:w-auto">
              <input
                type="text"
                placeholder="Search payment, customer, or transaction..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="min-w-0 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
              />

              <button
                type="button"
                onClick={openModal}
                disabled={loading || !hasOutstandingAccounts}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <span className="text-lg leading-none">+</span>
                Add New Payment
              </button>
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              Loading payment history...
            </div>
          ) : (
            <>
              {paginatedRecords.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-slate-500">
                  {search
                    ? "No matching payment records found."
                    : "No payment records yet."}
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {paginatedRecords.map((record) => (
                      <article
                        key={record.payment_id}
                        className="rounded-lg border border-[#D1D5DB] bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              Payment No.
                            </p>
                            <p className="mt-1 font-semibold text-slate-800">
                              PAY-{record.payment_id}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            {record.payment_method ?? "—"}
                          </span>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Customer
                          </p>
                          <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                            {record.customer_name}
                          </p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                          <div>
                            <p className="text-xs text-slate-500">AR No.</p>
                            <p className="mt-1 text-sm font-medium text-slate-700">
                              AR-{record.AR_ID}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">Invoice No.</p>
                            <p className="mt-1 text-sm font-medium text-blue-700">
                              {record.invoice_id
                                ? `INV-${record.invoice_id}`
                                : "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">Payment Date</p>
                            <p className="mt-1 text-sm text-slate-700">
                              {formatDate(record.payment_date)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">Amount</p>
                            <p className="mt-1 text-sm font-bold tabular-nums text-green-700">
                              {money(record.amount_paid)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <p className="text-xs text-slate-500">
                            Transaction No.
                          </p>
                          <p className="mt-1 break-all text-sm text-slate-700">
                            {record.transaction_number || "—"}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[1050px] text-left text-sm">
                      <thead className="border-b border-[#D1D5DB] bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-center">Payment No.</th>
                          <th className="px-4 py-3 text-center">AR No.</th>
                          <th className="px-4 py-3 text-center">Invoice No.</th>
                          <th className="px-4 py-3 text-center">Customer</th>
                          <th className="px-4 py-3 text-center">Payment Date</th>
                          <th className="px-4 py-3 text-center">Amount</th>
                          <th className="px-4 py-3 text-center">Method</th>
                          <th className="px-4 py-3 text-center">Transaction No.</th>
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

                            <td className="px-4 py-3 font-medium text-blue-700">
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

                            <td className="px-4 py-3 font-semibold tabular-nums text-green-700">
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
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3 border-t border-[#D1D5DB] bg-[#E5E7EB] px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
                <p className="text-center text-xs text-slate-600 sm:text-sm md:text-left">
                  Showing{" "}
                  <span className="font-semibold text-slate-800">
                    {startRecord}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-slate-800">
                    {endRecord}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-800">
                    {filteredRecords.length}
                  </span>{" "}
                  payments
                </p>

                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="min-w-24 text-center text-xs font-medium text-slate-600 sm:text-sm">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4"
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
            className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#D1D5DB] bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D1D5DB] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2
                  id="payment-modal-title"
                  className="text-base font-semibold text-slate-900 sm:text-lg"
                >
                  Record New Payment
                </h2>

                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Enter the customer's payment information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
                className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                <div className="relative">
                  <label
                    htmlFor="payment-ar"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Accounts Receivable
                  </label>

                  <div className="relative">
                    <input
                      id="payment-ar"
                      type="text"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={arDropdownOpen}
                      aria-controls="payment-ar-suggestions"
                      autoComplete="off"
                      value={
                        arSearch ||
                        (selectedAR
                          ? `AR-${selectedAR.AR_ID} · INV-${selectedAR.invoice_id} · ${selectedAR.customer_name}`
                          : "")
                      }
                      onFocus={(event) => {
                        setArSearch("");
                        setArDropdownOpen(true);
                        event.currentTarget.select();
                      }}
                      onBlur={() => {
                        setArDropdownOpen(false);
                      }}
                      onChange={(event) => {
                        setArSearch(event.target.value);
                        setArDropdownOpen(true);

                        setForm((current) => ({
                          ...current,
                          AR_ID: 0,
                          amount_paid: 0,
                        }));

                        setFormError("");
                      }}
                      placeholder={
                        hasOutstandingAccounts
                          ? "Search AR number, invoice, or customer..."
                          : "No outstanding accounts"
                      }
                      disabled={!hasOutstandingAccounts}
                      className="min-h-11 w-full rounded-lg border border-[#D1D5DB] bg-white py-2.5 pl-3 pr-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    />

                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </span>
                  </div>

                  {arDropdownOpen && hasOutstandingAccounts && (
                    <div
                      id="payment-ar-suggestions"
                      role="listbox"
                      className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#D1D5DB] bg-white shadow-lg"
                    >
                      {filteredReceivables.length === 0 ? (
                        <div className="px-4 py-5 text-center text-sm text-slate-500">
                          No matching accounts receivable found.
                        </div>
                      ) : (
                        filteredReceivables.map((record) => (
                          <button
                            key={record.AR_ID}
                            type="button"
                            role="option"
                            aria-selected={form.AR_ID === record.AR_ID}
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => selectReceivable(record)}
                            className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50 ${
                              form.AR_ID === record.AR_ID
                                ? "bg-blue-50"
                                : "bg-white"
                            }`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">
                                    AR-{record.AR_ID}
                                  </span>

                                  <span className="text-xs font-medium text-blue-700">
                                    INV-{record.invoice_id}
                                  </span>
                                </div>

                                <p className="mt-1 truncate text-sm text-slate-700">
                                  {record.customer_name}
                                </p>
                              </div>

                              <div className="shrink-0 sm:text-right">
                                <p className="text-xs text-slate-500">
                                  Outstanding Balance
                                </p>

                                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                                  {money(record.balance)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {selectedAR && !arDropdownOpen && (
                    <p className="mt-1.5 text-xs text-green-700">
                      <span className="font-semibold">Selected:</span>{" "}
                      AR-{selectedAR.AR_ID} · Invoice #{selectedAR.invoice_id}
                    </p>
                  )}
                </div>

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
                    max={getToday()}
                    onChange={(event) => {
                      setForm({
                        ...form,
                        payment_date: event.target.value,
                      });
                      setFormError("");
                    }}
                    required
                    className="min-h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

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
                    onChange={(event) => {
                      setForm({
                        ...form,
                        payment_method: event.target.value,
                        transaction_number: null,
                      });
                      setFormError("");
                    }}
                    className="min-h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Cash">Cash</option>
                    <option value="E-Wallet">E-Wallet</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

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
                      onChange={(event) => {
                        setForm({
                          ...form,
                          transaction_number: event.target.value,
                        });
                        setFormError("");
                      }}
                      required
                      maxLength={100}
                      placeholder="Enter e-wallet transaction number"
                      className="min-h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                )}

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
                    max={
                      selectedAR
                        ? Number(selectedAR.balance)
                        : undefined
                    }
                    value={form.amount_paid || ""}
                    onChange={(event) => {
                      setForm({
                        ...form,
                        amount_paid: Number(event.target.value),
                      });
                      setFormError("");
                    }}
                    required
                    placeholder="Enter payment amount"
                    className="min-h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {selectedAR && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-blue-800">
                        Remaining Balance
                      </span>

                      <span className="font-bold text-blue-900">
                        {money(selectedAR.balance)}
                      </span>
                    </div>
                  </div>
                )}

                {formError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#D1D5DB] bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || !hasOutstandingAccounts}
                  className="min-h-11 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-600">
        {title}
      </p>

      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${color}`}>
        {value}
      </p>
    </div>
  );
}
