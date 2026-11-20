
"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboardlayout";
import { apiFetch } from "@/lib/api";

const mainTabs = [
  "Upcoming Requests",
  "Procurement",
  "Production",
  "Sales",
] as const;

type MainTab = (typeof mainTabs)[number];

const departmentSections = {
  Procurement: [
    "Purchase Requests",
    "Purchase Orders",
    "Goods Received",
  ],
  Production: [
    "Material Requests",
    "Material Release",
    "Production Updates",
    "Finished Goods Received",
  ],
  Sales: [
    "Sales Orders",
    "Stock Reservation",
    "Delivery Requests",
    "Sales Returns",
  ],
};

type RestockRequest = {
  RR_ID: number;
  IM_ID: number;
  Item_Name: string;
  SKU: string;
  ItemType: string;
  Quantity: number;
  WH_ID: number;
  Warehouse_Name: string;
  issued: string | null;
  approved_by: string | null;
  approved_date: string | null;
  status: string;
};

type UpcomingStock = {
  STOCK_ID: number;
  IM_ID: number;
  Item_Name: string;
  SKU: string;
  ItemType: string;
  quantity_on_hand: number;
  reorder_level: number;
  WH_ID: number;
  Warehouse_Name: string;
  stock_status: string;
};

type PurchaseRequest = {
  PR_ID: number;
  Status: string;
  DateIssued: string | null;
  RestockRequestID: number;
  IM_ID: number;
  Item_Name: string;
  SKU: string;
  ItemType: string;
  Quantity: number;
  WH_ID: number;
  Warehouse_Name: string;
};

type PurchaseOrder = {
  PO_ID: number;
  RFQ_ID: number;
  PR_ID: number;
  SupplierID: number;
  SupplierName: string;
  QuotedAmount: number;
  DeliveryTerms: string;
  Total_Amount: number;
  OrderDate: string | null;
};

type GoodsReceived = {
  GR_ID: number;
  PO_ID: number;
  RFQ_ID: number;
  PR_ID: number;
  SupplierName: string;
  ReceivedBy: string;
  ReceivedDate: string | null;
  ItemCondition: string | null;
  DeliveredQuantity: number;
  AcceptedQuantity: number | null;
  Remarks: string | null;
  InspectionStatus: string;
};

const sectionDescriptions: Record<string, string> = {
  "Upcoming Requests":
    "Monitor low-stock Raw Materials and Finished Goods across warehouses and send replenishment requests to the responsible department.",

  "Purchase Requests":
    "Monitor incoming Raw Material requests and purchase requests created by Procurement.",

  "Purchase Orders":
    "View and monitor purchase orders created by Procurement.",

  "Goods Received":
    "Inspect delivered items, record accepted quantities, and process stock in.",

  "Material Requests":
    "View material requests submitted by the Production department.",

  "Material Release":
    "Monitor and record raw materials released from the warehouse.",

  "Production Updates":
    "Monitor production progress and material usage.",

  "Finished Goods Received":
    "Record finished products received from Production into the warehouse.",

  "Sales Orders":
    "View customer orders submitted by the Sales department.",

  "Stock Reservation":
    "Monitor inventory allocated for customer orders.",

  "Delivery Requests":
    "Monitor items requested for customer delivery.",

  "Sales Returns":
    "Inspect returned products and record accepted items.",
};

