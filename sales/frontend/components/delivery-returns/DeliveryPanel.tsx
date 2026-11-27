
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  authAPI,
  customerAPI,
  deliveryAPI,
  salesOrderAPI,
} from "../../lib/api";

import type { AuthUser } from "../../lib/api";
import type { Customer } from "../../types/customer";
import type { Delivery, DeliveryStatus, Warehouse } from "../../types/delivery";
import type { SalesOrder } from "../../types/order";

const PENDING_SALES: DeliveryStatus = "pending-sales";
const RELEASED_INVENTORY: DeliveryStatus = "released-inventory";
const RECEIVED_SALES: DeliveryStatus = "received-sales";
const RECEIVED_CUSTOMER: DeliveryStatus = "received-customer";

const statusStyles: Record<DeliveryStatus, string> = {
  "pending-sales": "border-amber-200 bg-amber-50 text-amber-800",
  "released-inventory": "border-teal-200 bg-teal-50 text-teal-800",
  "received-sales": "border-blue-200 bg-blue-50 text-blue-800",
  "received-customer": "border-green-200 bg-green-50 text-green-800",
};

const statusLabels: Record<DeliveryStatus, string> = {
  "pending-sales": "Pending Sales",
  "released-inventory": "Released to Sales",
  "received-sales": "Received by Sales",
  "received-customer": "Received by Customer",
};

const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  "pending-sales": [RELEASED_INVENTORY],
  "released-inventory": [RECEIVED_SALES],
  "received-sales": [RECEIVED_CUSTOMER],
  "received-customer": [],
};

function normalizeDeliveryStatus(
  status: DeliveryStatus | string
): DeliveryStatus {
  const normalized = String(status).trim().toLowerCase();

  if (
    normalized === "released" ||
    normalized === "shipped" ||
    normalized === "released by inventory" ||
    normalized === "released to sales" ||
    normalized === "released-inventory"
  ) {
    return RELEASED_INVENTORY;
  }

  if (
    normalized === "received-sales" ||
    normalized === "received by sales"
  ) {
    return RECEIVED_SALES;
  }

  if (
    normalized === "delivered" ||
    normalized === "delivered-sales" ||
    normalized === "received-customer" ||
    normalized === "received by customer"
  ) {
    return RECEIVED_CUSTOMER;
  }

  return PENDING_SALES;
}

function displayStatus(status: DeliveryStatus | string): string {
  return statusLabels[normalizeDeliveryStatus(status)];
}

