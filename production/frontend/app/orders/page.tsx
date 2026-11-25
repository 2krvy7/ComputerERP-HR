
"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ProductionOrder = {
  Production_ID: number;
  ProductionOrder_ID: number | null;
  PM_ID: number;
  WH_ID: number;
  QuantityRequired: number;
  QuantityProduced: number;
  StartDate: string | null;
  Deadline: string | null;
  CompletionDate: string | null;
  status: string;
};

type FinanceOrder = {
  Production_ID: number;
  ProductionOrder_ID: number | null;
  PM_ID: number;
  WH_ID: number;
  QuantityProduced: number;
  productCost: number | null;
  status: string;
};

type HandoffOrder = {
  Production_ID: number;
  PM_ID: number;
  WH_ID: number;
  Product_Name: string;
  SKU: string;
  QuantityRequired: number;
  QuantityProduced: number;
  StartDate: string | null;
  Deadline: string | null;
  CompletionDate: string | null;
  status: string;
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState("Manufacturing");
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;
  const [error, setError] = useState("");

  const [financeOrders, setFinanceOrders] = useState<FinanceOrder[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState("");

  const [handoffOrders, setHandoffOrders] = useState<HandoffOrder[]>([]);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [sendingOff, setSendingOff] = useState<number | null>(null);

  // Retrieve production orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/orders/`);

      if (!response.ok) {
        throw new Error("Failed to retrieve production orders.");
      }

      const data: ProductionOrder[] = await response.json();
      setOrders(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Retrieve completed orders for Price Review
  const fetchFinanceOrders = useCallback(async () => {
    try {
      setFinanceLoading(true);
      setFinanceError("");

      const response = await fetch(`${API_URL}/orders/finance`);

      if (!response.ok) {
        throw new Error(
          "Failed to retrieve completed orders for Price Review."
        );
      }

      const data: FinanceOrder[] = await response.json();
      console.log("FINANCE ORDERS:", data);
      setFinanceOrders(data);

    } catch (err) {
      setFinanceError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setFinanceLoading(false);
    }
  }, []);

  // Retrieve batches for Product Handoff
  const fetchHandoffOrders = useCallback(async () => {
    try {
      setHandoffLoading(true);
      setHandoffError("");

      const response = await fetch(
        `${API_URL}/production-orders/kanban`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to retrieve production batches for handoff."
        );
      }

      const data: HandoffOrder[] = await response.json();
      setHandoffOrders(data);
    } catch (err) {
      setHandoffError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setHandoffLoading(false);
    }
  }, []);

  // Send completed production batch to Inventory
  const handleSendOff = async (productionId: number) => {
    try {
      setSendingOff(productionId);
      setHandoffError("");

      const response = await fetch(
        `${API_URL}/production-orders/${productionId}/status?new_status=Released`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.detail || "Failed to release production batch."
        );
      }

      await Promise.all([
        fetchHandoffOrders(),
        fetchOrders(),
      ]);
    } catch (err) {
      setHandoffError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSendingOff(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (activeTab === "Price Review") {
      fetchFinanceOrders();
    }

    if (activeTab === "Product Handoff") {
      fetchHandoffOrders();
    }
  }, [activeTab, fetchFinanceOrders, fetchHandoffOrders]);

  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.toLowerCase();

    const reference = order.ProductionOrder_ID
      ? `PO-${String(order.ProductionOrder_ID).padStart(4, "0")}`
      : `PROD-${String(order.Production_ID).padStart(4, "0")}`;

    const matchesSearch =
      reference.toLowerCase().includes(search) ||
      `pm #${order.PM_ID}`.includes(search) ||
      `pm ${order.PM_ID}`.includes(search) ||
      `wh #${order.WH_ID}`.includes(search) ||
      `wh ${order.WH_ID}`.includes(search) ||
      String(order.PM_ID).includes(search) ||
      String(order.WH_ID).includes(search);

    const matchesStatus =
      statusFilter === "All" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const startIndex = (currentPage - 1) * ordersPerPage;

  const paginatedOrders = filteredOrders.slice(
    startIndex,
    startIndex + ordersPerPage
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-700";
      case "In Progress":
        return "bg-blue-100 text-blue-700";
      case "Released":
        return "bg-purple-100 text-purple-700";
      case "Pending":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  // Only completed batches can be sent off.
  const readyForHandoff = handoffOrders.filter(
    (order) => order.status === "Completed"
  );

  // History contains released batches only.
  const handoffHistory = handoffOrders.filter(
    (order) => order.status === "Released"
  );

  const formatProductionReference = (productionId: number) =>
    `PROD-${String(productionId).padStart(4, "0")}`;

  return (
    <div className="p-6 space-y-6">
      {/* ORDER WORKFLOW TABS */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {["Manufacturing", "Price Review", "Product Handoff"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium rounded-t-lg transition ${
              activeTab === tab
                ? "bg-[#365f68] text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* MANUFACTURING TAB */}
      {activeTab === "Manufacturing" && (
        <>
          {error && (
            <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="p-5 border-b border-gray-200 flex flex-wrap gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order reference, PM ID, or WH ID..."
              className="w-full md:w-96 bg-white text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#668d98]"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-gray-900 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 bg-white border border-gray-300 rounded-xl shadow-sm flex flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-gray-700">
                Production Orders
              </h2>
              <p className="text-sm text-gray-500">
                View your registered production orders.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3">Production ID</th>
                    <th className="px-5 py-3">PM_ID</th>
                    <th className="px-5 py-3">WH_ID</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Start Date</th>
                    <th className="px-5 py-3">Deadline</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr key="loading-production-orders">
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                        Loading production orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr key="empty-production-orders">
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                        No production orders found.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => (
                      <tr
                        key={order.Production_ID}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-5 py-3 font-semibold text-gray-700">
                          {order.ProductionOrder_ID
                            ? `PO-${String(order.ProductionOrder_ID).padStart(4, "0")}`
                            : `PROD-${String(order.Production_ID).padStart(4, "0")}`}
                        </td>

                        <td className="px-5 py-3">PM #{order.PM_ID}</td>
                        <td className="px-5 py-3">WH #{order.WH_ID}</td>

                        <td className="px-5 py-3">
                          {order.QuantityProduced} / {order.QuantityRequired}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {order.StartDate
                            ? new Date(order.StartDate).toLocaleString()
                            : "Not scheduled"}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {order.Deadline
                            ? new Date(order.Deadline).toLocaleString()
                            : "Not scheduled"}
                        </td>

                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Showing {startIndex + 1}–
                  {Math.min(startIndex + ordersPerPage, filteredOrders.length)} of{" "}
                  {filteredOrders.length} orders
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* PRICE REVIEW TAB */}
      {activeTab === "Price Review" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-700">
              Completed Orders for Price Review
            </h2>
            <p className="text-sm text-gray-500">
              Review production costs returned by Finance.
            </p>
          </div>

          {financeError && (
            <div className="m-5 p-3 rounded-lg bg-red-100 text-red-700 text-sm">
              {financeError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-5 py-3">Production Reference</th>
                  <th className="px-5 py-3">PM_ID</th>
                  <th className="px-5 py-3">WH_ID</th>
                  <th className="px-5 py-3">Quantity Produced</th>
                  <th className="px-5 py-3">Product Cost</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {financeLoading ? (
                  <tr key="loading-finance-orders">
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                      Loading completed orders...
                    </td>
                  </tr>
                ) : financeOrders.length === 0 ? (
                  <tr key="empty-finance-orders">
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                      No completed orders available for price review.
                    </td>
                  </tr>
                ) : (
                  financeOrders.map((order, index) => (
                    <tr
                      key={`${order.Production_ID ?? order.ProductionOrder_ID ?? "finance"}-${index}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-5 py-3 font-semibold text-gray-700">
                        {order.ProductionOrder_ID
                          ? `PO-${String(order.ProductionOrder_ID).padStart(4, "0")}`
                          : `PROD-${String(order.Production_ID).padStart(4, "0")}`}
                      </td>

                      <td className="px-5 py-3">PM #{order.PM_ID}</td>
                      <td className="px-5 py-3">WH #{order.WH_ID}</td>
                      <td className="px-5 py-3">{order.QuantityProduced}</td>

                      <td className="px-5 py-3 font-medium text-gray-700">
                        {order.productCost !== null
                          ? `₱${Number(order.productCost).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : "Not yet provided"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRODUCT HANDOFF TAB */}
      {activeTab === "Product Handoff" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-700">
              Product Handoff
            </h2>
            <p className="text-sm text-gray-500">
              Release completed production batches to the Inventory Department.
            </p>
          </div>

          {handoffError && (
            <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">
              {handoffError}
            </div>
          )}

          {/* READY FOR HANDOFF */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-700">
                Ready for Handoff
              </h3>
              <p className="text-sm text-gray-500">
                Completed production batches awaiting release.
              </p>
            </div>

            {handoffLoading ? (
              <div className="py-10 text-center text-sm text-gray-500">
                Loading production batches...
              </div>
            ) : readyForHandoff.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                No completed batches awaiting handoff.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {readyForHandoff.map((order) => (
                  <div
                    key={order.Production_ID}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-800">
                        {formatProductionReference(order.Production_ID)}
                      </p>

                      <p className="text-sm text-gray-700">
                        {order.Product_Name}
                      </p>

                      <p className="text-xs text-gray-500">
                        SKU: {order.SKU}
                      </p>

                      <p className="text-xs text-gray-500">
                        PM #{order.PM_ID} · WH #{order.WH_ID}
                      </p>

                      <p className="text-sm text-gray-600">
                        Quantity Produced: {order.QuantityProduced}
                      </p>

                      <p className="text-xs text-gray-400">
                        Completed:{" "}
                        {order.CompletionDate
                          ? new Date(order.CompletionDate).toLocaleString()
                          : "Completion date unavailable"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Completed
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSendOff(order.Production_ID)}
                        disabled={sendingOff !== null}
                        className="px-4 py-2 rounded-lg bg-[#365f68] text-white text-sm font-medium hover:bg-[#294b53] disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {sendingOff === order.Production_ID
                          ? "Sending..."
                          : "Send Off"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HANDOFF HISTORY */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-700">
                Handoff History
              </h3>
              <p className="text-sm text-gray-500">
                Previously released production batches.
              </p>
            </div>

            {handoffLoading ? (
              <div className="py-10 text-center text-sm text-gray-500">
                Loading handoff history...
              </div>
            ) : handoffHistory.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                No released production batches yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {handoffHistory.map((order) => (
                  <div
                    key={order.Production_ID}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-800">
                        {formatProductionReference(order.Production_ID)}
                      </p>

                      <p className="text-sm text-gray-700">
                        {order.Product_Name}
                      </p>

                      <p className="text-xs text-gray-500">
                        SKU: {order.SKU}
                      </p>

                      <p className="text-xs text-gray-500">
                        PM #{order.PM_ID} · WH #{order.WH_ID}
                      </p>

                      <p className="text-sm text-gray-600">
                        Quantity Released: {order.QuantityProduced}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium w-fit ${getStatusStyle(order.status)}`}
                    >
                      Released
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}