export default function OrdersPage() {
  const [activeDepartment, setActiveDepartment] =
    useState<MainTab>("Upcoming Requests");

  const [activeSection, setActiveSection] =
    useState("Upcoming Requests");

  const [purchaseRequestTab, setPurchaseRequestTab] =
    useState("Incoming Requests");

  // Incoming Requests
  const [incomingRequests, setIncomingRequests] =
    useState<RestockRequest[]>([]);

  const [incomingLoading, setIncomingLoading] =
    useState(true);

  const [incomingError, setIncomingError] =
    useState("");

  // Upcoming Requests
  const [upcomingRequests, setUpcomingRequests] =
    useState<UpcomingStock[]>([]);

  const [upcomingLoading, setUpcomingLoading] =
    useState(true);

  const [upcomingError, setUpcomingError] =
    useState("");

  const [requestQuantities, setRequestQuantities] =
    useState<Record<number, string>>({});

  const [submittingStock, setSubmittingStock] =
    useState<number | null>(null);

  // Purchase Requests
  const [purchaseRequests, setPurchaseRequests] =
    useState<PurchaseRequest[]>([]);

  const [purchaseRequestsLoading, setPurchaseRequestsLoading] =
    useState(true);

  const [purchaseRequestsError, setPurchaseRequestsError] =
    useState("");

  // Purchase Orders
  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);

  const [purchaseOrdersLoading, setPurchaseOrdersLoading] =
    useState(true);

  const [purchaseOrdersError, setPurchaseOrdersError] =
    useState("");

  // Goods Received
  const [goodsReceived, setGoodsReceived] =
    useState<GoodsReceived[]>([]);

  const [goodsReceivedLoading, setGoodsReceivedLoading] =
    useState(true);

  const [goodsReceivedError, setGoodsReceivedError] =
    useState("");

  // Inspection inputs
  const [inspectionInputs, setInspectionInputs] = useState<
    Record<number, { acceptedQuantity: string; remarks: string }>
  >({});

  const [confirmingGR, setConfirmingGR] =
    useState<number | null>(null);

  // Fetch Incoming Requests
  useEffect(() => {
    const fetchIncomingRequests = async () => {
      try {
        const response = await apiFetch(
          "/orders/incoming-requests"
        );

        if (!response.ok) {
          throw new Error("Failed to load incoming requests.");
        }

        const data = await response.json();
        setIncomingRequests(data);
      } catch (error) {
        setIncomingError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setIncomingLoading(false);
      }
    };

    fetchIncomingRequests();
  }, []);

  // Fetch Upcoming Requests
  useEffect(() => {
    const fetchUpcomingRequests = async () => {
      try {
        const response = await apiFetch(
          "/orders/upcoming-requests"
        );

        if (!response.ok) {
          throw new Error("Failed to load upcoming requests.");
        }

        const data = await response.json();
        setUpcomingRequests(data);
      } catch (error) {
        setUpcomingError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setUpcomingLoading(false);
      }
    };

    fetchUpcomingRequests();
  }, []);

  // Fetch Purchase Requests
  useEffect(() => {
    const fetchPurchaseRequests = async () => {
      try {
        const response = await apiFetch(
          "/orders/purchase-requests"
        );

        if (!response.ok) {
          throw new Error("Failed to load purchase requests.");
        }

        const data = await response.json();
        setPurchaseRequests(data);
      } catch (error) {
        setPurchaseRequestsError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setPurchaseRequestsLoading(false);
      }
    };

    fetchPurchaseRequests();
  }, []);

  // Fetch Purchase Orders
  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      try {
        const response = await apiFetch(
          "/orders/purchase-orders"
        );

        if (!response.ok) {
          throw new Error("Failed to load purchase orders.");
        }

        const data = await response.json();
        setPurchaseOrders(data);
      } catch (error) {
        setPurchaseOrdersError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setPurchaseOrdersLoading(false);
      }
    };

    fetchPurchaseOrders();
  }, []);

  // Fetch Goods Received
  useEffect(() => {
    const fetchGoodsReceived = async () => {
      try {
        const response = await apiFetch(
          "/orders/goods-received"
        );

        if (!response.ok) {
          throw new Error("Failed to load goods received records.");
        }

        const data = await response.json();
        setGoodsReceived(data);
      } catch (error) {
        setGoodsReceivedError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setGoodsReceivedLoading(false);
      }
    };

    fetchGoodsReceived();
  }, []);

  // Change Main Tab
  const handleDepartmentChange = (tab: MainTab) => {
    setActiveDepartment(tab);

    if (tab === "Upcoming Requests") {
      setActiveSection("Upcoming Requests");
    } else {
      setActiveSection(departmentSections[tab][0]);
    }
  };

  // Send Restock Request
  const handleSendRestockRequest = async (item: UpcomingStock) => {
    const quantityInput = requestQuantities[item.STOCK_ID];
    const quantity = Number(quantityInput);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      alert("Please enter a valid requested quantity.");
      return;
    }

    if (
      item.ItemType !== "Raw" &&
      item.ItemType !== "Finished"
    ) {
      alert("Unsupported item type.");
      return;
    }

    try {
      setSubmittingStock(item.STOCK_ID);

      const response = await apiFetch(
        "/orders/restock-requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stock_id: item.STOCK_ID,
            quantity: quantity,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to send the restock request."
        );
      }

      alert(
        item.ItemType === "Raw"
          ? "Request sent to Procurement successfully."
          : "Request sent to Production successfully."
      );

      setRequestQuantities((prev) => ({
        ...prev,
        [item.STOCK_ID]: "",
      }));

      // Refresh Upcoming Requests
      const refreshResponse = await apiFetch(
        "/orders/upcoming-requests"
      );

      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setUpcomingRequests(refreshedData);
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSubmittingStock(null);
    }
  };

  // Calculate Inspection Details
  const getInspectionDetails = (record: GoodsReceived) => {
    const acceptedQuantityInput =
      inspectionInputs[record.GR_ID]?.acceptedQuantity ??
      (record.AcceptedQuantity !== null &&
      record.AcceptedQuantity !== undefined
        ? String(record.AcceptedQuantity)
        : "");

    const acceptedQuantity = Number(acceptedQuantityInput);
    const deliveredQuantity = Number(record.DeliveredQuantity);

    const isValid =
      acceptedQuantityInput !== "" &&
      Number.isInteger(acceptedQuantity) &&
      acceptedQuantity >= 0 &&
      acceptedQuantity <= deliveredQuantity;

    const damagedQuantity = isValid
      ? deliveredQuantity - acceptedQuantity
      : 0;

    let itemCondition = "";

    if (isValid) {
      if (acceptedQuantity === deliveredQuantity) {
        itemCondition = "Good";
      } else if (acceptedQuantity === 0) {
        itemCondition = "Damaged";
      } else {
        itemCondition = "Partial";
      }
    }

    return {
      acceptedQuantity,
      damagedQuantity,
      itemCondition,
      isValid,
    };
  };

  // Confirm Goods Received
  const handleConfirmStock = async (record: GoodsReceived) => {
    const details = getInspectionDetails(record);

    if (!details.isValid) {
      alert("Please enter a valid accepted quantity.");
      return;
    }

    try {
      setConfirmingGR(record.GR_ID);

      const response = await apiFetch(
        `/orders/goods-received/${record.GR_ID}/confirm-count`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity_received: details.acceptedQuantity,
            remarks:
              inspectionInputs[record.GR_ID]?.remarks ??
              record.Remarks ??
              null,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to confirm received stock."
        );
      }

      alert("Goods received successfully confirmed.");

      // Refresh Goods Received records
      const refreshResponse = await apiFetch(
        "/orders/goods-received"
      );

      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setGoodsReceived(refreshedData);
      }

      // Refresh Upcoming Requests
      const upcomingResponse = await apiFetch(
        "/orders/upcoming-requests"
      );

      if (upcomingResponse.ok) {
        const upcomingData = await upcomingResponse.json();
        setUpcomingRequests(upcomingData);
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setConfirmingGR(null);
    }
  };

  const getInspectionStatusLabel = (record: GoodsReceived) => {
    if (record.InspectionStatus === "Pending Inspection") {
      return "Pending Inspection";
    }

    const condition = record.ItemCondition?.toLowerCase();

    if (condition === "good") {
      return "Inspected - Good";
    }

    if (
      condition === "partial" ||
      condition === "partiallydamaged"
    ) {
      return "Inspected - Partial";
    }

    if (condition === "damaged") {
      return "Inspected - Damaged";
    }

    return "Inspected";
  };

  const isInspectionCompleted = (record: GoodsReceived) => {
    return record.InspectionStatus === "Inspected";
  };

  // Only Raw Material requests belong in Procurement.
  const procurementIncomingRequests = incomingRequests.filter(
    (request) => request.ItemType === "Raw"
  );

  return (
    <DashboardLayout
      title="Orders"
      description="Monitor transactions and requests across Upcoming Requests, Procurement, Production, and Sales."
    >
      <div className="space-y-6">

        {/* Main Tabs */}
        <div className="flex flex-wrap gap-3 border-b border-[#DCE7EA] pb-3">
          {mainTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleDepartmentChange(tab)}
              className={`rounded-full px-6 py-3 text-sm font-bold transition-colors ${
                activeDepartment === tab
                  ? "bg-[#365f68] text-white"
                  : "bg-[#F2F7F8] text-[#587176] hover:bg-[#DCE7EA]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Department Subtabs */}
        {activeDepartment !== "Upcoming Requests" && (
          <div className="flex flex-wrap gap-2">
            {departmentSections[activeDepartment].map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  activeSection === section
                    ? "bg-[#668d98] text-white"
                    : "bg-[#F2F7F8] text-[#587176] hover:bg-[#DCE7EA]"
                }`}
              >
                {section}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="min-h-[350px] rounded-2xl border border-[#DCE7EA] bg-white p-6">

          {/* Content Heading */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#668d98]">
              {activeDepartment === "Upcoming Requests"
                ? "Inventory Monitoring"
                : activeDepartment}
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#1F3338]">
              {activeSection}
            </h2>

            <p className="mt-2 text-sm text-[#587176]">
              {sectionDescriptions[activeSection]}
            </p>
          </div>

          {/* Upcoming Requests */}
          {activeDepartment === "Upcoming Requests" && (
            <div className="overflow-x-auto rounded-xl border border-[#DCE7EA]">
              {upcomingLoading ? (
                <p className="p-8 text-center text-sm text-[#587176]">
                  Loading stock monitoring...
                </p>
              ) : upcomingError ? (
                <p className="p-8 text-center text-sm text-red-600">
                  {upcomingError}
                </p>
              ) : upcomingRequests.length === 0 ? (
                <p className="p-8 text-center text-sm text-[#587176]">
                  No low-stock or approaching-reorder items available.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F2F7F8] text-[#365f68]">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Warehouse</th>
                      <th className="p-3">Available Stock</th>
                      <th className="p-3">Reorder Level</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Request Quantity</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {upcomingRequests.map((item) => (
                      <tr
                        key={item.STOCK_ID}
                        className="border-t border-[#DCE7EA] text-[#1F3338]"
                      >
                        <td className="p-3">{item.Item_Name}</td>

                        <td className="p-3">{item.SKU}</td>

                        <td className="p-3">
                          {item.ItemType === "Raw"
                            ? "Raw Material"
                            : item.ItemType === "Finished"
                              ? "Finished Good"
                              : item.ItemType}
                        </td>

                        <td className="p-3">
                          {item.Warehouse_Name}
                        </td>

                        <td className="p-3">
                          {item.quantity_on_hand}
                        </td>

                        <td className="p-3">
                          {item.reorder_level}
                        </td>

                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.stock_status === "Low Stock"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {item.stock_status}
                          </span>
                        </td>

                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={
                              requestQuantities[item.STOCK_ID] ?? ""
                            }
                            onChange={(e) =>
                              setRequestQuantities((prev) => ({
                                ...prev,
                                [item.STOCK_ID]: e.target.value,
                              }))
                            }
                            placeholder="Enter quantity"
                            className="w-36 rounded-lg border border-[#DCE7EA] px-3 py-2 text-sm text-[#1F3338] outline-none focus:border-[#668d98]"
                          />
                        </td>

                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleSendRestockRequest(item)
                            }
                            disabled={
                              submittingStock === item.STOCK_ID ||
                              !requestQuantities[item.STOCK_ID] ||
                              (item.ItemType !== "Raw" &&
                                item.ItemType !== "Finished")
                            }
                            className="whitespace-nowrap rounded-lg bg-[#365f68] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#24363B] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {submittingStock === item.STOCK_ID
                              ? "Sending..."
                              : item.ItemType === "Raw"
                                ? "Send to Procurement"
                                : item.ItemType === "Finished"
                                  ? "Send to Production"
                                  : "Unsupported Item Type"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Procurement - Purchase Requests */}
          {activeDepartment === "Procurement" &&
            activeSection === "Purchase Requests" && (
              <div className="space-y-5">

                {/* Purchase Request Subtabs */}
                <div className="flex flex-wrap gap-2 border-b border-[#DCE7EA] pb-3">
                  {["Incoming Requests", "Purchase Requests"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setPurchaseRequestTab(tab)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        purchaseRequestTab === tab
                          ? "border border-[#668d98] bg-[#F2F7F8] text-[#365f68]"
                          : "text-[#587176] hover:bg-[#F2F7F8]"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Incoming Raw Material Requests */}
                {purchaseRequestTab === "Incoming Requests" ? (
                  <div className="overflow-x-auto rounded-xl border border-[#DCE7EA]">
                    {incomingLoading ? (
                      <p className="p-8 text-center text-sm text-[#587176]">
                        Loading incoming requests...
                      </p>
                    ) : incomingError ? (
                      <p className="p-8 text-center text-sm text-red-600">
                        {incomingError}
                      </p>
                    ) : procurementIncomingRequests.length === 0 ? (
                      <p className="p-8 text-center text-sm text-[#587176]">
                        No incoming Raw Material requests available.
                      </p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#F2F7F8] text-[#365f68]">
                          <tr>
                            <th className="p-3">Request ID</th>
                            <th className="p-3">Item</th>
                            <th className="p-3">SKU</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Quantity</th>
                            <th className="p-3">Warehouse</th>
                            <th className="p-3">Approved By</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {procurementIncomingRequests.map((request) => (
                            <tr
                              key={request.RR_ID}
                              className="border-t border-[#DCE7EA] text-[#1F3338]"
                            >
                              <td className="p-3">{request.RR_ID}</td>
                              <td className="p-3">{request.Item_Name}</td>
                              <td className="p-3">{request.SKU}</td>
                              <td className="p-3">{request.ItemType}</td>
                              <td className="p-3">{request.Quantity}</td>
                              <td className="p-3">
                                {request.Warehouse_Name}
                              </td>
                              <td className="p-3">
                                {request.approved_by ?? "-"}
                              </td>
                              <td className="p-3">{request.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : (
                  /* Purchase Requests */
                  <div className="overflow-x-auto rounded-xl border border-[#DCE7EA]">
                    {purchaseRequestsLoading ? (
                      <p className="p-8 text-center text-sm text-[#587176]">
                        Loading purchase requests...
                      </p>
                    ) : purchaseRequestsError ? (
                      <p className="p-8 text-center text-sm text-red-600">
                        {purchaseRequestsError}
                      </p>
                    ) : purchaseRequests.length === 0 ? (
                      <p className="p-8 text-center text-sm text-[#587176]">
                        No purchase requests available.
                      </p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#F2F7F8] text-[#365f68]">
                          <tr>
                            <th className="p-3">PR ID</th>
                            <th className="p-3">Item</th>
                            <th className="p-3">SKU</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Quantity</th>
                            <th className="p-3">Warehouse</th>
                            <th className="p-3">Date Issued</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {purchaseRequests.map((request) => (
                            <tr
                              key={request.PR_ID}
                              className="border-t border-[#DCE7EA] text-[#1F3338]"
                            >
                              <td className="p-3">{request.PR_ID}</td>
                              <td className="p-3">{request.Item_Name}</td>
                              <td className="p-3">{request.SKU}</td>
                              <td className="p-3">{request.ItemType}</td>
                              <td className="p-3">{request.Quantity}</td>
                              <td className="p-3">
                                {request.Warehouse_Name}
                              </td>
                              <td className="p-3">
                                {request.DateIssued
                                  ? new Date(
                                      request.DateIssued
                                    ).toLocaleDateString()
                                  : "-"}
                              </td>
                              <td className="p-3">{request.Status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Procurement - Goods Received */}
          {activeDepartment === "Procurement" &&
            activeSection === "Goods Received" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {goodsReceivedLoading ? (
                  <p className="col-span-full p-8 text-center text-sm text-[#587176]">
                    Loading goods received records...
                  </p>
                ) : goodsReceivedError ? (
                  <p className="col-span-full p-8 text-center text-sm text-red-600">
                    {goodsReceivedError}
                  </p>
                ) : goodsReceived.length === 0 ? (
                  <p className="col-span-full p-8 text-center text-sm text-[#587176]">
                    No goods received records available.
                  </p>
                ) : (
                  goodsReceived.map((record) => (
                    <div
                      key={record.GR_ID}
                      className="rounded-xl border border-[#DCE7EA] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-[#587176]">
                            Goods Received
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-[#1F3338]">
                            GR #{record.GR_ID}
                          </h3>
                        </div>

                        <span className="rounded-full bg-[#F2F7F8] px-3 py-1.5 text-xs font-semibold text-[#365f68]">
                          {getInspectionStatusLabel(record)}
                        </span>
                      </div>

                      {/* Main Information */}
                      <div className="mt-5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-[#587176]">
                            Supplier
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#1F3338]">
                            {record.SupplierName}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#587176]">
                            Purchase Order
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#1F3338]">
                            PO #{record.PO_ID}
                          </p>
                        </div>
                      </div>

                      {/* Quantity Information */}
                      <div className="mt-5 rounded-xl bg-[#F2F7F8] p-4">
                        <p className="text-xs font-medium text-[#587176]">
                          Delivered Quantity
                        </p>

                        <p className="mt-1 text-3xl font-bold text-[#365f68]">
                          {record.DeliveredQuantity}
                        </p>
                      </div>

                      {/* Received Date */}
                      <div className="mt-4 flex items-center justify-between border-t border-[#DCE7EA] pt-4">
                        <p className="text-xs text-[#587176]">
                          Received Date
                        </p>

                        <p className="text-sm font-medium text-[#1F3338]">
                          {record.ReceivedDate
                            ? new Date(
                                record.ReceivedDate
                              ).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>

                      {/* Inspection Form */}
                      <div className="mt-5 space-y-4 border-t border-[#DCE7EA] pt-5">

                        {/* Accepted Quantity */}
                        <div>
                          <label className="text-xs font-semibold text-[#587176]">
                            Accepted Quantity
                          </label>

                          <input
                            type="number"
                            disabled={isInspectionCompleted(record)}
                            min="0"
                            max={record.DeliveredQuantity}
                            value={
                              inspectionInputs[record.GR_ID]
                                ?.acceptedQuantity ??
                              (record.AcceptedQuantity !== null &&
                              record.AcceptedQuantity !== undefined
                                ? String(record.AcceptedQuantity)
                                : "")
                            }
                            onChange={(e) =>
                              setInspectionInputs((prev) => ({
                                ...prev,
                                [record.GR_ID]: {
                                  acceptedQuantity: e.target.value,
                                  remarks:
                                    prev[record.GR_ID]?.remarks ?? "",
                                },
                              }))
                            }
                            placeholder="Enter accepted quantity"
                            className="mt-1 w-full rounded-lg border border-[#DCE7EA] px-3 py-2.5 text-sm text-[#1F3338] outline-none focus:border-[#668d98] disabled:cursor-not-allowed disabled:bg-[#F2F7F8] disabled:opacity-70"
                          />
                        </div>

                        {/* Calculated Inspection Details */}
                        {getInspectionDetails(record).isValid && (
                          <div className="space-y-2 rounded-lg bg-[#F2F7F8] p-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-[#587176]">
                                Damaged Quantity
                              </span>
                              <span className="font-semibold text-[#1F3338]">
                                {getInspectionDetails(record).damagedQuantity}
                              </span>
                            </div>

                            <div className="flex justify-between text-sm">
                              <span className="text-[#587176]">
                                Item Condition
                              </span>
                              <span className="font-semibold text-[#365f68]">
                                {getInspectionDetails(record).itemCondition}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Remarks */}
                        <div>
                          <label className="text-xs font-semibold text-[#587176]">
                            Inspection Remarks
                          </label>

                          <textarea
                            disabled={isInspectionCompleted(record)}
                            value={
                              inspectionInputs[record.GR_ID]?.remarks ??
                              record.Remarks ??
                              ""
                            }
                            onChange={(e) =>
                              setInspectionInputs((prev) => ({
                                ...prev,
                                [record.GR_ID]: {
                                  acceptedQuantity:
                                    prev[record.GR_ID]?.acceptedQuantity ??
                                    "",
                                  remarks: e.target.value,
                                },
                              }))
                            }
                            placeholder="Enter inspection remarks..."
                            rows={2}
                            className="mt-1 w-full resize-none rounded-lg border border-[#DCE7EA] px-3 py-2.5 text-sm text-[#1F3338] outline-none focus:border-[#668d98] disabled:cursor-not-allowed disabled:bg-[#F2F7F8] disabled:opacity-70"
                          />
                        </div>

                        {/* Confirm Stock */}
                        <button
                          type="button"
                          onClick={() => handleConfirmStock(record)}
                          disabled={
                            isInspectionCompleted(record) ||
                            !getInspectionDetails(record).isValid ||
                            confirmingGR === record.GR_ID
                          }
                          className="w-full rounded-lg bg-[#365f68] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#24363B] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {confirmingGR === record.GR_ID
                            ? "Processing..."
                            : "Confirm Stock"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          {/* Procurement - Purchase Orders */}
          {activeDepartment === "Procurement" &&
            activeSection === "Purchase Orders" && (
              <div className="overflow-x-auto rounded-xl border border-[#DCE7EA]">
                {purchaseOrdersLoading ? (
                  <p className="p-8 text-center text-sm text-[#587176]">
                    Loading purchase orders...
                  </p>
                ) : purchaseOrdersError ? (
                  <p className="p-8 text-center text-sm text-red-600">
                    {purchaseOrdersError}
                  </p>
                ) : purchaseOrders.length === 0 ? (
                  <p className="p-8 text-center text-sm text-[#587176]">
                    No purchase orders available.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F2F7F8] text-[#365f68]">
                      <tr>
                        <th className="p-3">PO ID</th>
                        <th className="p-3">PR ID</th>
                        <th className="p-3">Supplier</th>
                        <th className="p-3">Quoted Amount</th>
                        <th className="p-3">Total Amount</th>
                        <th className="p-3">Delivery Terms</th>
                        <th className="p-3">Order Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {purchaseOrders.map((order) => (
                        <tr
                          key={order.PO_ID}
                          className="border-t border-[#DCE7EA] text-[#1F3338]"
                        >
                          <td className="p-3">{order.PO_ID}</td>
                          <td className="p-3">{order.PR_ID}</td>
                          <td className="p-3">{order.SupplierName}</td>
                          <td className="p-3">
                            ₱{Number(order.QuotedAmount).toLocaleString()}
                          </td>
                          <td className="p-3">
                            ₱{Number(order.Total_Amount).toLocaleString()}
                          </td>
                          <td className="p-3">{order.DeliveryTerms}</td>
                          <td className="p-3">
                            {order.OrderDate
                              ? new Date(
                                  order.OrderDate
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          {/* Other Sections */}
          {activeDepartment !== "Upcoming Requests" &&
            !(
              activeDepartment === "Procurement" &&
              (
                activeSection === "Purchase Requests" ||
                activeSection === "Purchase Orders" ||
                activeSection === "Goods Received"
              )
            ) && (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl bg-[#F2F7F8] p-8 text-center">
                <h3 className="font-bold text-[#1F3338]">
                  {activeSection}
                </h3>
                <p className="mt-2 text-sm text-[#587176]">
                  No records available.
                </p>
              </div>
            )}

        </div>
      </div>
    </DashboardLayout>
  );
}
