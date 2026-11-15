"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ProductionOrder = {
  Production_ID: number;
  PM_ID: number;
  WH_ID: number;
  QuantityRequired: number;
  QuantityProduced: number;
  StartDate: string;
  Deadline: string;
  status: string;
  UnitProductionCost: number|null;
};

type OrderForm = {
  PM_ID: string;
  WH_ID: string;
  QuantityRequired: string;
  StartDate: string;
  Deadline: string;
  UnitProductionCost: string;
};

const initialForm: OrderForm = {
  PM_ID: "",
  WH_ID: "",
  QuantityRequired: "",
  StartDate: "",
  Deadline: "",
  UnitProductionCost: "",
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState("Manufacturing");
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 10;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<OrderForm>(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  // Update form fields
  const handleChange = (
    field: keyof OrderForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // Register a production order
  const createOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

  const response = await fetch(`${API_URL}/orders/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      PM_ID: Number(form.PM_ID),
      WH_ID: Number(form.WH_ID),
      QuantityRequired: Number(form.QuantityRequired),
      UnitProductionCost: Number(form.UnitProductionCost),
      StartDate: form.StartDate,
      Deadline: form.Deadline,
    }),
  });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Failed to create production order."
        );
      }

      setMessage("Production order created successfully.");
      setForm(initialForm);

      await fetchOrders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.toLowerCase();

    const reference =
      `PO-${new Date(order.StartDate).getFullYear()}-${String(order.Production_ID).padStart(4, "0")}`;

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
      case "Ongoing":
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

      {/* Error and Success Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="p-3 rounded-lg bg-green-100 text-green-700 text-sm">
          {message}
        </div>
      )}

      {/* Add Production Order */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">

        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700">
            Add Production Order
          </h2>
          <p className="text-sm text-gray-500">
            Enter the required production order details.
          </p>
        </div>

        <form onSubmit={createOrder} className="p-5 space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Product Master ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PM_ID
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.PM_ID}
                onChange={(e) => handleChange("PM_ID", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#668d98]"
                placeholder="Enter Product Master ID"
              />
            </div>

            {/* Warehouse ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WH_ID
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.WH_ID}
                onChange={(e) => handleChange("WH_ID", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#668d98]"
                placeholder="Enter Warehouse ID"
              />
            </div>

            {/* Required Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity Required
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.QuantityRequired}
                onChange={(e) =>
                  handleChange("QuantityRequired", e.target.value)
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#668d98]"
                placeholder="Enter required quantity"
              />
            </div>

            {/* Unit Production Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Production Cost (₱)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.UnitProductionCost}
                onChange={(e) =>
                  handleChange("UnitProductionCost", e.target.value)
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#668d98]"
                placeholder="Enter cost per finished unit"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="datetime-local"
                required
                value={form.StartDate}
                onChange={(e) => handleChange("StartDate", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#668d98]"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline
              </label>
              <input
                type="datetime-local"
                required
                min={form.StartDate || undefined}
                value={form.Deadline}
                onChange={(e) => handleChange("Deadline", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#668d98]"
              />
            </div>

          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-[#365f68] text-white text-sm font-medium hover:bg-[#294b53] disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Add Production Order"}
            </button>
          </div>

        </form>
      </div>

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
          <option value="Ongoing">Ongoing</option>
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
                <th className="px-5 py-3">Unit Production Cost</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">

              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                    Loading production orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                    No production orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.Production_ID} className="hover:bg-gray-50">

                    <td className="px-5 py-3 font-semibold text-gray-700">
                      PO-{new Date(order.StartDate).getFullYear()}-
                      {String(order.Production_ID).padStart(4, "0")}
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
                      {new Date(order.StartDate).toLocaleString()}
                    </td>

                    <td className="px-5 py-3 whitespace-nowrap">
                      {new Date(order.Deadline).toLocaleString()}
                    </td>

                    <td className="px-5 py-3 whitespace-nowrap">
                      {order.UnitProductionCost === null
                        ? "—"
                        : `₱${order.UnitProductionCost.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
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
                  <th className="px-5 py-3">Unit Production Cost</th>
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
                          PO-{new Date(order.StartDate).getFullYear()}-
                          {String(order.Production_ID).padStart(4, "0")}
                        </td>

                        <td className="px-5 py-3">
                          PM #{order.PM_ID}
                        </td>

                        <td className="px-5 py-3">
                          {order.QuantityProduced}
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          {order.UnitProductionCost === null
                            ? "—"
                            : `₱${order.UnitProductionCost.toLocaleString("en-PH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
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