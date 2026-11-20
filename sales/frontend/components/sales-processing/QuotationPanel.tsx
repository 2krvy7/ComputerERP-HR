
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { quotationAPI } from "@/lib/api";

import type {
  SalesQuotation,
  QuotationStatus,
} from "@/types/quotation";

const statuses: Array<"All" | QuotationStatus> = [
  "All",
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
  "Expired",
];

const PAGE_SIZE = 10;

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

  const draftCount = quotations.filter(
    (quotation) => quotation.status === "Draft"
  ).length;

  const acceptedCount = quotations.filter(
    (quotation) => quotation.status === "Accepted"
  ).length;

  return (
    <div className="min-w-0 space-y-5 bg-green-50 text-slate-800">
      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="flex flex-col gap-4 border-b border-[#D1D5DB] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">
              Quotation Records
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              View quotation items and update their current status.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search Bar */}
            <div className="relative min-w-0 flex-1 lg:w-[320px] lg:flex-none">
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
                placeholder="Search quotation, customer, item, or status..."
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
          <div className="flex items-center justify-between gap-3 border-b border-[#D1D5DB] px-5 py-3 text-xs text-slate-600">
            <span>
              Found {filteredQuotations.length} matching quotation
              {filteredQuotations.length !== 1 ? "s" : ""}
            </span>

            <button
              type="button"
              onClick={handleClearFilters}
              className="font-medium text-[#315F46] transition hover:text-[#244C3A]"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Status Update Error */}
        {actionError && (
          <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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

        {/* Table and Pagination */}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
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
                        QT-{String(quotation.quotation_id).padStart(4, "0")}
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
                            disabled={savingQuotationId !== null}
                            onChange={(event) =>
                              void handleStatusChange(
                                quotation.quotation_id,
                                event.target.value as QuotationStatus
                              )
                            }
                            className="max-w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#3F7657] disabled:cursor-wait disabled:opacity-60"
                          >
                            {statuses
                              .filter((status) => status !== "All")
                              .map((status) => (
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

                      {/* View Items */}
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
                  {filteredQuotations.length}
                </span>
                {" "}quotations
              </p>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage(safeCurrentPage - 1)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="px-2 text-sm font-medium text-slate-600">
                  Page {safeCurrentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() =>
                    setCurrentPage(safeCurrentPage + 1)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Quotation Items Modal */}
      {selectedQuotation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setSelectedQuotation(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-modal-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#D1D5DB] bg-[#244C3A] px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-green-100">
                  Quotation Details
                </p>

                <h2
                  id="quotation-modal-title"
                  className="mt-1 text-xl font-bold text-white"
                >
                  QT-
                  {String(selectedQuotation.quotation_id).padStart(4, "0")}
                </h2>

                <p className="mt-1 text-sm text-green-100">
                  Review the items included in this quotation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedQuotation(null)}
                aria-label="Close quotation details"
                className="rounded-lg p-2 text-white transition hover:bg-white/15"
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
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              {/* Quotation Information */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

              {/* Items Table */}
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

                <div className="overflow-x-auto rounded-xl border border-[#D1D5DB]">
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
                            {formatCurrency(Number(detail.unit_price) || 0)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">
                            {formatCurrency(Number(detail.discount) || 0)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-slate-900">
                            {formatCurrency(Number(detail.line_total) || 0)}
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

              {/* Total */}
              <div className="flex justify-end">
                <div className="w-full rounded-xl border border-[#D1D5DB] bg-[#E8F0EA] p-5 sm:w-80">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-slate-600">
                      Total Quotation Amount
                    </span>

                    <span className="text-xl font-bold text-[#244C3A]">
                      {formatCurrency(
                        Number(selectedQuotation.total_amount) || 0
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-[#D1D5DB] bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedQuotation(null)}
                className="rounded-lg bg-[#3F7657] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#315F46]"
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
    <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-sm">
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
