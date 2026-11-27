
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { salesOrderAPI } from "../../lib/api";
import type { FinishedGoodItem } from "../../types/order";

const PAGE_SIZE = 10;

type SellingPriceItem = FinishedGoodItem & {
  status?: string | null;
};

const isEligibleItem = (item: SellingPriceItem) => {
  const status = String(item.status ?? "").trim().toLowerCase();
  const itemType = String(item.ItemType ?? "").trim().toLowerCase();

  const isActive = status === "active" || status === "true";

  const isFinishedGood = [
    "finished",
    "finished good",
    "finished goods",
    "finished product",
    "finished products",
  ].includes(itemType);

  return isActive && isFinishedGood;
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function SellingPricesPage() {
  const [items, setItems] = useState<SellingPriceItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);

  const [selectedItem, setSelectedItem] =
    useState<SellingPriceItem | null>(null);
  const [markupInput, setMarkupInput] = useState("");

  const loadItems = useCallback(async (searchTerm = "") => {
    try {
      setLoading(true);
      setError("");

      const data = await salesOrderAPI.getFinishedGoods(searchTerm);

      const eligibleItems = (data as SellingPriceItem[]).filter(
        isEligibleItem
      );

      setItems(eligibleItems);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load finished goods."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      void loadItems(search.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, loadItems]);

  const minimumSellingPrice = Number(
    selectedItem?.minimum_selling_price ?? 0
  );

  const markupPercentage = Number(markupInput);

  const calculatedPrice =
    minimumSellingPrice * (1 + markupPercentage / 100);

  const hasMinimumPrice =
    selectedItem?.minimum_selling_price !== null &&
    selectedItem?.minimum_selling_price !== undefined &&
    selectedItem?.minimum_selling_price !== "" &&
    Number.isFinite(minimumSellingPrice) &&
    minimumSellingPrice >= 0;

  const validMarkup =
    markupInput.trim() !== "" &&
    Number.isFinite(markupPercentage) &&
    markupPercentage >= 0;

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

  const openEditor = (item: SellingPriceItem) => {
    setSelectedItem(item);
    setMarkupInput(
      item.markup_percentage === null ||
        item.markup_percentage === undefined
        ? ""
        : String(item.markup_percentage)
    );
    setError("");
    setSuccess("");
  };

  const closeEditor = () => {
    if (saving) return;

    setSelectedItem(null);
    setMarkupInput("");
    setError("");
  };

  const saveSellingPrice = async () => {
    if (!selectedItem) return;

    if (!hasMinimumPrice) {
      setError(
        "Finance's minimum selling price is unavailable for this item. Please check the Finance integration."
      );
      return;
    }

    if (!validMarkup) {
      setError("Please enter a valid markup percentage.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updatedItem = await salesOrderAPI.updateSellingPrice(
        selectedItem.IM_ID,
        markupPercentage
      );

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.IM_ID === selectedItem.IM_ID
            ? { ...item, ...updatedItem }
            : item
        )
      );

      setSuccess(
        `Selling price for ${selectedItem.Item_Name} was updated successfully.`
      );

      setSelectedItem(null);
      setMarkupInput("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the selling price."
      );
    } finally {
      setSaving(false);
    }
  };

  const firstRecord =
    items.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;

  const lastRecord = Math.min(
    safePage * PAGE_SIZE,
    items.length
  );

  return (
    <div className="min-w-0 space-y-5 bg-white text-[#374151]">
      <div>
        <p className="text-sm leading-relaxed text-gray-500">
          Set selling prices for active finished goods using the
          minimum selling price provided by Finance and your chosen
          markup percentage.
        </p>
      </div>

      {success && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
            className="shrink-0 font-semibold text-green-700 hover:text-green-900"
          >
            ✕
          </button>
        </div>
      )}

      {error && !selectedItem && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#374151]">
              Finished Goods
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Only active finished goods are displayed in this list.
            </p>
          </div>

          <div className="w-full sm:max-w-xs">
            <label
              htmlFor="finished-goods-search"
              className="sr-only"
            >
              Search finished goods
            </label>

            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
                id="finished-goods-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item name or SKU..."
                className="w-full rounded-lg border border-[#D1D5DB] bg-white py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition focus:border-[#3F7657] focus:ring-2 focus:ring-[#3F7657]/20"
              />
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-12 text-center text-sm text-gray-500">
            Loading finished goods...
          </div>
        )}

        {!loading && error && !selectedItem && (
          <div className="rounded-lg border border-red-200 bg-white px-4 py-10 text-center">
            <p className="text-sm text-red-600">{error}</p>

            <button
              type="button"
              onClick={() => void loadItems(search.trim())}
              className="mt-3 rounded-lg bg-[#3F7657] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#315F46]"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="space-y-3 md:hidden">
              {paginatedItems.map((item) => (
                <div
                  key={item.IM_ID}
                  className="rounded-lg border border-[#D1D5DB] bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">
                      Item Name
                    </p>

                    <h3 className="mt-1 break-words font-semibold text-gray-900">
                      {item.Item_Name}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-gray-200 pt-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        Selling Price
                      </p>

                      <p className="mt-1 break-words text-lg font-bold tabular-nums text-[#244C3A]">
                        {formatCurrency(item.Price)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditor(item)}
                      className="shrink-0 rounded-lg bg-[#3F7657] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#315F46]"
                    >
                      Set Price
                    </button>
                  </div>
                </div>
              ))}

              {paginatedItems.length === 0 && (
                <div className="rounded-lg border border-[#D1D5DB] bg-white px-4 py-12 text-center text-sm text-gray-500">
                  No active finished goods found.
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-[#D1D5DB] bg-white md:block">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[#244C3A] text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      Item
                    </th>

                    <th className="px-4 py-3 text-right font-semibold">
                      Selling Price
                    </th>

                    <th className="px-4 py-3 text-center font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {paginatedItems.map((item) => (
                    <tr
                      key={item.IM_ID}
                      className="transition hover:bg-[#F3F6F4]"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {item.Item_Name}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#244C3A]">
                        {formatCurrency(item.Price)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => openEditor(item)}
                          className="rounded-md bg-[#3F7657] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#315F46]"
                        >
                          Set Price
                        </button>
                      </td>
                    </tr>
                  ))}

                  {paginatedItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        No active finished goods found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-[#D1D5DB] pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-gray-600 sm:text-left">
                Showing{" "}
                <span className="font-semibold text-gray-800">
                  {firstRecord}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-gray-800">
                  {lastRecord}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-800">
                  {items.length}
                </span>{" "}
                items
              </p>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1 || loading}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="whitespace-nowrap text-sm text-gray-600">
                  Page {safePage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={safePage >= totalPages || loading}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(totalPages, current + 1)
                    )
                  }
                  className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={closeEditor}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="selling-price-title"
            className="my-auto max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 rounded-t-xl bg-[#244C3A] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2
                  id="selling-price-title"
                  className="text-lg font-semibold text-white"
                >
                  Set Selling Price
                </h2>

                <p className="mt-1 break-words text-sm text-green-100">
                  {selectedItem.Item_Name} ({selectedItem.SKU})
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                aria-label="Close selling price form"
                className="shrink-0 rounded-lg p-2 text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Finance Minimum Selling Price
                </label>

                <div className="rounded-lg border border-[#D1D5DB] bg-gray-100 px-4 py-3 font-semibold text-gray-700">
                  {hasMinimumPrice
                    ? formatCurrency(selectedItem.minimum_selling_price)
                    : "Unavailable from Finance"}
                </div>

                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  VAT-exclusive minimum price retrieved from Finance.
                  This value cannot be edited in Sales.
                </p>
              </div>

              <div>
                <label
                  htmlFor="markup"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Markup Percentage (%)
                </label>

                <input
                  id="markup"
                  type="number"
                  min="0"
                  step="0.01"
                  value={markupInput}
                  onChange={(event) =>
                    setMarkupInput(event.target.value)
                  }
                  placeholder="Enter markup percentage"
                  disabled={saving || !hasMinimumPrice}
                  className="w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-[#3F7657] focus:ring-2 focus:ring-[#3F7657]/20 disabled:bg-gray-100"
                />
              </div>

              <div className="rounded-lg border border-[#C8D8CC] bg-[#E8F0EA] p-4">
                <p className="text-sm font-medium text-[#315F46]">
                  Calculated Selling Price
                </p>

                <p className="mt-1 break-words text-2xl font-bold text-[#244C3A]">
                  {validMarkup && hasMinimumPrice
                    ? formatCurrency(calculatedPrice)
                    : "—"}
                </p>

                <p className="mt-2 text-xs text-gray-600">
                  Finance Minimum Selling Price × (1 + Markup ÷ 100)
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="w-full rounded-lg border border-[#D1D5DB] px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 sm:w-auto sm:py-2.5"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void saveSellingPrice()}
                  disabled={
                    saving ||
                    !validMarkup ||
                    !hasMinimumPrice
                  }
                  className="w-full rounded-lg bg-[#3F7657] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#315F46] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5"
                >
                  {saving ? "Saving..." : "Save Selling Price"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