const formatDate = (date: string | null) => {
  if (!date) return "—";

  const parsedDate = new Date(`${date.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (date: string | null) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

function getAvailableTransitions(
  status: DeliveryStatus,
  user: AuthUser | null
): DeliveryStatus[] {
  const transitions = allowedTransitions[normalizeDeliveryStatus(status)] ?? [];

  if (!user) return [];

  if (user.role_id === 1) {
    return transitions;
  }

  const isDepartmentAdmin = user.role_id === 3;
  const isStaffOrDepartmentAdmin =
    user.role_id === 2 || isDepartmentAdmin;

  if (!isStaffOrDepartmentAdmin) return [];

  if (user.dept_id === "IN") {
    return transitions.filter(
      (nextStatus) => nextStatus === RELEASED_INVENTORY
    );
  }

  if (user.dept_id === "SL") {
    return transitions.filter(
      (nextStatus) =>
        nextStatus === RECEIVED_SALES ||
        nextStatus === RECEIVED_CUSTOMER
    );
  }

  return [];
}

export default function DeliveryPanel() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [deliveryToConfirm, setDeliveryToConfirm] =
    useState<Delivery | null>(null);

  const [receivedBy, setReceivedBy] = useState("");
  const [receivedByError, setReceivedByError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        userData,
        deliveryData,
        orderData,
        customerData,
        warehouseData,
      ] = await Promise.all([
        authAPI.getMe(),
        deliveryAPI.getAll(),
        salesOrderAPI.getAll(),
        customerAPI.getAll(),
        deliveryAPI.getWarehouses(),
      ]);

      setCurrentUser(userData);
      setDeliveries(deliveryData);
      setOrders(orderData);
      setCustomers(customerData);
      setWarehouses(warehouseData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load delivery information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

  const warehouseMap = useMemo(
    () =>
      new Map(
        warehouses.map((warehouse) => [
          warehouse.WH_ID,
          warehouse.Warehouse_Name,
        ])
      ),
    [warehouses]
  );

  const orderMap = useMemo(
    () =>
      new Map(
        orders.map((order) => [order.order_id, order])
      ),
    [orders]
  );

  const filteredDeliveries = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return deliveries;

    return deliveries.filter((delivery) => {
      const order = orderMap.get(delivery.order_id);

      const customerName = order
        ? customerMap.get(order.customer_id) ?? ""
        : "";

      const allocationNames = (delivery.warehouse_allocations ?? [])
        .map((allocation) => {
          return warehouseMap.get(allocation.WH_ID) ?? "";
        })
        .join(" ");

      const fallbackWarehouse =
        warehouseMap.get(delivery.WH_ID) ?? "";

      return (
        String(delivery.delivery_id).includes(term) ||
        String(delivery.order_id).includes(term) ||
        customerName.toLowerCase().includes(term) ||
        allocationNames.toLowerCase().includes(term) ||
        fallbackWarehouse.toLowerCase().includes(term) ||
        displayStatus(delivery.status).toLowerCase().includes(term) ||
        (delivery.received_by ?? "").toLowerCase().includes(term)
      );
    });
  }, [
    deliveries,
    search,
    orderMap,
    customerMap,
    warehouseMap,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDeliveries.length / pageSize)
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex =
    filteredDeliveries.length === 0
      ? 0
      : (safeCurrentPage - 1) * pageSize;

  const endIndex = Math.min(
    startIndex + pageSize,
    filteredDeliveries.length
  );

  const paginatedDeliveries = useMemo(
    () =>
      filteredDeliveries.slice(
        startIndex,
        startIndex + pageSize
      ),
    [filteredDeliveries, startIndex]
  );

  const pendingCount = deliveries.filter(
    (delivery) =>
      normalizeDeliveryStatus(delivery.status) === PENDING_SALES
  ).length;

  const releasedCount = deliveries.filter(
    (delivery) =>
      normalizeDeliveryStatus(delivery.status) === RELEASED_INVENTORY
  ).length;

  const receivedSalesCount = deliveries.filter(
    (delivery) =>
      normalizeDeliveryStatus(delivery.status) === RECEIVED_SALES
  ).length;

  const receivedCustomerCount = deliveries.filter(
    (delivery) =>
      normalizeDeliveryStatus(delivery.status) === RECEIVED_CUSTOMER
  ).length;

  function closeReceivedByModal() {
    if (updatingId !== null) return;

    setDeliveryToConfirm(null);
    setReceivedBy("");
    setReceivedByError("");
  }

  async function saveDeliveryStatus(
    delivery: Delivery,
    newStatus: DeliveryStatus,
    customerName?: string
  ) {
    if (updatingId !== null) return;

    setError("");
    setUpdatingId(delivery.delivery_id);

    try {
      await deliveryAPI.updateStatus(
        delivery.delivery_id,
        newStatus,
        customerName
      );

      if (newStatus === RECEIVED_CUSTOMER) {
        setDeliveryToConfirm(null);
        setReceivedBy("");
        setReceivedByError("");
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update delivery status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleConfirmReceipt() {
    if (!deliveryToConfirm || updatingId !== null) return;

    const customerName = receivedBy.trim();

    if (!customerName) {
      setReceivedByError("Please enter the recipient's name.");
      return;
    }

    setReceivedByError("");

    await saveDeliveryStatus(
      deliveryToConfirm,
      RECEIVED_CUSTOMER,
      customerName
    );
  }

  async function handleStatusChange(
    delivery: Delivery,
    newStatus: DeliveryStatus
  ) {
    if (updatingId !== null) return;

    const permittedStatuses = getAvailableTransitions(
      delivery.status,
      currentUser
    );

    if (!permittedStatuses.includes(newStatus)) {
      setError(
        `You are not authorized to change this delivery to ${displayStatus(newStatus)}.`
      );
      return;
    }

    if (newStatus === RECEIVED_CUSTOMER) {
      setError("");
      setReceivedBy("");
      setReceivedByError("");
      setDeliveryToConfirm(delivery);
      return;
    }

    await saveDeliveryStatus(delivery, newStatus);
  }

  function goToPage(page: number) {
    setCurrentPage(
      Math.max(1, Math.min(page, totalPages))
    );
  }

  function getWarehouseDisplay(delivery: Delivery) {
    const allocations = delivery.warehouse_allocations ?? [];

    if (allocations.length === 0) {
      return (
        warehouseMap.get(delivery.WH_ID) ??
        `Warehouse #${delivery.WH_ID}`
      );
    }

    return allocations
      .map((allocation) => {
        const name =
          warehouseMap.get(allocation.WH_ID) ??
          `Warehouse #${allocation.WH_ID}`;

        return `${name} (${allocation.quantity})`;
      })
      .join(", ");
  }

  function renderStatusControls(delivery: Delivery) {
    const normalizedStatus = normalizeDeliveryStatus(delivery.status);

    const availableStatuses = getAvailableTransitions(
      normalizedStatus,
      currentUser
    );

    return (
      <div className="flex min-w-0 flex-col gap-2">
        <span
          className={`inline-flex w-fit max-w-full items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
            statusStyles[normalizedStatus]
          }`}
        >
          {displayStatus(normalizedStatus)}
        </span>

        {availableStatuses.length > 0 && (
          <select
            value=""
            disabled={updatingId !== null}
            onChange={(e) => {
              if (e.target.value) {
                void handleStatusChange(
                  delivery,
                  e.target.value as DeliveryStatus
                );
              }
            }}
            className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[#4F8585] focus:ring-2 focus:ring-[#4F8585]/20 disabled:cursor-wait disabled:opacity-60 sm:w-[190px]"
            aria-label={`Update delivery status for record ${delivery.delivery_id}`}
          >
            <option value="">Update status</option>

            {availableStatuses.map((nextStatus) => (
              <option key={nextStatus} value={nextStatus}>
                {displayStatus(nextStatus)}
              </option>
            ))}
          </select>
        )}

        {updatingId === delivery.delivery_id && (
          <p className="text-xs font-medium text-[#4F8585]">
            Saving...
          </p>
        )}
      </div>
    );
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

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Deliveries"
          value={deliveries.length.toString()}
        />

        <SummaryCard
          title="Pending Sales"
          value={pendingCount.toString()}
          valueStyle="text-amber-700"
        />

        <SummaryCard
          title="Released to Sales"
          value={releasedCount.toString()}
          valueStyle="text-teal-700"
        />

        <SummaryCard
          title="Received by Sales"
          value={receivedSalesCount.toString()}
          valueStyle="text-blue-700"
        />

        <SummaryCard
          title="Received by Customer"
          value={receivedCustomerCount.toString()}
          valueStyle="text-green-700"
        />
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-b border-[#D1D5DB] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">
              Delivery Records
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Deliveries are created automatically when Inventory prepares a Sales Order.
            </p>
          </div>

          <div className="w-full min-w-0 lg:max-w-md">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search delivery, order, customer, warehouse, or status..."
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4F8585] focus:ring-2 focus:ring-[#4F8585]/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-600">
            Loading delivery records...
          </div>
        ) : paginatedDeliveries.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-600">
            No delivery records found.
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 md:hidden">
              {paginatedDeliveries.map((delivery) => {
                const order = orderMap.get(delivery.order_id);

                const customerName = order
                  ? customerMap.get(order.customer_id) ??
                    `Customer #${order.customer_id}`
                  : "—";

                return (
                  <article
                    key={delivery.delivery_id}
                    className="min-w-0 rounded-lg border border-[#D1D5DB] bg-white p-4 shadow-sm"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Delivery No.
                        </p>

                        <p className="mt-1 break-words font-bold text-slate-900">
                          DEL-{String(delivery.delivery_id).padStart(4, "0")}
                        </p>
                      </div>

                      <div className="min-w-0 text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Order No.
                        </p>

                        <p className="mt-1 break-words font-semibold text-slate-800">
                          SO-{String(delivery.order_id).padStart(4, "0")}
                        </p>
                      </div>
                    </div>

                    <div className="my-3 border-t border-slate-200" />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500">
                          Customer
                        </p>

                        <p className="mt-1 break-words text-sm font-medium text-slate-800">
                          {customerName}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500">
                          Expected Date
                        </p>

                        <p className="mt-1 break-words text-sm text-slate-800">
                          {formatDate(delivery.delivery_date)}
                        </p>
                      </div>

                      <div className="min-w-0 sm:col-span-2">
                        <p className="text-xs font-medium text-slate-500">
                          Source Warehouses and Allocated Quantities
                        </p>

                        <p className="mt-1 break-words text-sm text-slate-800">
                          {getWarehouseDisplay(delivery)}
                        </p>
                      </div>

                      {delivery.received_by && (
                        <div className="min-w-0 sm:col-span-2">
                          <p className="text-xs font-medium text-slate-500">
                            Received By
                          </p>

                          <p className="mt-1 break-words text-sm text-slate-800">
                            {delivery.received_by}
                          </p>

                          {delivery.received_at && (
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDateTime(delivery.received_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        Delivery Status
                      </p>

                      {renderStatusControls(delivery)}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Delivery No.
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Order No.
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Customer
                    </th>

                    <th className="min-w-[250px] px-5 py-4 text-center font-semibold">
                      Source Warehouses
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Expected Date
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Received By
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Delivery Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#D1D5DB]">
                  {paginatedDeliveries.map((delivery) => {
                    const order = orderMap.get(delivery.order_id);

                    return (
                      <tr
                        key={delivery.delivery_id}
                        className="bg-[#E5E7EB] text-center transition-colors hover:bg-[#DDE1E5]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                          DEL-{String(delivery.delivery_id).padStart(4, "0")}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          SO-{String(delivery.order_id).padStart(4, "0")}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {order
                            ? customerMap.get(order.customer_id) ??
                              `Customer #${order.customer_id}`
                            : "—"}
                        </td>

                        <td className="px-5 py-4 text-left text-slate-700">
                          {getWarehouseDisplay(delivery)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDate(delivery.delivery_date)}
                        </td>

                        <td className="px-5 py-4 text-slate-700">
                          {delivery.received_by ? (
                            <div>
                              <p className="font-medium">
                                {delivery.received_by}
                              </p>
                              {delivery.received_at && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatDateTime(delivery.received_at)}
                                </p>
                              )}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex min-w-[230px] flex-col items-center justify-center gap-2">
                            {renderStatusControls(delivery)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex min-w-0 flex-col gap-3 border-t border-[#D1D5DB] bg-[#E5E7EB] px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
          <p className="text-center text-sm text-slate-600 md:text-left">
            Showing{" "}
            <span className="font-semibold text-slate-800">
              {filteredDeliveries.length === 0 ? 0 : startIndex + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-800">
              {endIndex}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800">
              {filteredDeliveries.length}
            </span>{" "}
            deliveries
          </p>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => goToPage(safeCurrentPage - 1)}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="whitespace-nowrap px-2 text-sm font-medium text-slate-600">
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => goToPage(safeCurrentPage + 1)}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {deliveryToConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-slate-950/60 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm customer receipt"
            className="my-auto max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl border border-[#D1D5DB] bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-xl sm:p-6"
          >
            <div>
              <label
                htmlFor="received-by"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Recipient Name
              </label>

              <input
                id="received-by"
                type="text"
                autoFocus
                value={receivedBy}
                onChange={(e) => {
                  setReceivedBy(e.target.value);
                  setReceivedByError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleConfirmReceipt();
                  }
                }}
                placeholder="Enter recipient's full name"
                maxLength={150}
                disabled={updatingId !== null}
                className={`min-h-12 w-full rounded-lg border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
                  receivedByError
                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                    : "border-slate-300 focus:border-[#4F8585] focus:ring-[#4F8585]/20"
                }`}
              />

              {receivedByError && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {receivedByError}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeReceivedByModal}
                disabled={updatingId !== null}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleConfirmReceipt()}
                disabled={updatingId !== null}
                className="min-h-11 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingId !== null ? "Confirming..." : "Confirm Receipt"}
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
  valueStyle = "text-slate-900",
}: {
  title: string;
  value: string;
  valueStyle?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold text-slate-600 sm:text-sm">
        {title}
      </p>

      <p
        className={`mt-2 break-words text-xl font-bold sm:text-2xl ${valueStyle}`}
      >
        {value}
      </p>
    </div>
  );
}
