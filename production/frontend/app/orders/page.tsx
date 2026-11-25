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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
  setCurrentPage(1);
}, [searchTerm, statusFilter]);

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
      case "Pending":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

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

          {activeTab === "Manufacturing" && (
      <>

      {/* Error and Success */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="p-5 border-b border-gray-200">
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

      {/* Existing Production Orders */}
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
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    Loading production orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    No production orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.Production_ID} className="hover:bg-gray-50">

                    <td className="px-5 py-3 font-semibold text-gray-700">
                      {order.ProductionOrder_ID
                        ? `PO-${String(order.ProductionOrder_ID).padStart(4, "0")}`
                        : `PROD-${String(order.Production_ID).padStart(4, "0")}`}
                    </td>

                    <td className="px-5 py-3">
                      PM #{order.PM_ID}
                    </td>

                    <td className="px-5 py-3">
                      WH #{order.WH_ID}
                    </td>

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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}>
                        {order.status}
                      </span>
                    </td>

                  </tr>
                ))
              )}

            </tbody>
          </table>

        </div>
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
              Review unit production costs before applying selling price markups.
            </p>
          </div>

          {/* FINANCE UPDATE NOTICE */}
          <div className="mx-5 mt-5 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
            <h3 className="text-sm font-semibold text-yellow-800">
              Needs Updates from Finance Department
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Price review is currently awaiting updates from the Finance
              Department. Final selling prices and markup details will be
              displayed once the Finance workflow is established.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-5 py-3">Production Reference</th>
                  <th className="px-5 py-3">PM_ID</th>
                  <th className="px-5 py-3">Quantity Produced</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                      Loading completed orders...
                    </td>
                  </tr>
                ) : orders.filter((order) => order.status === "Completed").length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500">
                      No completed orders available for price review.
                    </td>
                  </tr>
                ) : (
                  orders
                    .filter((order) => order.status === "Completed")
                    .map((order) => (
                      <tr key={order.Production_ID} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-semibold text-gray-700">
                          {order.ProductionOrder_ID
                            ? `PO-${String(order.ProductionOrder_ID).padStart(4, "0")}`
                            : `PROD-${String(order.Production_ID).padStart(4, "0")}`}
                        </td>

                        <td className="px-5 py-3">
                          PM #{order.PM_ID}
                        </td>

                        <td className="px-5 py-3">
                          {order.QuantityProduced}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Product Handoff
          </h2>

          <p className="text-sm text-gray-500">
            This section will manage the release of completed and
            price-reviewed production orders to the Inventory Department.
            Inventory will inspect the received products and record the
            corresponding stock-in transaction after acceptance.
          </p>

          <div className="mt-5 py-10 text-center border border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 text-sm">
              Product Handoff workflow is not yet available.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Awaiting coordination with the Finance and Inventory Departments.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}