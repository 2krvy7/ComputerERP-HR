
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  customerAPI,
  deliveryAPI,
  invoiceAPI,
  salesOrderAPI,
  salesReturnAPI,
} from "../../lib/api";

import type { Customer } from "../../types/customer";
import type { Delivery } from "../../types/delivery";
import type { SalesInvoice } from "../../types/invoice";
import type {
  SalesOrder,
  SalesOrderDetail,
  SalesOrderItem,
  FinishedGoodItem,
} from "../../types/order";
import type { SalesReturn, SalesReturnCreate } from "../../types/return";

const PAGE_SIZE = 10;

const money = (amount: string | number) =>
  `₱${Number(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function isCustomerReceived(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "received-customer" ||
    normalized === "received-by-customer" ||
    normalized === "received-by-the-customer" ||
    normalized === "delivered" ||
    normalized === "delivered-sales"
  );
}

function isFinishedGood(itemType: string | null | undefined) {
  return normalizeStatus(itemType) === "finished-goods";
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium text-slate-600 sm:text-sm">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function ReturnsPanel() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGoodItem[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [orderDetailId, setOrderDetailId] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [returnAmount, setReturnAmount] = useState("");

  useEffect(() => {
    setReturnDate(getLocalDate());
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        returnData,
        orderData,
        invoiceData,
        customerData,
        itemData,
        finishedGoodData,
        deliveryData,
      ] = await Promise.all([
        salesReturnAPI.getAll(),
        salesOrderAPI.getAll(),
        invoiceAPI.getAll(),
        customerAPI.getAll(),
        salesOrderAPI.getItems(),
        salesOrderAPI.getFinishedGoods(),
        deliveryAPI.getAll(),
      ]);

      setReturns(returnData);
      setOrders(orderData);
      setInvoices(invoiceData);
      setCustomers(customerData);
      setItems(itemData);
      setFinishedGoods(finishedGoodData);
      setDeliveries(deliveryData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load sales returns."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const orderMap = useMemo(
    () => new Map(orders.map((order) => [order.order_id, order])),
    [orders]
  );

  const customerMap = useMemo(
    () =>
      new Map(
        customers.map((customer) => [customer.customer_id, customer])
      ),
    [customers]
  );

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.IM_ID, item])),
    [items]
  );

  const finishedGoodMap = useMemo(
    () =>
      new Map(
        finishedGoods
          .filter((item) => isFinishedGood(item.ItemType))
          .map((item) => [item.IM_ID, item])
      ),
    [finishedGoods]
  );

  const invoiceMap = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.order_id, invoice])),
    [invoices]
  );

  const customerReceivedOrderIds = useMemo(
    () =>
      new Set(
        deliveries
          .filter((delivery) => isCustomerReceived(delivery.status))
          .map((delivery) => delivery.order_id)
      ),
    [deliveries]
  );

  const detailMap = useMemo(() => {
    const map = new Map<
      number,
      {
        order: SalesOrder;
        detail: SalesOrderDetail;
      }
    >();

    orders.forEach((order) => {
      order.details.forEach((detail) => {
        map.set(detail.order_detail_id, {
          order,
          detail,
        });
      });
    });

    return map;
  }, [orders]);

  const returnedQuantities = useMemo(() => {
    const totals = new Map<number, number>();

    returns.forEach((record) => {
      const current = totals.get(record.Order_Detail_ID) ?? 0;

      totals.set(
        record.Order_Detail_ID,
        current + Number(record.quantity)
      );
    });

    return totals;
  }, [returns]);

  const availableDetails = useMemo(
    () =>
      orders
        .filter((order) => invoiceMap.has(order.order_id))
        .filter((order) => order.status !== "Cancelled")
        .filter((order) =>
          customerReceivedOrderIds.has(order.order_id)
        )
        .flatMap((order) =>
          order.details
            .filter((detail) => finishedGoodMap.has(detail.IM_ID))
            .map((detail) => {
              const returned =
                returnedQuantities.get(detail.order_detail_id) ?? 0;

              return {
                ...detail,
                order,
                remaining: detail.quantity - returned,
              };
            })
            .filter((detail) => detail.remaining > 0)
        ),
    [
      orders,
      invoiceMap,
      customerReceivedOrderIds,
      finishedGoodMap,
      returnedQuantities,
    ]
  );

  const selectedDetail = availableDetails.find(
    (detail) => detail.order_detail_id === Number(orderDetailId)
  );

  const selectedInvoice = selectedDetail
    ? invoiceMap.get(selectedDetail.order_id)
    : undefined;

  const selectedItem = selectedDetail
    ? finishedGoodMap.get(selectedDetail.IM_ID)
    : undefined;

  const returnQuantity = Number(quantity);

  const calculatedAmount =
    selectedDetail &&
    Number.isInteger(returnQuantity) &&
    returnQuantity > 0
      ? (Number(selectedDetail.line_total) /
          selectedDetail.quantity) *
        returnQuantity
      : 0;

  const totalReturnedAmount = returns.reduce(
    (sum, record) => sum + Number(record.return_amount ?? 0),
    0
  );

  const totalReturnedItems = returns.reduce(
    (sum, record) => sum + Number(record.quantity),
    0
  );

  const filteredReturns = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return returns;

    return returns.filter((record) => {
      const related = detailMap.get(record.Order_Detail_ID);
      const relatedOrder = related?.order;
      const relatedDetail = related?.detail;

      const customerName = relatedOrder
        ? customerMap.get(relatedOrder.customer_id)?.name ?? ""
        : "";

      const itemName = relatedDetail
        ? itemMap.get(relatedDetail.IM_ID)?.Item_Name ??
          finishedGoodMap.get(relatedDetail.IM_ID)?.Item_Name ??
          ""
        : "";

      return (
        String(record.return_id).includes(term) ||
        String(record.invoice_id).includes(term) ||
        String(relatedOrder?.order_id ?? "").includes(term) ||
        customerName.toLowerCase().includes(term) ||
        itemName.toLowerCase().includes(term)
      );
    });
  }, [
    returns,
    detailMap,
    customerMap,
    itemMap,
    finishedGoodMap,
    search,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReturns.length / PAGE_SIZE)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;

  const paginatedReturns = useMemo(
    () =>
      filteredReturns.slice(
        startIndex,
        startIndex + PAGE_SIZE
      ),
    [filteredReturns, startIndex]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function resetForm() {
    setOrderDetailId("");
    setReturnDate(getLocalDate());
    setQuantity("1");
    setReason("");
    setReturnAmount("");
    setShowForm(false);
  }

  async function handleCreateReturn() {
    setError("");

    if (!selectedDetail || !selectedInvoice) {
      setError("Please select an available finished good from a customer-received delivery.");
      return;
    }

    if (!customerReceivedOrderIds.has(selectedDetail.order_id)) {
      setError(
        "This order is not eligible for return because the customer has not received the delivery."
      );
      return;
    }

    if (!finishedGoodMap.has(selectedDetail.IM_ID)) {
      setError("Only finished goods can be returned.");
      return;
    }

    if (!Number.isInteger(returnQuantity) || returnQuantity <= 0) {
      setError("Return quantity must be a positive whole number.");
      return;
    }

    if (returnQuantity > selectedDetail.remaining) {
      setError(
        `Only ${selectedDetail.remaining} item(s) remain eligible for return.`
      );
      return;
    }

    if (!returnDate) {
      setError("Please select a return date.");
      return;
    }

    if (returnAmount.trim()) {
      const amount = Number(returnAmount);

      if (!Number.isFinite(amount) || amount < 0) {
        setError("Please enter a valid, non-negative return amount.");
        return;
      }
    }

    const data: SalesReturnCreate = {
      Order_Detail_ID: selectedDetail.order_detail_id,
      invoice_id: selectedInvoice.invoice_id,
      return_date: returnDate,
      quantity: returnQuantity,
      reason: reason.trim() || null,
      return_amount: returnAmount.trim()
        ? Number(returnAmount)
        : null,
    };

    setSaving(true);

    try {
      await salesReturnAPI.create(data);
      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create sales return."
      );
    } finally {
      setSaving(false);
    }
  }

  function getReturnRowDetails(record: SalesReturn) {
    const related = detailMap.get(record.Order_Detail_ID);
    const relatedOrder = related?.order;
    const relatedDetail = related?.detail;

    const customer = relatedOrder
      ? customerMap.get(relatedOrder.customer_id)
      : undefined;

    const item = relatedDetail
      ? itemMap.get(relatedDetail.IM_ID) ??
        finishedGoodMap.get(relatedDetail.IM_ID)
      : undefined;

    return {
      relatedOrder,
      relatedDetail,
      customer,
      item,
    };
  }

  return (
    <div className="min-w-0 w-full space-y-5 bg-gray text-slate-800">
      {error && (
        <div
          role="alert"
          className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4"
        >
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <SummaryCard
          label="Total Returns"
          value={returns.length}
          description="Recorded return transactions"
        />

        <SummaryCard
          label="Total Returned Amount"
          value={money(totalReturnedAmount)}
          description="Combined recorded return value"
        />

        <SummaryCard
          label="Total Returned Items"
          value={totalReturnedItems}
          description="Total quantity of returned items"
        />
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        <div className="flex min-w-0 flex-col justify-between gap-4 border-b border-[#D1D5DB] p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">
              Sales Return History
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              View all returned items and their details.
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row lg:w-auto">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search return, order, item, or customer..."
              className="min-h-11 w-full min-w-0 rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-80"
            />

            <button
              type="button"
              onClick={() => {
                setError("");
                setShowForm(true);
              }}
              disabled={availableDetails.length === 0 || loading}
              className="min-h-11 w-full shrink-0 whitespace-nowrap rounded-lg bg-green-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              + Create Sales Return
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-600">
            Loading sales returns...
          </div>
        ) : paginatedReturns.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-600">
            No sales returns found.
          </div>
        ) : (
          <>
            {/* Mobile return cards */}
            <div className="space-y-3 p-3 md:hidden">
              {paginatedReturns.map((record) => {
                const {
                  relatedOrder,
                  customer,
                  item,
                } = getReturnRowDetails(record);

                return (
                  <article
                    key={record.return_id}
                    className="min-w-0 rounded-lg border border-[#D1D5DB] bg-white p-4 shadow-sm"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Return No.
                        </p>
                        <p className="mt-1 break-words font-bold text-slate-900">
                          RET-{String(record.return_id).padStart(4, "0")}
                        </p>
                      </div>

                      <div className="min-w-0 text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Order No.
                        </p>
                        <p className="mt-1 break-words font-semibold text-slate-800">
                          {relatedOrder
                            ? `SO-${String(relatedOrder.order_id).padStart(4, "0")}`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="my-3 border-t border-slate-200" />

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Customer
                        </p>
                        <p className="mt-1 break-words text-sm font-medium text-slate-800">
                          {customer?.name ?? "Unknown customer"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-500">
                          Returned Item
                        </p>
                        <p className="mt-1 break-words text-sm font-medium text-slate-900">
                          {item?.Item_Name ?? "Item name unavailable"}
                        </p>
                        {item?.SKU && (
                          <p className="mt-1 text-xs text-slate-500">
                            SKU: {item.SKU}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Return Date
                          </p>
                          <p className="mt-1 text-sm text-slate-800">
                            {formatDate(record.return_date)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Quantity
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {record.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3">
                        <p className="text-xs font-medium text-slate-500">
                          Return Amount
                        </p>
                        <p className="mt-1 text-base font-bold text-slate-900">
                          {money(record.return_amount ?? 0)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop return table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#D1D5DB] text-slate-700">
                  <tr>
                    <th className="px-5 py-4 text-center font-semibold">
                      Return No.
                    </th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Order No.
                    </th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Customer
                    </th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Returned Item
                    </th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Return Date
                    </th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Quantity
                    </th>
                    <th className="px-5 py-4 text-center font-semibold">
                      Return Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#D1D5DB]">
                  {paginatedReturns.map((record) => {
                    const {
                      relatedOrder,
                      customer,
                      item,
                    } = getReturnRowDetails(record);

                    return (
                      <tr
                        key={record.return_id}
                        className="text-center transition hover:bg-[#DDE1E5]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                          RET-{String(record.return_id).padStart(4, "0")}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {relatedOrder
                            ? `SO-${String(relatedOrder.order_id).padStart(4, "0")}`
                            : "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {customer?.name ?? "Unknown customer"}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          <p className="font-medium text-slate-900">
                            {item?.Item_Name ?? "Item name unavailable"}
                          </p>
                          {item?.SKU && (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.SKU}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDate(record.return_date)}
                        </td>

                        <td className="px-5 py-4 text-center font-medium text-slate-700">
                          {record.quantity}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                          {money(record.return_amount ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        <div className="flex min-w-0 flex-col justify-between gap-3 border-t border-[#D1D5DB] bg-[#E5E7EB] px-4 py-4 sm:px-5 md:flex-row md:items-center">
          <p className="text-center text-sm text-slate-600 md:text-left">
            Showing{" "}
            {filteredReturns.length === 0 ? 0 : startIndex + 1}
            {" "}to{" "}
            {Math.min(startIndex + PAGE_SIZE, filteredReturns.length)}
            {" "}of {filteredReturns.length} returns
          </p>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              disabled={safeCurrentPage === 1}
              className="min-h-10 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#DDE1E5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="whitespace-nowrap px-2 text-sm font-medium text-slate-700">
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              disabled={safeCurrentPage >= totalPages}
              className="min-h-10 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-[#DDE1E5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Create Sales Return Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="my-auto max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-2xl sm:max-h-[90dvh] sm:max-w-lg sm:rounded-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Create Sales Return
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Record an item returned by a customer.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-[#D1D5DB] hover:text-slate-900 disabled:opacity-40"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Sales Order Item
                </label>

                <select
                  value={orderDetailId}
                  onChange={(event) => {
                    setOrderDetailId(event.target.value);
                    setQuantity("1");
                    setReturnAmount("");
                  }}
                  className="min-h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select order item</option>

                  {availableDetails.map((detail) => {
                    const item = finishedGoodMap.get(detail.IM_ID);

                    return (
                      <option
                        key={detail.order_detail_id}
                        value={detail.order_detail_id}
                      >
                        SO-{String(detail.order.order_id).padStart(4, "0")}
                        {" — "}
                        {item?.Item_Name ?? "Item name unavailable"}
                        {" — "}
                        {detail.remaining} remaining
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedDetail && (
                <div className="rounded-lg border border-[#D1D5DB] bg-[#F3F4F6] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selected Finished Good
                  </p>

                  <p className="mt-1 break-words font-semibold text-slate-900">
                    {selectedItem?.Item_Name ?? "Item name unavailable"}
                  </p>

                  {selectedItem?.SKU && (
                    <p className="mt-1 text-xs text-slate-500">
                      SKU: {selectedItem.SKU}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Ordered Quantity</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedDetail.quantity}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Remaining Quantity</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedDetail.remaining}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 break-words text-sm text-slate-600">
                    Invoice: SI-
                    {String(selectedInvoice?.invoice_id ?? "").padStart(4, "0")}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Return Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  max={selectedDetail?.remaining ?? 1}
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-[#D1D5D1] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Return Date
                </label>

                <input
                  type="date"
                  value={returnDate}
                  onChange={(event) => setReturnDate(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-[#D1D5D1] bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Reason for Return
                </label>

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="Enter the reason for returning the item..."
                  className="w-full resize-y rounded-lg border border-[#D1D5D1] bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Return Amount (Optional)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={returnAmount}
                  onChange={(event) => setReturnAmount(event.target.value)}
                  placeholder="Leave blank for automatic calculation"
                  className="min-h-11 w-full rounded-lg border border-[#D1D5D1] bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-2 text-xs text-slate-600">
                  Estimated amount: {money(calculatedAmount)}. Leave blank to
                  let the backend calculate it.
                </p>
              </div>

              <div className="flex flex-col-reverse justify-end gap-3 border-t border-[#D1D5DB] pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="min-h-11 rounded-lg border border-[#D1D5DB] bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#DDE1E5] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void handleCreateReturn()}
                  disabled={saving || availableDetails.length === 0}
                  className="min-h-11 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create Return"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
