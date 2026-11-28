
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

interface SalesOrderDraft {
  customer_id: number;
  installment_months: 1 | 3 | 6 | 12;
  details: Array<{
    IM_ID: number;
    quantity: number;
    discount: number;
  }>;
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
  "Waiting for Stock": "border-orange-200 bg-orange-50 text-orange-700",
  Preparing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Released to Sales": "border-purple-200 bg-purple-50 text-purple-700",
  Cancelled: "border-red-200 bg-red-50 text-red-700",
  Processing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Completed: "border-green-200 bg-green-50 text-green-700",
};

const statusLabels: Partial<Record<SalesOrderStatus, string>> = {
  Pending: "Pending Inventory review",
  Accepted: "Accepted",
  Approved: "Accepted",
  "Waiting for Stock": "Waiting for Stock",
  Preparing: "Preparing",
  "Released to Sales": "Released to Sales",
  Processing: "Processing",
  Completed: "Completed",
  Cancelled: "Cancelled",
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

  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [taxType, setTaxType] = useState<
    "VAT" | "Non-VAT" | "Tax-Exempt" | "Custom"
  >("VAT");
  const [customTaxRate, setCustomTaxRate] = useState("0");
  const [installmentMonths, setInstallmentMonths] = useState<1 | 3 | 6 | 12>(1);

  const [nextLineId, setNextLineId] = useState(2);
  const [lines, setLines] = useState<OrderLine[]>([
    { lineId: 1, IM_ID: 0, quantity: 1, discount: 0 },
  ]);

  const [itemQueries, setItemQueries] = useState<Record<number, string>>({});
  const [activeItemLine, setActiveItemLine] = useState<number | null>(null);

  const customerSelected = customerId !== "";

  const selectedTaxRate =
    taxType === "VAT"
      ? 12
      : taxType === "Custom"
        ? Number(customTaxRate)
        : 0;

  const estimatedOrderSubtotal = lines.reduce((sum, line) => {
    const price = Number(itemCatalog[line.IM_ID]?.Price ?? 0);
    return sum + price * line.quantity * (1 - line.discount / 100);
  }, 0);

  const estimatedTax = Number(
    ((estimatedOrderSubtotal * selectedTaxRate) / 100).toFixed(2)
  );

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
    } finally {
      setCustomersLoaded(true);
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
      setItemsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadCustomers();
    void loadItems();
  }, [loadOrders, loadCustomers, loadItems]);

  // Automatically load the quotation draft and open the Sales Order form.
  useEffect(() => {
    if (!customersLoaded || !itemsLoaded) return;

    const savedDraft = sessionStorage.getItem("salesOrderDraft");

    if (!savedDraft) return;

    try {
      const draft = JSON.parse(savedDraft) as SalesOrderDraft;

      const validInstallments = [1, 3, 6, 12];

      const customerExists = customers.some(
        (customer) =>
          customer.customer_id === Number(draft.customer_id) &&
          Boolean(customer.status)
      );

      const validDetails =
        Array.isArray(draft.details) &&
        draft.details.length > 0 &&
        draft.details.every(
          (detail) =>
            Number.isInteger(detail.IM_ID) &&
            detail.IM_ID > 0 &&
            Number.isInteger(detail.quantity) &&
            detail.quantity > 0 &&
            Number.isFinite(detail.discount) &&
            detail.discount >= 0 &&
            detail.discount <= 100 &&
            items.some((item) => item.IM_ID === detail.IM_ID)
        );

      if (
        !customerExists ||
        !validDetails ||
        !validInstallments.includes(draft.installment_months)
      ) {
        setError(
          "Unable to load the quotation data. Please check the customer and selected items."
        );
        sessionStorage.removeItem("salesOrderDraft");
        return;
      }

      const preparedLines: OrderLine[] = draft.details.map(
        (detail, index) => ({
          lineId: index + 1,
          IM_ID: detail.IM_ID,
          quantity: detail.quantity,
          discount: detail.discount,
        })
      );

      const preparedQueries: Record<number, string> = {};

      preparedLines.forEach((line) => {
        const item = items.find(
          (candidate) => candidate.IM_ID === line.IM_ID
        );

        if (item) {
          preparedQueries[line.lineId] =
            `${item.SKU} - ${item.Item_Name}`;
        }
      });

      setError("");
      setCustomerId(String(draft.customer_id));
      setTaxType("VAT");
      setCustomTaxRate("0");
      setInstallmentMonths(draft.installment_months);
      setLines(preparedLines);
      setNextLineId(preparedLines.length + 1);
      setItemQueries(preparedQueries);
      setActiveItemLine(null);
      setShowForm(true);

      sessionStorage.removeItem("salesOrderDraft");
    } catch {
      setError("The saved quotation data could not be loaded.");
      sessionStorage.removeItem("salesOrderDraft");
    }
  }, [customersLoaded, itemsLoaded, customers, items]);

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

  const preparingOrders = orders.filter(
    (order) => order.status === "Preparing"
  ).length;

  const waitingForStockOrders = orders.filter(
    (order) => order.status === "Waiting for Stock"
  ).length;

  const releasedOrders = orders.filter(
    (order) => order.status === "Released to Sales"
  ).length;

  const completedOrders = orders.filter(
    (order) => order.status === "Completed"
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
    return items.filter((item) => {
      const status = String(item.status ?? "").trim().toLowerCase();

      return status === "active" || status === "true";
    });
  }, [items]);

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

    const orderTaxRate =
      taxType === "VAT"
        ? 12
        : taxType === "Custom"
          ? Number(customTaxRate)
          : 0;

    if (
      !Number.isFinite(orderTaxRate) ||
      orderTaxRate < 0 ||
      orderTaxRate > 100
    ) {
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
    <div className="min-w-0 space-y-4 bg-gray text-slate-800 sm:space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4"
        >
          <span className="min-w-0 break-words">{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 font-semibold hover:text-red-900"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Orders" value={orders.length.toString()} />
        <SummaryCard title="Total Sales" value={money(totalSales)} />

        <SummaryCard
          title="Pending Requests"
          value={pendingOrders.toString()}
          valueColor="text-amber-600"
        />

        <SummaryCard
          title="Waiting for Stock"
          value={waitingForStockOrders.toString()}
          valueColor="text-orange-700"
        />

        <SummaryCard
          title="Preparing Orders"
          value={preparingOrders.toString()}
          valueColor="text-indigo-700"
        />

        <SummaryCard
          title="Released to Sales"
          value={releasedOrders.toString()}
          valueColor="text-purple-700"
        />

        <SummaryCard
          title="Completed Orders"
          value={completedOrders.toString()}
          valueColor="text-green-700"
        />
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#D1D5DB] p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800">
              Sales Order Requests
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Submit requested items to Inventory and track each order through
              preparation, release, and completion.
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:w-auto">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search order, customer, or status..."
              className="min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-green-700 focus:ring-2 focus:ring-green-100 sm:py-2 sm:text-sm lg:w-72"
            />

            <button
              type="button"
              onClick={() => {
                setError("");
                setShowForm(true);
              }}
              className="w-full whitespace-nowrap rounded-lg bg-[#3F7657] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#315F46] sm:w-auto sm:py-2"
            >
              + Create Order Request
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">
            Loading sales orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">
            {search
              ? "No sales orders match your search."
              : "No sales orders found."}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {paginatedOrders.map((order) => (
                <div
                  key={order.order_id}
                  className="min-w-0 rounded-lg border border-[#D1D5DB] bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Order Number
                      </p>
                      <p className="mt-1 font-bold text-slate-900">
                        SO-{String(order.order_id).padStart(4, "0")}
                      </p>
                    </div>

                    <span
                      className={`max-w-[60%] rounded-full border px-2.5 py-1 text-center text-[11px] font-semibold leading-4 ${
                        statusStyles[order.status] ??
                        "border-slate-300 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xs text-slate-500">Customer</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">
                        {customerMap.get(order.customer_id) ??
                          `Customer #${order.customer_id}`}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Order Date</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatDate(order.order_date)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Items</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {order.details?.length ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500">Total Amount</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {money(order.total_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 text-center">
                      Order No.
                    </th>
                    <th className="whitespace-nowrap px-5 py-3">
                      Customer
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 text-center">
                      Order Date
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 text-center">
                      Items
                    </th>
                    <th className="whitespace-nowrap px-5 py-3">
                      Total Amount
                    </th>
                    <th className="whitespace-nowrap px-5 py-3 text-center">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#D1D5DB]">
                  {paginatedOrders.map((order) => (
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

                      <td className="whitespace-nowrap px-5 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            statusStyles[order.status] ??
                            "border-slate-300 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {statusLabels[order.status] ?? order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && (
          <div className="flex flex-col gap-3 border-t border-[#D1D5DB] bg-gray-100 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-center text-xs text-slate-500 sm:text-left sm:text-sm">
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

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(safePage - 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="whitespace-nowrap px-1 text-xs font-medium text-slate-600 sm:px-2 sm:text-sm">
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:items-center sm:p-4">
          <div className="my-2 max-h-[calc(100dvh-16px)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-xl sm:my-4 sm:max-h-[90dvh] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Create Sales Order Request
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                  Select a customer and add the requested items. Inventory
                  will review the request and check Finished Goods stock.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-[#D1D5DB] hover:text-slate-900 disabled:opacity-50"
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:border-green-700 disabled:opacity-60 sm:text-sm"
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

              <div className="rounded-lg border border-[#D1D5DB] bg-white p-3 sm:p-4">
                <label
                  htmlFor="order-tax-type"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Order Tax
                </label>

                <select
                  id="order-tax-type"
                  value={taxType}
                  onChange={(event) =>
                    setTaxType(event.target.value as typeof taxType)
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 sm:text-sm"
                >
                  <option value="VAT">VAT — 12%</option>
                  <option value="Non-VAT">Non-VAT — 0%</option>
                  <option value="Tax-Exempt">Tax-Exempt — 0%</option>
                  <option value="Custom">Custom rate</option>
                </select>

                {taxType === "Custom" && (
                  <div className="mt-3">
                    <label
                      htmlFor="order-custom-tax"
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Custom tax rate (%)
                    </label>

                    <input
                      id="order-custom-tax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={customTaxRate}
                      onChange={(event) =>
                        setCustomTaxRate(event.target.value)
                      }
                      disabled={saving}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base sm:py-2 sm:text-sm"
                    />
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600">
                    Estimated tax ({selectedTaxRate || 0}%)
                  </span>
                  <strong className="text-right text-slate-800">
                    {money(estimatedTax)}
                  </strong>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Tax details are saved with the order and carried into its
                  invoice.
                </p>
              </div>

              <div>
                <label
                  htmlFor="order-installment"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Payment Installment
                </label>

                <select
                  id="order-installment"
                  value={installmentMonths}
                  onChange={(event) =>
                    setInstallmentMonths(
                      Number(event.target.value) as 1 | 3 | 6 | 12
                    )
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 sm:text-sm"
                >
                  <option value={1}>1 Month — 0% Interest</option>
                  <option value={3}>3 Months — 3% Interest</option>
                  <option value={6}>6 Months — 5% Interest</option>
                  <option value={12}>1 Year — 10% Interest</option>
                </select>

                <p className="mt-1 text-xs text-slate-500">
                  The invoice will use this installment term.
                </p>
              </div>

              <div>
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
                        className={`min-w-0 rounded-lg border border-[#D1D5DB] bg-white p-3 sm:p-4 ${
                          !customerSelected ? "opacity-60" : ""
                        }`}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_90px_110px_auto]">
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
                                setActiveItemLine((current) =>
                                  current === line.lineId ? null : current
                                );
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
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:py-2 sm:text-sm"
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
                                          {item.SKU} · {money(item.Price ?? 0)}
                                        </span>

                                        <span className="text-xs font-medium text-green-700">
                                          Stock available:{" "}
                                          {Number(item.stock_available ?? 0)}
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
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:py-2 sm:text-sm"
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
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 pr-8 text-base text-slate-800 outline-none focus:border-green-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:py-2 sm:text-sm"
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
                              className="w-full rounded-lg border border-red-100 px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto sm:border-transparent sm:py-2"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {selectedItem && (
                          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs">
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

                    <p className="mt-1">
                      You can still submit this request. Inventory will check
                      stock and move the order to Waiting for Stock if the
                      requested quantity is unavailable.
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {stockIssues.map((issue) => (
                        <li key={issue.IM_ID}>
                          {issue.itemName}: {issue.requested} requested,{" "}
                          {issue.available} currently available.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={addLine}
                  disabled={!customerSelected || saving}
                  className="mt-3 rounded-lg py-2 text-sm font-semibold text-[#3F7657] hover:text-[#315F46] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Add another item
                </button>
              </div>

              <div className="flex flex-col-reverse justify-end gap-2 border-t border-[#D1D5DB] pt-4 sm:flex-row sm:gap-3 sm:pt-5">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-[#DDE1E5] disabled:opacity-50 sm:w-auto"
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
                  className="w-full rounded-lg bg-[#3F7657] px-5 py-3 text-sm font-semibold text-white hover:bg-[#315F46] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
    <div className="min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-600">{title}</p>

      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${valueColor}`}>
        {value}
      </p>
    </div>
  );
}
