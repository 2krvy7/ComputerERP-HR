
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { customerAPI, salesOrderAPI } from "../../lib/api";

import type { Customer } from "../../types/customer";
import type {
  SalesOrder,
  SalesOrderCreate,
  SalesOrderItem,
  SalesOrderStatus,
} from "../../types/order";

interface OrderLine {
  lineId: number;
  IM_ID: number;
  quantity: number;
  discount: number;
}

interface StockIssue {
  IM_ID: number;
  itemName: string;
  requested: number;
  available: number;
}

const PAGE_SIZE = 10;

const money = (amount: string | number) =>
  `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const statusStyles: Partial<Record<SalesOrderStatus, string>> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Accepted: "border-blue-200 bg-blue-50 text-blue-700",
  Approved: "border-blue-200 bg-blue-50 text-blue-700",
  Cancelled: "border-red-200 bg-red-50 text-red-700",
  Processing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Completed: "border-green-200 bg-green-50 text-green-700",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [itemCatalog, setItemCatalog] = useState<
    Record<number, SalesOrderItem>
  >({});

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [taxType, setTaxType] = useState<"VAT" | "Non-VAT" | "Tax-Exempt" | "Custom">("VAT");
  const [customTaxRate, setCustomTaxRate] = useState("0");
  const [installmentMonths, setInstallmentMonths] = useState<1 | 3 | 6 | 12>(1);

  const [nextLineId, setNextLineId] = useState(2);
  const [lines, setLines] = useState<OrderLine[]>([
    { lineId: 1, IM_ID: 0, quantity: 1, discount: 0 },
  ]);

  const [itemQueries, setItemQueries] = useState<Record<number, string>>({});
  const [activeItemLine, setActiveItemLine] = useState<number | null>(null);

  const customerSelected = customerId !== "";
  const selectedTaxRate = taxType === "VAT" ? 12 :
    taxType === "Custom" ? Number(customTaxRate) : 0;
  const estimatedOrderSubtotal = lines.reduce((sum, line) => {
    const price = Number(itemCatalog[line.IM_ID]?.Price ?? 0);
    return sum + price * line.quantity * (1 - line.discount / 100);
  }, 0);
  const estimatedTax = Number((estimatedOrderSubtotal * selectedTaxRate / 100).toFixed(2));
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await salesOrderAPI.getAll();
      setOrders(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load sales orders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await customerAPI.getAll();
      setCustomers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load customers."
      );
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);

    try {
      const data = await salesOrderAPI.getItems();

      setItems(data);

      setItemCatalog((current) => {
        const updated = { ...current };

        data.forEach((item) => {
          updated[item.IM_ID] = item;
        });

        return updated;
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load items."
      );
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadCustomers();
    void loadItems();
  }, [loadOrders, loadCustomers, loadItems]);


  const customerMap = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          customer.customer_id,
          customer.name,
        ])
      ),
    [customers]
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return orders;

    return orders.filter((order) => {
      const customerName = customerMap.get(order.customer_id) ?? "";

      return (
        String(order.order_id).includes(term) ||
        customerName.toLowerCase().includes(term) ||
        order.status.toLowerCase().includes(term)
      );
    });
  }, [orders, search, customerMap]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;

  const paginatedOrders = useMemo(
    () => filteredOrders.slice(startIndex, startIndex + PAGE_SIZE),
    [filteredOrders, startIndex]
  );

  const endRecord = Math.min(
    startIndex + PAGE_SIZE,
    filteredOrders.length
  );

  const totalSales = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const pendingOrders = orders.filter(
    (order) => order.status === "Pending"
  ).length;

  const acceptedOrders = orders.filter(
    (order) => order.status === "Accepted" || order.status === "Approved"
  ).length;

  const requestedByItem = useMemo(() => {
    const totals = new Map<number, number>();

    lines.forEach((line) => {
      if (line.IM_ID > 0 && line.quantity > 0) {
        totals.set(
          line.IM_ID,
          (totals.get(line.IM_ID) ?? 0) + line.quantity
        );
      }
    });

    return totals;
  }, [lines]);

  const stockIssues = useMemo<StockIssue[]>(() => {
    const issues: StockIssue[] = [];

    requestedByItem.forEach((requested, itemId) => {
      const item = itemCatalog[itemId];

      if (!item) return;

      const available = Number(item.stock_available ?? 0);

      if (requested > available) {
        issues.push({
          IM_ID: itemId,
          itemName: item.Item_Name,
          requested,
          available,
        });
      }
    });

    return issues;
  }, [requestedByItem, itemCatalog]);

  const hasStockIssues = stockIssues.length > 0;

  const selectItems = useMemo(() => {
    const combined = new Map<number, SalesOrderItem>();

    items.forEach((item) => combined.set(item.IM_ID, item));

    lines.forEach((line) => {
      if (line.IM_ID > 0 && itemCatalog[line.IM_ID]) {
        combined.set(line.IM_ID, itemCatalog[line.IM_ID]);
      }
    });

    return Array.from(combined.values());
  }, [items, lines, itemCatalog]);

  function updateLineById(
    lineId: number,
    changes: Partial<OrderLine>
  ) {
    setLines((current) =>
      current.map((line) =>
        line.lineId === lineId ? { ...line, ...changes } : line
      )
    );
  }

  function handleItemSearch(line: OrderLine, value: string) {
    if (!customerSelected) return;

    setItemQueries((current) => ({
      ...current,
      [line.lineId]: value,
    }));

    updateLineById(line.lineId, { IM_ID: 0 });
    setActiveItemLine(line.lineId);
  }

  function chooseItem(line: OrderLine, item: SalesOrderItem) {
    if (!customerSelected) return;

    updateLineById(line.lineId, { IM_ID: item.IM_ID });

    setItemQueries((current) => ({
      ...current,
      [line.lineId]: `${item.SKU} - ${item.Item_Name}`,
    }));

    setActiveItemLine(null);
  }

  function addLine() {
    if (!customerSelected || saving) return;

    const newLineId = nextLineId;

    setLines((current) => [
      ...current,
      {
        lineId: newLineId,
        IM_ID: 0,
        quantity: 1,
        discount: 0,
      },
    ]);

    setNextLineId((current) => current + 1);
  }

  function removeLine(index: number) {
    if (!customerSelected || saving || lines.length === 1) return;

    const removedLine = lines[index];

    setLines((current) => current.filter((_, i) => i !== index));

    if (removedLine) {
      setItemQueries((current) => {
        const updated = { ...current };
        delete updated[removedLine.lineId];
        return updated;
      });

      if (activeItemLine === removedLine.lineId) {
        setActiveItemLine(null);
      }
    }
  }

  function resetForm() {
    setCustomerId("");
    setTaxType("VAT");
    setCustomTaxRate("0");
    setInstallmentMonths(1);
    setLines([{ lineId: 1, IM_ID: 0, quantity: 1, discount: 0 }]);
    setNextLineId(2);
    setItemQueries({});
    setActiveItemLine(null);
    setShowForm(false);
  }

  async function handleCreateOrder() {
    setError("");

    if (!customerSelected) {
      setError("Please select a customer.");
      return;
    }

    if (
      lines.length === 0 ||
      lines.some(
        (line) =>
          line.IM_ID <= 0 ||
          !Number.isInteger(line.quantity) ||
          line.quantity <= 0 ||
          !Number.isFinite(line.discount) ||
          line.discount < 0 ||
          line.discount > 100
      )
    ) {
      setError(
        "Please select valid items, whole-number quantities, and discounts between 0 and 100%."
      );
      return;
    }

    const orderTaxRate = taxType === "VAT" ? 12 :
      taxType === "Custom" ? Number(customTaxRate) : 0;
    if (!Number.isFinite(orderTaxRate) || orderTaxRate < 0 || orderTaxRate > 100) {
      setError("Tax rate must be between 0% and 100%.");
      return;
    }

    const data: SalesOrderCreate = {
      customer_id: Number(customerId),
      tax_type: taxType,
      tax_rate: orderTaxRate,
      installment_months: installmentMonths,
      details: lines.map((line) => ({
        IM_ID: line.IM_ID,
        quantity: line.quantity,
        discount: line.discount,
      })),
    };

    setSaving(true);

    try {
      await salesOrderAPI.create(data);
      resetForm();
      setCurrentPage(1);
      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create sales order."
      );
    } finally {
      setSaving(false);
    }
  }

  const itemFieldsDisabled =
    !customerSelected || saving || loadingItems;

  return (
    <div className="min-h-full space-y-5 bg-gray text-slate-800">
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="font-semibold hover:text-red-900"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Orders" value={orders.length.toString()} />
        <SummaryCard title="Total Sales" value={money(totalSales)} />

        <SummaryCard
          title="Pending Requests"
          value={pendingOrders.toString()}
          valueColor="text-amber-600"
        />

        <SummaryCard
          title="Accepted Requests"
          value={acceptedOrders.toString()}
          valueColor="text-green-700"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-[#D1D5DB] p-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-800">
              Sales Order Requests
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Submit requested items to Inventory and track its decision.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search order, customer, or status..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-green-700 focus:ring-2 focus:ring-green-100 sm:w-72"
            />

            <button
              type="button"
              onClick={() => {
                setError("");
                setShowForm(true);
              }}
              className="whitespace-nowrap rounded-lg bg-[#3F7657] px-4 py-2 text-sm font-semibold text-white hover:bg-[#315F46]"
            >
              + Create Order Request
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="whitespace-nowrap px-5 py-3 text-center">
                  Order No.
                </th>
                <th className="whitespace-nowrap px-5 py-3">Customer</th>
                <th className="whitespace-nowrap px-5 py-3 text-center">
                  Order Date
                </th>
                <th className="whitespace-nowrap px-5 py-3 text-center">
                  Items
                </th>
                <th className="whitespace-nowrap px-5 py-3">Total Amount</th>
                <th className="whitespace-nowrap px-5 py-3 text-center">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#D1D5DB]">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-600"
                  >
                    Loading sales orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-600"
                  >
                    {search
                      ? "No sales orders match your search."
                      : "No sales orders found."}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  return (
                    <tr
                      key={order.order_id}
                      className="bg-[#E5E7EB] transition-colors hover:bg-[#DDE1E5]"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-center font-semibold text-slate-800">
                        SO-{String(order.order_id).padStart(4, "0")}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {customerMap.get(order.customer_id) ??
                          `Customer #${order.customer_id}`}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-center text-slate-600">
                        {formatDate(order.order_date)}
                      </td>

                      <td className="px-5 py-4 text-center text-slate-600">
                        {order.details?.length ?? 0}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                        {money(order.total_amount)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyles[order.status] ?? "border-slate-300 bg-slate-100 text-slate-600"}`}>
                          {order.status === "Pending" ? "Pending Inventory review" : order.status === "Approved" ? "Accepted" : order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div className="flex flex-col gap-3 border-t border-[#D1D5DB] bg-gray px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredOrders.length === 0 ? 0 : startIndex + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-700">
                {endRecord}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {filteredOrders.length}
              </span>{" "}
              orders
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(safePage - 1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="px-2 text-sm font-medium text-slate-600">
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Create Sales Order Request
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Select a customer and add the requested items. Inventory will review the request.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-600 hover:bg-[#D1D5DB] hover:text-slate-900 disabled:opacity-50"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="order-customer"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Customer
                </label>

                <select
                  id="order-customer"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setActiveItemLine(null);
                  }}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-green-700"
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

              <div className="rounded-lg border border-[#D1D5DB] bg-white p-4">
                <label htmlFor="order-tax-type" className="mb-2 block text-sm font-semibold text-slate-700">
                  Order Tax
                </label>
                <select
                  id="order-tax-type"
                  value={taxType}
                  onChange={(event) => setTaxType(event.target.value as typeof taxType)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800"
                >
                  <option value="VAT">VAT — 12%</option>
                  <option value="Non-VAT">Non-VAT — 0%</option>
                  <option value="Tax-Exempt">Tax-Exempt — 0%</option>
                  <option value="Custom">Custom rate</option>
                </select>
                {taxType === "Custom" && (
                  <div className="mt-3">
                    <label htmlFor="order-custom-tax" className="mb-1 block text-xs font-medium text-slate-600">Custom tax rate (%)</label>
                    <input
                      id="order-custom-tax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={customTaxRate}
                      onChange={(event) => setCustomTaxRate(event.target.value)}
                      disabled={saving}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-slate-600">Estimated tax ({selectedTaxRate || 0}%)</span>
                  <strong className="text-slate-800">{money(estimatedTax)}</strong>
                </div>
                <p className="mt-1 text-xs text-slate-500">Tax details are saved with the order and carried into its invoice.</p>
              </div>

              <div>
                <label htmlFor="order-installment" className="mb-2 block text-sm font-semibold text-slate-700">
                  Payment Installment
                </label>
                <select
                  id="order-installment"
                  value={installmentMonths}
                  onChange={(event) => setInstallmentMonths(Number(event.target.value) as 1 | 3 | 6 | 12)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800"
                >
                  <option value={1}>1 Month — 0% Interest</option>
                  <option value={3}>3 Months — 3% Interest</option>
                  <option value={6}>6 Months — 5% Interest</option>
                  <option value={12}>1 Year — 10% Interest</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">The invoice will use this installment term.</p>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Order Items
                  </label>

                  {!customerSelected && (
                    <span className="text-xs font-medium text-amber-700">
                      Select a customer first to enable order items.
                    </span>
                  )}
                </div>

                {loadingItems && (
                  <p className="mb-2 text-xs text-slate-600">
                    Loading items and stock...
                  </p>
                )}

                <div className="space-y-3">
                  {lines.map((line, index) => {
                    const selectedItem = itemCatalog[line.IM_ID];
                    const requested =
                      requestedByItem.get(line.IM_ID) ?? 0;
                    const available = Number(
                      selectedItem?.stock_available ?? 0
                    );
                    const isInsufficient =
                      Boolean(selectedItem) && requested > available;

                    const query = itemQueries[line.lineId] ?? "";
                    const term = query.trim().toLowerCase();

                    const matchingItems = selectItems.filter((item) => {
                      if (!term) return true;

                      const itemName = String(
                        item.Item_Name ?? ""
                      ).toLowerCase();

                      const sku = String(item.SKU ?? "").toLowerCase();

                      return (
                        itemName.includes(term) || sku.includes(term)
                      );
                    });

                    const showSuggestions =
                      activeItemLine === line.lineId && customerSelected;

                    const originalPrice = Number(
                      selectedItem?.Price ?? 0
                    );

                    const discountedPrice =
                      originalPrice * (1 - line.discount / 100);

                    return (
                      <div
                        key={line.lineId}
                        className={`rounded-lg border border-[#D1D5DB] bg-white p-3 ${
                          !customerSelected ? "opacity-60" : ""
                        }`}
                      >
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_110px_auto]">
                          <div className="relative min-w-0">
                            <label
                              htmlFor={`item-search-${line.lineId}`}
                              className="mb-1 block text-xs font-medium text-slate-600"
                            >
                              Search or Select Item
                            </label>

                            <input
                              id={`item-search-${line.lineId}`}
                              type="search"
                              value={
                                query ||
                                (selectedItem
                                  ? `${selectedItem.SKU} - ${selectedItem.Item_Name}`
                                  : "")
                              }
                              onChange={(e) =>
                                handleItemSearch(line, e.target.value)
                              }
                              onFocus={() => {
                                if (customerSelected) {
                                  setActiveItemLine(line.lineId);
                                }
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setActiveItemLine((current) =>
                                    current === line.lineId ? null : current
                                  );
                                }, 150);
                              }}
                              disabled={itemFieldsDisabled}
                              placeholder={
                                customerSelected
                                  ? "Type item name or SKU..."
                                  : "Select a customer first"
                              }
                              autoComplete="off"
                              aria-expanded={showSuggestions}
                              aria-controls={`item-suggestions-${line.lineId}`}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            />

                            {showSuggestions && (
                              <div
                                id={`item-suggestions-${line.lineId}`}
                                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                              >
                                {matchingItems.length > 0 ? (
                                  <>
                                    <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                      {term
                                        ? "Matching items"
                                        : "Available items"}
                                    </p>

                                    {matchingItems.map((item) => (
                                      <button
                                        key={item.IM_ID}
                                        type="button"
                                        onMouseDown={(e) =>
                                          e.preventDefault()
                                        }
                                        onClick={() =>
                                          chooseItem(line, item)
                                        }
                                        className="flex w-full flex-col gap-1 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-[#E8F0EA] focus:bg-[#E8F0EA] focus:outline-none"
                                      >
                                        <span className="text-sm font-semibold text-slate-800">
                                          {item.Item_Name}
                                        </span>

                                        <span className="text-xs text-slate-500">
                                          {item.SKU} ·{" "}
                                          {money(item.Price ?? 0)}
                                        </span>

                                        <span className="text-xs font-medium text-green-700">
                                          Stock available:{" "}
                                          {Number(
                                            item.stock_available ?? 0
                                          )}
                                          {item.unit_of_measure
                                            ? ` ${item.unit_of_measure}`
                                            : ""}
                                        </span>
                                      </button>
                                    ))}
                                  </>
                                ) : (
                                  <p className="px-3 py-3 text-sm text-slate-500">
                                    No matching items found.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Quantity
                            </label>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                line.quantity === 0 ? "" : line.quantity
                              }
                              onChange={(e) =>
                                updateLineById(line.lineId, {
                                  quantity:
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value),
                                })
                              }
                              disabled={!customerSelected || saving}
                              aria-label="Quantity"
                              placeholder="Qty"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Discount (%)
                            </label>

                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={
                                  line.discount === 0
                                    ? ""
                                    : line.discount
                                }
                                onChange={(e) =>
                                  updateLineById(line.lineId, {
                                    discount:
                                      e.target.value === ""
                                        ? 0
                                        : Number(e.target.value),
                                  })
                                }
                                disabled={!customerSelected || saving}
                                aria-label="Discount percentage"
                                placeholder="0"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-800 outline-none focus:border-green-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              />

                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                                %
                              </span>
                            </div>
                          </div>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              disabled={
                                !customerSelected ||
                                lines.length === 1 ||
                                saving
                              }
                              className="w-full rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {selectedItem && (
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-slate-600">
                                Selected:{" "}
                                <strong className="text-slate-800">
                                  {selectedItem.Item_Name}
                                </strong>
                              </span>

                              <span
                                className={
                                  isInsufficient
                                  ? "font-semibold text-amber-700"
                                    : "font-medium text-green-700"
                                }
                              >
                                {isInsufficient
                                  ? `Inventory review: ${requested} requested, ${available} available`
                                  : `Requested / currently available: ${requested} / ${available}`}
                              </span>
                            </div>

                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-slate-600">
                                Original unit price:{" "}
                                <strong className="text-slate-800">
                                  {money(originalPrice)}
                                </strong>
                              </span>

                              <span className="text-slate-600">
                                Discounted unit price:{" "}
                                <strong className="text-slate-800">
                                  {money(discountedPrice)}
                                </strong>
                              </span>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!loadingItems && items.length === 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    No items available.
                  </p>
                )}

                {hasStockIssues && (
                  <div
                    role="status"
                    className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    <p className="font-semibold">
                      Inventory review required.
                    </p>
                    <p className="mt-1">You can still submit this request. Inventory will review it before accepting.</p>

                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {stockIssues.map((issue) => (
                        <li key={issue.IM_ID}>
                          {issue.itemName}: {issue.requested} requested,
                          {" "}{issue.available} currently available.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addLine}
                  disabled={!customerSelected || saving}
                  className="mt-3 text-sm font-semibold text-[#3F7657] hover:text-[#315F46] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Add another item
                </button>
              </div>

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-[#D1D5DB] pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-[#DDE1E5] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void handleCreateOrder()}
                  disabled={
                    saving ||
                    !customerSelected ||
                    loadingItems
                  }
                  className="rounded-lg bg-[#3F7657] px-5 py-3 text-sm font-semibold text-white hover:bg-[#315F46] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Submitting..." : "Submit Order Request"}
                </button>
              </div>
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
  valueColor = "text-slate-900",
}: {
  title: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{title}</p>

      <p className={`mt-2 text-2xl font-bold ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}
