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
};

export default function Home() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [draftValues, setDraftValues] = useState<Record<number, string>>({});
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

      // Initialize inputs using the latest database quantities
      setDraftValues((previous) => {
        const updated = { ...previous };

        data.forEach((order) => {
          if (!(order.Production_ID in updated)) {
            updated[order.Production_ID] =
              String(order.QuantityProduced);
          }
        });

        return updated;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Update production progress through PATCH
  const updateProgress = async (order: ProductionOrder) => {
    const quantity = Number(draftValues[order.Production_ID]);

    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > order.QuantityRequired
    ) {
      setError(
        `Enter a whole number between 0 and ${order.QuantityRequired}.`
      );
      return;
    }

    try {
      setUpdatingId(order.Production_ID);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/orders/${order.Production_ID}/progress`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            QuantityProduced: quantity,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Failed to update production progress."
        );
      }

      setMessage(
        `Production order #${order.Production_ID} updated successfully.`
      );

      await fetchOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Production statistics
  const totalOrders = orders.length;

  const pendingOrders = orders.filter(
    (order) => order.status === "Pending"
  ).length;

  const ongoingOrders = orders.filter(
    (order) => order.status === "In Progress"
  ).length;

  const completedOrders = orders.filter(
    (order) => order.status === "Completed"
  ).length;

  const summaryCards = [
    { title: "Total Orders", value: totalOrders },
    { title: "Pending", value: pendingOrders },
    { title: "In Progress", value: ongoingOrders },
    { title: "Completed", value: completedOrders },
  ];

  const upcomingOrders = [...orders]
    .filter(
      (order) => order.status?.toLowerCase() !== "completed"
    )
    .sort(
      (a, b) =>
        new Date(a.Deadline).getTime() -
        new Date(b.Deadline).getTime()
    )
    .slice(0, 5);

  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "in progress":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const isOverdue = (deadline: string) =>
    new Date(deadline).getTime() < Date.now();

  return (
    <div className="p-6 space-y-6">

      {/* LOADING AND ERROR */}
      {loading ? (
        <p className="text-gray-500 py-8 text-center">
          Loading dashboard...
        </p>
      ) : error && orders.length === 0 ? (
        <p className="text-red-500 py-8 text-center">
          {error}
        </p>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.title}
                className="bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm"
              >
                <p className="text-sm text-gray-500">
                  {card.title}
                </p>

                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {card.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* ERROR AND SUCCESS MESSAGES */}
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

          {/* QUICK ACTIONS */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              Quick Actions
            </h2>

            <p className="text-sm text-gray-500 mb-5">
              Quickly navigate to production functions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="/products"
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <p className="font-medium text-gray-800">Products</p>
                <p className="text-xs text-gray-500 mt-1">
                  View and manage products
                </p>
              </a>

              <a
                href="/orders"
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <p className="font-medium text-gray-800">
                  Production Orders
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  View and manage orders
                </p>
              </a>

              <a
                href="/requests"
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <p className="font-medium text-gray-800">
                  Material Requests
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  View material requirements
                </p>
              </a>

              <a
                href="/reports"
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <p className="font-medium text-gray-800">
                  Production Reports
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Review production performance
                </p>
              </a>
            </div>
          </div>

          {/* PENDING REQUESTS */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              Pending Requests
            </h2>

            <p className="text-sm text-gray-500 mb-5">
              Review incoming production requests from Inventory.
            </p>

            <div className="py-10 text-center border border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 text-sm">
                No pending requests to display.
              </p>

              <p className="text-gray-400 text-xs mt-1">
                Incoming requests will appear here.
              </p>
            </div>
          </div>

          {/* UPCOMING DEADLINES */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              Upcoming Production Deadlines
            </h2>

            <p className="text-sm text-gray-500 mb-5">
              Production orders that need attention.
            </p>

            {upcomingOrders.length > 0 ? (
              <div className="space-y-4">
                {upcomingOrders.map((order) => (
                  <div
                    key={order.Production_ID}
                    className="flex justify-between items-center gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm">
                        Production #{order.Production_ID}
                      </p>

                      <p className="text-sm text-gray-600">
                        PM #{order.PM_ID}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        Deadline: {formatDate(order.Deadline)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isOverdue(order.Deadline) ? (
                        <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">
                          Overdue
                        </span>
                      ) : (
                        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Upcoming
                        </span>
                      )}

                      <span
                        className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">
                No pending production deadlines.
              </p>
            )}
          </div>

          {/* PROCESSING RELEASE ORDERS */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              Processing Release Orders
            </h2>

            <p className="text-sm text-gray-500 mb-5">
              Completed production batches awaiting handoff to Inventory.
            </p>

            <div className="py-10 text-center border border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 text-sm">
                No release orders to display.
              </p>

              <p className="text-gray-400 text-xs mt-1">
                Completed batches awaiting Inventory handoff will appear here.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}