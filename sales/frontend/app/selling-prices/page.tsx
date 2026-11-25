
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { salesOrderAPI } from "../../lib/api";
import type { FinishedGoodItem } from "../../types/order";

const PAGE_SIZE = 10;

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

export default function SellingPricesPage() {
  const [items, setItems] = useState<FinishedGoodItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);

  const [selectedItem, setSelectedItem] =
    useState<FinishedGoodItem | null>(null);
  const [markupInput, setMarkupInput] = useState("");

  const loadItems = useCallback(async (searchTerm = "") => {
    try {
      setLoading(true);
      setError("");

      const data = await salesOrderAPI.getFinishedGoods(searchTerm);
      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load finished goods.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      loadItems(search.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, loadItems]);

  const productionCost = Number(selectedItem?.production_cost ?? 0);
  const markupPercentage = Number(markupInput);

  const calculatedPrice =
    productionCost * (1 + markupPercentage / 100);

  const validMarkup =
    markupInput.trim() !== "" &&
    Number.isFinite(markupPercentage) &&
    markupPercentage >= 0;

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / PAGE_SIZE),
  );

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const openEditor = (item: FinishedGoodItem) => {
    setSelectedItem(item);
    setMarkupInput(
      item.markup_percentage === null ||
        item.markup_percentage === undefined
        ? ""
        : String(item.markup_percentage),
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

    if (
      selectedItem.production_cost === null ||
      selectedItem.production_cost === undefined
    ) {
      setError(
        "Production cost has not been provided by Finance for this item.",
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
        markupPercentage,
      );

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.IM_ID === selectedItem.IM_ID
            ? { ...item, ...updatedItem }
            : item,
        ),
      );

      setSuccess(
        `Selling price for ${selectedItem.Item_Name} was updated successfully.`,
      );

      setSelectedItem(null);
      setMarkupInput("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the selling price.",
      );
    } finally {
      setSaving(false);
    }
  };

  const firstRecord =
    items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const lastRecord = Math.min(page * PAGE_SIZE, items.length);

  return (
    <div className="min-h-full bg-green-50 p-6 text-[#374151]">
      <div className="mb-6">
        <p className="mt-1 text-sm text-gray-500">
          Set selling prices for finished goods using the production
          cost provided by Finance and your chosen markup percentage.
        </p>
      </div>

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      {error && !selectedItem && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-[#374151]">
              Finished Goods
            </h2>
            <p className="text-sm text-gray-600">
              Only finished goods are displayed in this list.
            </p>
          </div>

          <div className="w-full sm:max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item name or SKU..."
              className="w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#3F7657] focus:ring-2 focus:ring-[#3F7657]/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#D1D5DB] bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[#244C3A] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Selling Price
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    Loading finished goods...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No finished goods found.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => (
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
                        className="rounded-md bg-[#3F7657] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#315F46]"
                      >
                        Set Price
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
          <p className="text-gray-600">
            Showing {firstRecord} to {lastRecord} of {items.length} items
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-gray-600">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="rounded-t-xl bg-[#244C3A] px-6 py-4">
              <h2 className="text-lg font-semibold text-white">
                Set Selling Price
              </h2>
              <p className="mt-1 text-sm text-green-100">
                {selectedItem.Item_Name} ({selectedItem.SKU})
              </p>
            </div>

            <div className="space-y-5 p-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Production Cost
                </label>
                <div className="rounded-lg border border-[#D1D5DB] bg-gray-100 px-4 py-3 font-semibold text-gray-700">
                  {formatCurrency(selectedItem.production_cost)}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Provided by Finance. This value cannot be edited here.
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
                  onChange={(event) => setMarkupInput(event.target.value)}
                  placeholder="Enter markup percentage"
                  className="w-full rounded-lg border border-[#D1D5DB] px-4 py-3 outline-none transition focus:border-[#3F7657] focus:ring-2 focus:ring-[#3F7657]/20"
                />
              </div>

              <div className="rounded-lg border border-[#C8D8CC] bg-[#E8F0EA] p-4">
                <p className="text-sm font-medium text-[#315F46]">
                  Calculated Selling Price
                </p>

                <p className="mt-1 text-2xl font-bold text-[#244C3A]">
                  {validMarkup &&
                  selectedItem.production_cost !== null &&
                  selectedItem.production_cost !== undefined
                    ? formatCurrency(calculatedPrice)
                    : "—"}
                </p>

                <p className="mt-2 text-xs text-gray-600">
                  Production Cost × (1 + Markup ÷ 100)
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="rounded-lg border border-[#D1D5DB] px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveSellingPrice}
                  disabled={
                    saving ||
                    !validMarkup ||
                    selectedItem.production_cost === null ||
                    selectedItem.production_cost === undefined
                  }
                  className="rounded-lg bg-[#3F7657] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#315F46] disabled:cursor-not-allowed disabled:opacity-50"
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
