
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { customerAPI, quotationAPI } from "@/lib/api";

import type {
  SalesQuotation,
  SalesQuotationCreate,
  QuotationCatalogItem,
  QuotationStatus,
} from "@/types/quotation";
import type { Customer } from "@/types/customer";

const statuses: Array<"All" | QuotationStatus> = [
  "All",
  "Draft",
  "Accepted",
  "Rejected",
];

const PAGE_SIZE = 10;

const INTEREST_RATES: Record<1 | 3 | 6 | 12, number> = {
  1: 0,
  3: 3,
  6: 5,
  12: 10,
};

interface DraftQuotationLine {
  IM_ID: number;
  quantity: number;
  discount: number;
}

export default function QuotationPanel() {
  const [quotations, setQuotations] = useState<SalesQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"All" | QuotationStatus>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [savingQuotationId, setSavingQuotationId] = useState<number | null>(
    null
  );
  const [selectedQuotation, setSelectedQuotation] =
    useState<SalesQuotation | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalogItems, setCatalogItems] = useState<QuotationCatalogItem[]>([]);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newInstallmentMonths, setNewInstallmentMonths] =
    useState<1 | 3 | 6 | 12>(1);
  const [newLines, setNewLines] = useState<DraftQuotationLine[]>([
    { IM_ID: 0, quantity: 1, discount: 0 },
  ]);

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await quotationAPI.getAll();
      setQuotations(data);
      setCurrentPage(1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load quotations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQuotations();
  }, [fetchQuotations]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);

  const formatDate = (date: string) => {
    if (!date) return "—";

    const dateOnly = date.split("T")[0];
    const [year, month, day] = dateOnly.split("-").map(Number);

    const parsedDate =
      year && month && day
        ? new Date(year, month - 1, day)
        : new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return "—";

    return parsedDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const filteredQuotations = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return quotations.filter((quotation) => {
      const quotationId = String(quotation.quotation_id);

      const formattedQuotationId = `qt-${String(
        quotation.quotation_id
      ).padStart(4, "0")}`;

      const customerId = String(quotation.customer_id);

      const quotationDate = quotation.quotation_date
        ? quotation.quotation_date.split("T")[0]
        : "";

      const formattedDate = formatDate(
        quotation.quotation_date
      ).toLowerCase();

      const totalAmount = String(
        Number(quotation.total_amount) || 0
      );

      const formattedAmount = formatCurrency(
        Number(quotation.total_amount) || 0
      ).toLowerCase();

      const quotationStatus = String(
        quotation.status ?? ""
      ).toLowerCase();

      const itemNames = (quotation.details ?? [])
        .map((detail) => detail.Item_Name ?? "")
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchTerm ||
        quotationId.includes(searchTerm) ||
        formattedQuotationId.includes(searchTerm) ||
        customerId.includes(searchTerm) ||
        `#${customerId}`.includes(searchTerm) ||
        quotationStatus.includes(searchTerm) ||
        quotationDate.includes(searchTerm) ||
        formattedDate.includes(searchTerm) ||
        totalAmount.includes(searchTerm) ||
        formattedAmount.includes(searchTerm) ||
        itemNames.includes(searchTerm);

      const matchesStatus =
        statusFilter === "All" || quotation.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotations, search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredQuotations.length / PAGE_SIZE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;

  const paginatedQuotations = filteredQuotations.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const startRecord =
    filteredQuotations.length === 0 ? 0 : startIndex + 1;

  const endRecord = Math.min(
    startIndex + PAGE_SIZE,
    filteredQuotations.length
  );

  const totalAmount = quotations.reduce(
    (sum, quotation) => sum + (Number(quotation.total_amount) || 0),
    0
  );

  const getStatusStyle = (status: QuotationStatus) => {
    const styles: Record<QuotationStatus, string> = {
      Draft: "bg-slate-100 text-slate-700",
      Sent: "bg-blue-100 text-blue-700",
      Accepted: "bg-emerald-100 text-emerald-700",
      Rejected: "bg-rose-100 text-rose-700",
      Expired: "bg-amber-100 text-amber-700",
    };

    return styles[status];
  };

  const handleStatusChange = async (
    quotationId: number,
    newStatus: QuotationStatus
  ) => {
    try {
      setSavingQuotationId(quotationId);
      setActionError("");

      const updatedQuotation = await quotationAPI.updateStatus(
        quotationId,
        newStatus
      );

      setQuotations((previous) =>
        previous.map((quotation) =>
          quotation.quotation_id === quotationId
            ? updatedQuotation
            : quotation
        )
      );

      setSelectedQuotation((previous) =>
        previous?.quotation_id === quotationId
          ? updatedQuotation
          : previous
      );
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to update quotation status."
      );
    } finally {
      setSavingQuotationId(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: "All" | QuotationStatus) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setCurrentPage(1);
  };

  const subtotal = newLines.reduce((sum, line) => {
    const item = catalogItems.find(
      (candidate) => candidate.IM_ID === line.IM_ID
    );

    const unitPrice = Number(item?.Price ?? 0);

    return (
      sum +
      unitPrice *
        line.quantity *
        (1 - line.discount / 100)
    );
  }, 0);

  const taxAmount = Number((subtotal * 0.12).toFixed(2));
  const interestRate = INTEREST_RATES[newInstallmentMonths];

  const interestAmount = Number(
    ((subtotal * interestRate) / 100).toFixed(2)
  );

  const quotationTotal = subtotal + taxAmount + interestAmount;

  const selectedQuotationSubtotal = (
    selectedQuotation?.details ?? []
  ).reduce(
    (sum, detail) => sum + (Number(detail.line_total) || 0),
    0
  );

  async function openCreateForm() {
    setCreateError("");
    setShowCreateForm(true);
    setCreateLoading(true);
    setNewCustomerId("");
    setNewInstallmentMonths(1);
    setNewLines([{ IM_ID: 0, quantity: 1, discount: 0 }]);

    try {
      const [customerData, itemData] = await Promise.all([
        customerAPI.getAll(),
        quotationAPI.getItems(),
      ]);

      setCustomers(customerData);
      setCatalogItems(itemData);
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to load quotation options."
      );
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleCreateQuotation() {
    setCreateError("");

    if (!newCustomerId) {
      setCreateError("Please select a customer.");
      return;
    }

    if (
      newLines.length === 0 ||
      newLines.some(
        (line) =>
          line.IM_ID <= 0 ||
          !Number.isInteger(line.quantity) ||
          line.quantity <= 0 ||
          !Number.isFinite(line.discount) ||
          line.discount < 0 ||
          line.discount > 100
      )
    ) {
      setCreateError(
        "Select valid items, quantities, and discounts between 0% and 100%."
      );
      return;
    }

    const data: SalesQuotationCreate = {
      customer_id: Number(newCustomerId),
      installment_months: newInstallmentMonths,
      details: newLines.map(({ IM_ID, quantity, discount }) => ({
        IM_ID,
        quantity,
        discount,
      })),
    };

    setCreateSaving(true);

    try {
      await quotationAPI.create(data);
      setShowCreateForm(false);
      await fetchQuotations();
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to create quotation."
      );
    } finally {
      setCreateSaving(false);
    }
  }

  const draftCount = quotations.filter(
    (quotation) => quotation.status === "Draft"
  ).length;

  const acceptedCount = quotations.filter(
    (quotation) => quotation.status === "Accepted"
  ).length;

  return (
    <div className="min-w-0 space-y-5 bg-white text-slate-800">
      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Quotations"
          value={quotations.length.toString()}
          description="All quotation records"
        />

        <SummaryCard
          title="Draft Quotations"
          value={draftCount.toString()}
          description="Quotations not yet sent"
        />

        <SummaryCard
          title="Accepted Quotations"
          value={acceptedCount.toString()}
          description="Quotations accepted by customers"
        />

        <SummaryCard
          title="Total Quotation Value"
          value={formatCurrency(totalAmount)}
          description="Combined value of all quotations"
        />
      </section>

      {/* Quotation Records */}
      <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        {/* Records Header */}
        <div className="flex flex-col gap-4 border-b border-[#D1D5DB] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">
              Quotation Records
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              View quotation items and update their current status.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap">
            <button
              type="button"
              onClick={() => void openCreateForm()}
              className="w-full whitespace-nowrap rounded-lg bg-[#3F7657] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#315F46] sm:w-auto"
            >
              + Create Quotation
            </button>

            {/* Search Bar */}
            <div className="relative min-w-0 flex-1 sm:min-w-[220px] lg:w-[280px] lg:flex-none">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>

              <input
                type="search"
                placeholder="Search quotations..."
                value={search}
                onChange={(event) =>
                  handleSearchChange(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3F7657] focus:ring-2 focus:ring-[#E8F0EA]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m18 6-12 12M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(event) =>
                handleFilterChange(
                  event.target.value as "All" | QuotationStatus
                )
              }
              aria-label="Filter quotations by status"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#3F7657] focus:ring-2 focus:ring-[#E8F0EA] sm:w-40"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === "All" ? "All Statuses" : status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Result Count */}
        {(search || statusFilter !== "All") && (
          <div className="flex flex-col gap-2 border-b border-[#D1D5DB] px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>
              Found {filteredQuotations.length} matching quotation
              {filteredQuotations.length !== 1 ? "s" : ""}
            </span>

            <button
              type="button"
              onClick={handleClearFilters}
              className="self-start font-medium text-[#315F46] transition hover:text-[#244C3A] sm:self-auto"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Status Update Error */}
        {actionError && (
          <div className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-5">
            {actionError}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="p-10 text-center text-sm text-slate-600">
            Loading quotations...
          </div>
        )}

        {/* Loading Error */}
        {!loading && error && (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-600">{error}</p>

            <button
              type="button"
              onClick={() => void fetchQuotations()}
              className="mt-3 rounded-lg bg-[#3F7657] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#315F46]"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Records */}
        {!loading && !error && (
          <>
            {/* Mobile Quotation Cards */}
            <div className="space-y-3 p-3 md:hidden">
              {paginatedQuotations.map((quotation) => (
                <div
                  key={quotation.quotation_id}
                  className="rounded-xl border border-[#D1D5DB] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500">
                        Quotation No.
                      </p>

                      <p className="mt-1 break-words font-bold text-slate-900">
                        QT-
                        {String(quotation.quotation_id).padStart(4, "0")}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                        quotation.status
                      )}`}
                    >
                      {quotation.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        Customer ID
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        #{quotation.customer_id}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        Quotation Date
                      </p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">
                        {formatDate(quotation.quotation_date)}
                      </p>
                    </div>

                    <div className="col-span-2 min-w-0">
                      <p className="text-xs text-slate-500">
                        Total Amount
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {formatCurrency(
                          Number(quotation.total_amount) || 0
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <label
                      htmlFor={`mobile-status-${quotation.quotation_id}`}
                      className="mb-2 block text-xs font-semibold text-slate-600"
                    >
                      Update Status
                    </label>

                    <select
                      id={`mobile-status-${quotation.quotation_id}`}
                      aria-label={`Update status for quotation ${quotation.quotation_id}`}
                      value={quotation.status}
                      disabled={
                        savingQuotationId !== null ||
                        quotation.status !== "Draft"
                      }
                      onChange={(event) =>
                        void handleStatusChange(
                          quotation.quotation_id,
                          event.target.value as QuotationStatus
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-[#3F7657] disabled:cursor-wait disabled:opacity-60"
                    >
                      {(quotation.status === "Draft"
                        ? ["Draft", "Accepted", "Rejected"] as QuotationStatus[]
                        : [quotation.status]
                      ).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    {savingQuotationId === quotation.quotation_id && (
                      <p className="mt-2 text-xs text-[#3F7657]">
                        Saving status...
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedQuotation(quotation)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3F7657] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#315F46]"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      View Items
                    </button>
                  </div>
                </div>
              ))}

              {filteredQuotations.length === 0 && (
                <div className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-12 text-center text-sm text-slate-600">
                  {quotations.length === 0
                    ? "No quotation records available."
                    : "No quotations match your search or selected filter."}
                </div>
              )}
            </div>

            {/* Desktop Quotation Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="px-5 py-4 text-center font-semibold">
                      Quotation No.
                    </th>

                    <th className="px-5 py-4 text-center font-semibold">
                      Customer ID
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Quotation Date
                    </th>

                    <th className="px-5 py-4 text-center font-semibold">
                      Total Amount
                    </th>

                    <th className="px-5 py-4 text-center font-semibold">
                      Status
                    </th>

                    <th className="px-5 py-4 text-center font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#D1D5DB]">
                  {paginatedQuotations.map((quotation) => (
                    <tr
                      key={quotation.quotation_id}
                      className="bg-[#E5E7EB] transition-colors hover:bg-[#DDE1E5]"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-center font-semibold text-slate-900">
                        QT-
                        {String(quotation.quotation_id).padStart(4, "0")}
                      </td>

                      <td className="px-5 py-4 text-center text-slate-700">
                        #{quotation.customer_id}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {formatDate(quotation.quotation_date)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-center font-semibold text-slate-900">
                        {formatCurrency(
                          Number(quotation.total_amount) || 0
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                          <span
                            className={`rounded-full px-3 py-1 text-center text-xs font-semibold ${getStatusStyle(
                              quotation.status
                            )}`}
                          >
                            {quotation.status}
                          </span>

                          <select
                            aria-label={`Update status for quotation ${quotation.quotation_id}`}
                            value={quotation.status}
                            disabled={
                              savingQuotationId !== null ||
                              quotation.status !== "Draft"
                            }
                            onChange={(event) =>
                              void handleStatusChange(
                                quotation.quotation_id,
                                event.target.value as QuotationStatus
                              )
                            }
                            className="max-w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-[#3F7657] disabled:cursor-wait disabled:opacity-60"
                          >
                            {(quotation.status === "Draft"
                              ? ["Draft", "Accepted", "Rejected"] as QuotationStatus[]
                              : [quotation.status]
                            ).map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        {savingQuotationId === quotation.quotation_id && (
                          <p className="mt-1 text-center text-xs text-[#3F7657]">
                            Saving...
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedQuotation(quotation)}
                          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#3F7657] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#315F46]"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          View Items
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredQuotations.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-slate-600"
                      >
                        {quotations.length === 0
                          ? "No quotation records available."
                          : "No quotations match your search or selected filter."}
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
                <span className="font-semibold text-slate-800">
                  {startRecord}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800">
                  {endRecord}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800">
                  {filteredQuotations.length}
                </span>{" "}
                quotations
              </p>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage(safeCurrentPage - 1)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="whitespace-nowrap px-1 text-sm font-medium text-slate-600">
                  Page {safeCurrentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() =>
                    setCurrentPage(safeCurrentPage + 1)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Create Quotation Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="my-auto max-h-[95dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-h-[92vh] sm:rounded-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Create Sales Quotation
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  The quotation total includes 12% VAT and installment
                  interest.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                disabled={createSaving}
                className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close quotation form"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
              >
                {createError}
              </div>
            )}

            {createLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Loading customers and items...
              </p>
            ) : (
              <div className="space-y-5">
                {/* Customer */}
                <div>
                  <label
                    htmlFor="quotation-customer"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Customer
                  </label>

                  <select
                    id="quotation-customer"
                    value={newCustomerId}
                    onChange={(event) =>
                      setNewCustomerId(event.target.value)
                    }
                    disabled={createSaving}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
                  >
                    <option value="">Select customer</option>

                    {customers
                      .filter((customer) => customer.status)
                      .map((customer) => (
                        <option
                          key={customer.customer_id}
                          value={customer.customer_id}
                        >
                          {customer.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Quoted Items */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    Quoted Items
                  </h3>

                  <div className="space-y-3">
                    {newLines.map((line, index) => (
                      <div
                        key={index}
                        className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_90px_110px_auto] sm:items-end"
                      >
                        <div className="min-w-0">
                          <label
                            htmlFor={`quotation-item-${index}`}
                            className="mb-1 block text-xs font-medium text-slate-600 sm:hidden"
                          >
                            Item
                          </label>

                          <select
                            id={`quotation-item-${index}`}
                            aria-label="Quoted item"
                            value={line.IM_ID || ""}
                            onChange={(event) =>
                              setNewLines((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        IM_ID: Number(event.target.value),
                                      }
                                    : entry
                                )
                              )
                            }
                            disabled={createSaving}
                            className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
                          >
                            <option value="">Select item</option>

                            {catalogItems.map((item) => (
                              <option
                                key={item.IM_ID}
                                value={item.IM_ID}
                              >
                                {item.SKU} — {item.Item_Name} (
                                {formatCurrency(Number(item.Price ?? 0))})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`quotation-quantity-${index}`}
                            className="mb-1 block text-xs font-medium text-slate-600"
                          >
                            Quantity
                          </label>

                          <input
                            id={`quotation-quantity-${index}`}
                            aria-label="Quantity"
                            type="number"
                            min="1"
                            step="1"
                            value={line.quantity}
                            onChange={(event) =>
                              setNewLines((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        quantity: Number(event.target.value),
                                      }
                                    : entry
                                )
                              )
                            }
                            disabled={createSaving}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`quotation-discount-${index}`}
                            className="mb-1 block text-xs font-medium text-slate-600"
                          >
                            Discount (%)
                          </label>

                          <input
                            id={`quotation-discount-${index}`}
                            aria-label="Discount percent"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={line.discount}
                            onChange={(event) =>
                              setNewLines((current) =>
                                current.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        discount: Number(event.target.value),
                                      }
                                    : entry
                                )
                              )
                            }
                            disabled={createSaving}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setNewLines((current) =>
                              current.filter((_, i) => i !== index)
                            )
                          }
                          disabled={
                            createSaving || newLines.length === 1
                          }
                          className="rounded-lg border border-rose-200 bg-white px-3 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 sm:border-0 sm:bg-transparent sm:px-2"
                        >
                          Remove item
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setNewLines((current) => [
                        ...current,
                        { IM_ID: 0, quantity: 1, discount: 0 },
                      ])
                    }
                    disabled={createSaving}
                    className="mt-3 rounded-lg px-1 py-2 text-sm font-semibold text-[#3F7657] transition hover:text-[#244C3A]"
                  >
                    + Add item
                  </button>
                </div>

                {/* Installment */}
                <div>
                  <label
                    htmlFor="quotation-installment"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Payment Installment
                  </label>

                  <select
                    id="quotation-installment"
                    value={newInstallmentMonths}
                    onChange={(event) =>
                      setNewInstallmentMonths(
                        Number(event.target.value) as 1 | 3 | 6 | 12
                      )
                    }
                    disabled={createSaving}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
                  >
                    <option value={1}>1 Month — 0% Interest</option>
                    <option value={3}>3 Months — 3% Interest</option>
                    <option value={6}>6 Months — 5% Interest</option>
                    <option value={12}>1 Year — 10% Interest</option>
                  </select>
                </div>

                {/* Quotation Summary */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">
                      Items subtotal
                    </span>
                    <span className="text-right font-medium text-slate-800">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">VAT (12%)</span>
                    <span className="text-right font-medium text-slate-800">
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">
                      Installment interest ({interestRate}%)
                    </span>
                    <span className="text-right font-medium text-slate-800">
                      {formatCurrency(interestAmount)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 font-bold text-slate-900 sm:flex-row sm:justify-between">
                    <span>Quotation total</span>
                    <span className="text-lg">
                      {formatCurrency(quotationTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Create Form Footer */}
            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                disabled={createSaving}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:py-2.5"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleCreateQuotation()}
                disabled={
                  createLoading ||
                  createSaving ||
                  !newCustomerId
                }
                className="w-full rounded-lg bg-[#3F7657] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#315F46] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
              >
                {createSaving ? "Creating..." : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Items Modal */}
      {selectedQuotation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setSelectedQuotation(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-modal-title"
            className="flex max-h-[95dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#D1D5DB] bg-[#244C3A] px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-100">
                  Quotation Details
                </p>

                <h2
                  id="quotation-modal-title"
                  className="mt-1 break-words text-lg font-bold text-white sm:text-xl"
                >
                  QT-
                  {String(selectedQuotation.quotation_id).padStart(4, "0")}
                </h2>

                <p className="mt-1 text-xs text-green-100 sm:text-sm">
                  Review the items included in this quotation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedQuotation(null)}
                aria-label="Close quotation details"
                className="shrink-0 rounded-lg p-2 text-white transition hover:bg-white/15"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {/* Quotation Information */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Customer ID
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    #{selectedQuotation.customer_id}
                  </p>
                </div>

                <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Quotation Date
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatDate(selectedQuotation.quotation_date)}
                  </p>
                </div>

                <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Status
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                      selectedQuotation.status
                    )}`}
                  >
                    {selectedQuotation.status}
                  </span>
                </div>
              </div>

              {/* Quoted Items */}
              <div>
                <div className="mb-3">
                  <h3 className="font-bold text-slate-900">
                    Quoted Items
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedQuotation.details?.length ?? 0} item
                    {(selectedQuotation.details?.length ?? 0) !== 1
                      ? "s"
                      : ""}{" "}
                    included in this quotation
                  </p>
                </div>

                {/* Mobile Item Cards */}
                <div className="space-y-3 md:hidden">
                  {(selectedQuotation.details ?? []).map((detail) => (
                    <div
                      key={detail.quotation_detail_id}
                      className="rounded-xl border border-[#D1D5DB] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">
                            Item ID #{detail.IM_ID}
                          </p>

                          <p className="mt-1 break-words font-semibold text-slate-900">
                            {detail.Item_Name || "Item name unavailable"}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Qty: {detail.quantity}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
                        <div>
                          <p className="text-xs text-slate-500">
                            Unit Price
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {formatCurrency(
                              Number(detail.unit_price) || 0
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">
                            Discount
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {formatCurrency(
                              Number(detail.discount) || 0
                            )}
                          </p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">
                            Subtotal
                          </p>
                          <p className="mt-1 font-bold text-slate-900">
                            {formatCurrency(
                              Number(detail.line_total) || 0
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(selectedQuotation.details ?? []).length === 0 && (
                    <div className="rounded-xl border border-[#D1D5DB] bg-white px-4 py-10 text-center text-sm text-slate-500">
                      No item details found for this quotation.
                    </div>
                  )}
                </div>

                {/* Desktop Item Table */}
                <div className="hidden overflow-x-auto rounded-xl border border-[#D1D5DB] md:block">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead className="bg-[#E5E7EB] text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-center font-semibold">
                          Item ID
                        </th>

                        <th className="px-4 py-3 text-left font-semibold">
                          Item Name
                        </th>

                        <th className="px-4 py-3 text-center font-semibold">
                          Quantity
                        </th>

                        <th className="px-4 py-3 text-right font-semibold">
                          Unit Price
                        </th>

                        <th className="px-4 py-3 text-right font-semibold">
                          Discount
                        </th>

                        <th className="px-4 py-3 text-right font-semibold">
                          Subtotal
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#D1D5DB]">
                      {(selectedQuotation.details ?? []).map((detail) => (
                        <tr
                          key={detail.quotation_detail_id}
                          className="bg-white transition hover:bg-[#F8FAF8]"
                        >
                          <td className="px-4 py-4 text-center text-slate-600">
                            #{detail.IM_ID}
                          </td>

                          <td className="px-4 py-4 font-semibold text-slate-900">
                            {detail.Item_Name || "Item name unavailable"}
                          </td>

                          <td className="px-4 py-4 text-center text-slate-700">
                            {detail.quantity}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">
                            {formatCurrency(
                              Number(detail.unit_price) || 0
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">
                            {formatCurrency(
                              Number(detail.discount) || 0
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-900">
                            {formatCurrency(
                              Number(detail.line_total) || 0
                            )}
                          </td>
                        </tr>
                      ))}

                      {(selectedQuotation.details ?? []).length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-10 text-center text-slate-500"
                          >
                            No item details found for this quotation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quotation Total */}
              <div className="flex justify-end">
                <div className="w-full space-y-3 rounded-xl border border-[#D1D5DB] bg-[#E8F0EA] p-4 text-sm sm:w-96 sm:p-5">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">
                      Items subtotal
                    </span>
                    <span className="text-right font-medium text-slate-800">
                      {formatCurrency(selectedQuotationSubtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">
                      {selectedQuotation.tax_type} (
                      {Number(selectedQuotation.tax_rate).toFixed(2)}%)
                    </span>
                    <span className="text-right font-medium text-slate-800">
                      {formatCurrency(
                        Number(selectedQuotation.tax_amount) || 0
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">
                      Installment (
                      {selectedQuotation.installment_months === 12
                        ? "1 year"
                        : `${selectedQuotation.installment_months} months`}
                      , {Number(selectedQuotation.interest_rate).toFixed(2)}%)
                    </span>
                    <span className="text-right font-medium text-slate-800">
                      {formatCurrency(
                        Number(selectedQuotation.interest_amount) || 0
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-[#C7D7CA] pt-3 font-bold text-[#244C3A] sm:flex-row sm:justify-between">
                    <span>Total Quotation Amount</span>
                    <span className="text-lg">
                      {formatCurrency(
                        Number(selectedQuotation.total_amount) || 0
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#D1D5DB] bg-white px-4 py-3 sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={() => setSelectedQuotation(null)}
                className="w-full rounded-lg bg-[#3F7657] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#315F46] sm:w-auto sm:py-2.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-slate-600">
        {title}
      </p>

      <h3 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </h3>

      <p className="mt-2 text-xs text-slate-600">
        {description}
      </p>
    </div>
  );
}
