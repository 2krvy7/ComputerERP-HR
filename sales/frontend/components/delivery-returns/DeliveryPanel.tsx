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
import type {
  Delivery,
  DeliveryCreate,
  DeliveryStatus,
  Warehouse,
} from "../../types/delivery";
import type { SalesOrder } from "../../types/order";
import { isAdminRole } from "../../lib/roles";

const statusStyles: Record<string, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-800",
  Preparing: "border-blue-200 bg-blue-50 text-blue-800",
  Released: "border-teal-200 bg-teal-50 text-teal-800",
  Delivered: "border-green-200 bg-green-50 text-green-800",
  Cancelled: "border-red-200 bg-red-50 text-red-800",
};

const allowedTransitions: Record<string, DeliveryStatus[]> = {
  Pending: ["Preparing", "Cancelled"],
  Preparing: ["Released", "Cancelled"],
  Released: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
};

const displayStatus = (status: DeliveryStatus): string =>
  status === "Released" ? "Released by Inventory" : status;

const formatDate = (date: string | null) => {
  if (!date) return "—";

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-PH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const isAdmin = (user: AuthUser | null) =>
  isAdminRole(user?.role_id);

const canCreatePickup = (user: AuthUser | null) =>
  isAdmin(user) || user?.dept_id === "SL";

function getAvailableTransitions(
  status: DeliveryStatus,
  user: AuthUser | null
): DeliveryStatus[] {
  const transitions = allowedTransitions[status] ?? [];

  if (!user) return [];

  if (user.role_id === 1) {
    return transitions;
  }

  const isDepartmentAdmin = user.role_id === 3;

  if (user.dept_id === "IN" && (user.role_id === 2 || isDepartmentAdmin)) {
    return transitions.filter(
      (nextStatus) =>
        nextStatus === "Preparing" ||
        nextStatus === "Released" ||
        (isDepartmentAdmin && nextStatus === "Cancelled")
    );
  }

  if (user.dept_id === "SL" && (user.role_id === 2 || isDepartmentAdmin)) {
    return transitions.filter(
      (nextStatus) => nextStatus === "Delivered"
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
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [orderId, setOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [pickupDate, setPickupDate] = useState("");

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
          : "Unable to load pickup information."
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
    () => new Map(orders.map((order) => [order.order_id, order])),
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

      const warehouseName =
        warehouseMap.get(delivery.WH_ID) ?? "";

      return (
        String(delivery.delivery_id).includes(term) ||
        String(delivery.order_id).includes(term) ||
        customerName.toLowerCase().includes(term) ||
        warehouseName.toLowerCase().includes(term) ||
        displayStatus(delivery.status).toLowerCase().includes(term)
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
    (delivery) => delivery.status === "Pending"
  ).length;

  const readyForPickupCount = deliveries.filter(
    (delivery) => delivery.status === "Released"
  ).length;

  const deliveredCount = deliveries.filter(
    (delivery) => delivery.status === "Delivered"
  ).length;

  function resetForm() {
    setOrderId("");
    setWarehouseId("");
    setPickupDate("");
    setShowForm(false);
  }

  async function handleCreateDelivery() {
    setError("");

    if (!orderId || !warehouseId) {
      setError("Please select a sales order and warehouse.");
      return;
    }

    const selectedOrder = orders.find(
      (order) => order.order_id === Number(orderId)
    );

    if (
      !selectedOrder ||
      !["Accepted", "Approved"].includes(selectedOrder.status)
    ) {
      setError(
        "Only accepted sales orders can be added to customer pickup."
      );
      return;
    }

    const alreadyHasPickup = deliveries.some(
      (delivery) => delivery.order_id === Number(orderId)
    );

    if (alreadyHasPickup) {
      setError(
        "A pickup record already exists for this sales order."
      );
      return;
    }

    const data: DeliveryCreate = {
      order_id: Number(orderId),
      WH_ID: Number(warehouseId),
      delivery_date: pickupDate || null,
      delivery_address: "",
    };

    setSaving(true);

    try {
      await deliveryAPI.create(data);
      resetForm();
      setCurrentPage(1);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create pickup record."
      );
    } finally {
      setSaving(false);
    }
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
        `You are not authorized to change this pickup to ${displayStatus(newStatus)}.`
      );
      return;
    }

    let receivedBy: string | undefined;

    if (newStatus === "Delivered") {
      const customerName = window.prompt(
        "Enter the name of the customer who collected the items:"
      );

      if (customerName === null) return;

      receivedBy = customerName.trim();

      if (!receivedBy) {
        setError(
          "Enter the customer's name to confirm that the items were collected."
        );
        return;
      }
    }

    if (newStatus === "Cancelled") {
      const confirmed = window.confirm(
        "Are you sure you want to cancel this customer pickup? Any stock already released will not be automatically restored."
      );

      if (!confirmed) return;
    }

    setError("");
    setUpdatingId(delivery.delivery_id);

    try {
      const updated = await deliveryAPI.updateStatus(
        delivery.delivery_id,
        newStatus,
        receivedBy
      );

      setDeliveries((current) =>
        current.map((item) =>
          item.delivery_id === updated.delivery_id
            ? updated
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update pickup status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function goToPage(page: number) {
    setCurrentPage(
      Math.max(1, Math.min(page, totalPages))
    );
  }

  function renderStatusControls(delivery: Delivery) {
    const availableStatuses = getAvailableTransitions(
      delivery.status,
      currentUser
    );

    return (
      <div className="flex min-w-0 flex-col gap-2">
        <span
          className={`inline-flex w-fit max-w-full items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
            statusStyles[delivery.status] ??
            "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {displayStatus(delivery.status)}
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
            className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none transition focus:border-[#4F8585] focus:ring-2 focus:ring-[#4F8585]/20 disabled:cursor-wait disabled:opacity-60 sm:w-[180px]"
            aria-label={`Update pickup status for record ${delivery.delivery_id}`}
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
    <div className="min-w-0 w-full space-y-5 bg-white text-slate-800">
      {error && (
        <div
          role="alert"
          className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:p-4"
        >
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <SummaryCard
          title="Total Pickups"
          value={deliveries.length.toString()}
        />

        <SummaryCard
          title="Pending"
          value={pendingCount.toString()}
          valueStyle="text-amber-700"
        />

        <SummaryCard
          title="Ready for Pickup"
          value={readyForPickupCount.toString()}
          valueStyle="text-teal-700"
        />

        <SummaryCard
          title="Collected"
          value={deliveredCount.toString()}
          valueStyle="text-green-700"
        />
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-b border-[#D1D5DB] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">
              Customer Pickup Records
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Inventory prepares and releases items. Sales confirms customer collection.
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row lg:w-auto lg:flex-1 lg:justify-end">
            <div className="min-w-0 flex-1 lg:max-w-md">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pickup, order, customer, warehouse, or status..."
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#4F8585] focus:ring-2 focus:ring-[#4F8585]/20"
              />
            </div>

            {canCreatePickup(currentUser) && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setShowForm(true);
                }}
                className="min-h-11 w-full shrink-0 whitespace-nowrap rounded-lg bg-[#4F8585] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3D6D6D] sm:w-auto"
              >
                + Create Pickup
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-600">
            Loading pickup records...
          </div>
        ) : paginatedDeliveries.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-600">
            No pickup records found.
          </div>
        ) : (
          <>
            {/* Mobile pickup cards */}
            <div className="space-y-3 p-3 md:hidden">
              {paginatedDeliveries.map((delivery) => {
                const order = orderMap.get(delivery.order_id);
                const customerName = order
                  ? customerMap.get(order.customer_id) ??
                    `Customer #${order.customer_id}`
                  : "—";

                const warehouseName =
                  warehouseMap.get(delivery.WH_ID) ?? "—";

                return (
                  <article
                    key={delivery.delivery_id}
                    className="min-w-0 rounded-lg border border-[#D1D5DB] bg-white p-4 shadow-sm"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Pickup No.
                        </p>
                        <p className="mt-1 break-words font-bold text-slate-900">
                          PICK-{String(delivery.delivery_id).padStart(4, "0")}
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
                          Expected Pickup Date
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-800">
                          {formatDate(delivery.delivery_date)}
                        </p>
                      </div>

                      <div className="min-w-0 sm:col-span-2">
                        <p className="text-xs font-medium text-slate-500">
                          Warehouse
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-800">
                          {warehouseName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        Pickup Status
                      </p>
                      {renderStatusControls(delivery)}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop pickup table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#D1D5DB] text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Pickup No.
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Order No.
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Customer
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Expected Pickup Date
                    </th>

                    <th className="whitespace-nowrap px-5 py-4 text-center font-semibold">
                      Pickup Status
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
                          PICK-{String(delivery.delivery_id).padStart(4, "0")}
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

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDate(delivery.delivery_date)}
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

        {/* Pagination */}
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
            pickups
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

      {/* Create Pickup Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="my-auto max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl border border-[#D1D5DB] bg-[#E5E7EB] p-4 shadow-xl sm:max-h-[90dvh] sm:max-w-xl sm:rounded-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Create Customer Pickup
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Assign an approved sales order to a warehouse for preparation.
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="shrink-0 rounded-lg px-2 py-1 text-slate-500 transition hover:bg-[#D1D5DB] hover:text-slate-900 disabled:opacity-50"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Accepted Sales Order
                </label>

                <select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#4F8585] focus:ring-2 focus:ring-[#4F8585]/20"
                >
                  <option value="">Select sales order</option>

                  {orders
                    .filter((order) =>
                      ["Accepted", "Approved"].includes(order.status)
                    )
                    .filter(
                      (order) =>
                        !deliveries.some(
                          (delivery) =>
                            delivery.order_id === order.order_id
                        )
                    )
                    .map((order) => (
                      <option
                        key={order.order_id}
                        value={order.order_id}
                      >
                        SO-{String(order.order_id).padStart(4, "0")} —{" "}
                        {customerMap.get(order.customer_id) ??
                          `Customer #${order.customer_id}`}
                      </option>
                    ))}
                </select>

                <p className="mt-1.5 text-xs text-slate-500">
                  Only accepted orders without an existing pickup record are listed. Inventory must accept the order request first.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Warehouse
                </label>

                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#4F8585] focus:ring-2 focus:ring-[#4F8585]/20"
                >
                  <option value="">Select warehouse</option>

                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse.WH_ID}
                      value={warehouse.WH_ID}
                    >
                      {warehouse.Warehouse_Name}
                      {warehouse.Location
                        ? ` — ${warehouse.Location}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Expected Pickup Date
                </label>

                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-[#4F8585] focus:ring-2 focus:ring-[#4F8585]/20"
                />
              </div>

              <div className="rounded-lg border border-[#D1D5DB] bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Customer Pickup
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  The customer will collect the prepared items directly from the physical store. No delivery address is required.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#D1D5DB] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-[#DDE1E5] disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void handleCreateDelivery()}
                  disabled={saving}
                  className="min-h-11 rounded-lg bg-[#4F8585] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3D6D6D] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "Creating..." : "Create Pickup"}
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

      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl ${valueStyle}`}>
        {value}
      </p>
    </div>
  );
}