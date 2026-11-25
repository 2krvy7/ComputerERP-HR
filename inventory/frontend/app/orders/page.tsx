
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
  ReceivedBy: string | null;
  ReceivedDate: string | null;
  ItemCondition: string | null;
  RequestedQuantity: number;
  QuantityReceived: number | null;
  Remarks: string | null;
  InspectionStatus: string;
};


type MaterialWarehouseStock = {
  WH_ID: number;
  Warehouse_Name: string;
  quantity_on_hand: number;
};

type RequestedMaterial = {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  QuantityRequested: number;
  total_available: number;
  missing_quantity: number;
  transfer_quantity: number;
  availability_status:
    | "Ready to Release"
    | "Transfer Required"
    | "Insufficient Stock";
  warehouses: MaterialWarehouseStock[];
};

type MaterialRequest = {
  MR_ID: number;
  productionID: number;
  DateRequested: string;
  RequiredDate: string;
  Status: string;
  materials: RequestedMaterial[];
};

type ReleasedMaterial = {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  QuantityRequested: number;
  ReleasedQuantity: number | null;
  ActualQuantity: number | null;
  WH_ID: number | null;
  Warehouse_Name: string | null;
  LogDate: string | null;
};

type MaterialRelease = {
  MR_ID: number;
  productionID: number;
  DateRequested: string;
  RequiredDate: string;
  Status: "Released" | "Received" | string;
  ReleasedBy: string | null;
  ReleasedAt: string | null;
  ReceivedBy: string | null;
  ReceivedAt: string | null;
  materials: ReleasedMaterial[];
};

type InspectionInput = {
  quantityReceived: string;
  itemCondition: "Good" | "Partial" | "Damaged" | "";
  remarks: string;
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
  const [goodsReceived, setGoodsReceived] = useState<GoodsReceived[]>([]);

  const [goodsReceivedLoading, setGoodsReceivedLoading] =
    useState(true);

  const [goodsReceivedError, setGoodsReceivedError] =
    useState("");

const [inspectionInputs, setInspectionInputs] = useState<
  Record<number, InspectionInput>
>({});


  // Material Requests
  const [materialRequests, setMaterialRequests] =
    useState<MaterialRequest[]>([]);

  const [materialRequestsLoading, setMaterialRequestsLoading] =
    useState(true);

  const [materialRequestsError, setMaterialRequestsError] =
    useState("");


  // Material Releases
  const [materialReleases, setMaterialReleases] =
    useState<MaterialRelease[]>([]);

  const [materialReleasesLoading, setMaterialReleasesLoading] =
    useState(true);

  const [materialReleasesError, setMaterialReleasesError] =
    useState("");

  const [releasingMR, setReleasingMR] =
    useState<number | null>(null);

  // Expanded rows
  const [expandedMR, setExpandedMR] = useState<number | null>(null);
  const [expandedRelease, setExpandedRelease] = useState<number | null>(null);



  // Inspection inputs

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


  // Fetch Production Material Requests
  useEffect(() => {
    const fetchMaterialRequests = async () => {
      try {
        const response = await apiFetch(
          "/orders/material-requests"
        );

        if (!response.ok) {
          const data = await response.json().catch(() => null);

          throw new Error(
            data?.detail || "Failed to load material requests."
          );
        }

        const data: MaterialRequest[] = await response.json();

        setMaterialRequests(data);
      } catch (error) {
        setMaterialRequestsError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setMaterialRequestsLoading(false);
      }
    };

    fetchMaterialRequests();
  }, []);


  // Fetch Material Releases
  useEffect(() => {
    const fetchMaterialReleases = async () => {
      try {
        const response = await apiFetch("/orders/material-releases");

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.detail || "Failed to load material release records."
          );
        }

        const data: MaterialRelease[] = await response.json();
        setMaterialReleases(data);
      } catch (error) {
        setMaterialReleasesError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setMaterialReleasesLoading(false);
      }
    };

    fetchMaterialReleases();
  }, []);


  // Release Production Material Request
  const handleReleaseMaterialRequest = async (request: MaterialRequest) => {
    const allMaterialsReady =
      request.materials.length > 0 &&
      request.materials.every(
        (material) =>
          material.availability_status === "Ready to Release"
      );

    if (!allMaterialsReady) {
      alert(
        "This request cannot be released yet. All materials must be Ready to Release."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to release all materials for Material Request #${request.MR_ID}?`
    );

    if (!confirmed) return;

    try {
      setReleasingMR(request.MR_ID);

      const response = await apiFetch(
        `/orders/material-requests/${request.MR_ID}/release`,
        {
          method: "POST",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || "Failed to release materials."
        );
      }

      alert(data?.message || "Materials released successfully.");

      // Refresh pending Material Requests.
      const requestsResponse = await apiFetch(
        "/orders/material-requests"
      );

      if (requestsResponse.ok) {
        setMaterialRequests(await requestsResponse.json());
      }

      // Refresh Material Release history.
      const releasesResponse = await apiFetch(
        "/orders/material-releases"
      );

      if (releasesResponse.ok) {
        setMaterialReleases(await releasesResponse.json());
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setReleasingMR(null);
    }
  };

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

      console.log("Selected item:", {
        STOCK_ID: item.STOCK_ID,
        IM_ID: item.IM_ID,
        Item_Name: item.Item_Name,
        ItemType: item.ItemType,
        quantity: quantity,
      });

      const response = await apiFetch("/orders/restock-requests",
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
  const updateInspectionInput = (
  grId: number,
  field: keyof InspectionInput,
  value: string
) => {
  setInspectionInputs((previous) => ({
    ...previous,
    [grId]: {
      quantityReceived: previous[grId]?.quantityReceived ?? "",
      itemCondition: previous[grId]?.itemCondition ?? "",
      remarks: previous[grId]?.remarks ?? "",
      [field]: value,
    },
  }));
};

  // Confirm Goods Received
  
const handleConfirmStock = async (record: GoodsReceived) => {
  const inspection = inspectionInputs[record.GR_ID];

  if (!inspection) {
    alert("Please complete the inspection details.");
    return;
  }

  const quantityReceived = Number(inspection.quantityReceived);

  if (
    inspection.quantityReceived.trim() === "" ||
    !Number.isInteger(quantityReceived) ||
    quantityReceived < 0 ||
    quantityReceived > record.RequestedQuantity
  ) {
    alert("Please enter a valid received quantity.");
    return;
  }

  if (!inspection.itemCondition) {
    alert("Please select the item condition.");
    return;
  }

  if (
    ["Partial", "Damaged"].includes(inspection.itemCondition) &&
    !inspection.remarks.trim()
  ) {
    alert("Remarks are required for Partial or Damaged items.");
    return;
  }

  try {
    setConfirmingGR(record.GR_ID);

    const response = await apiFetch(
      `/orders/goods-received/${record.GR_ID}/confirm-count`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity_received: quantityReceived,
          item_condition: inspection.itemCondition,
          remarks: inspection.remarks.trim() || null,
        }),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.detail || "Failed to confirm received stock.");
    }

    alert("Goods Received and stock confirmation completed successfully.");

    const refreshResponse = await apiFetch("/orders/goods-received");
    if (refreshResponse.ok) {
      setGoodsReceived(await refreshResponse.json());
    }

    const upcomingResponse = await apiFetch("/orders/upcoming-requests");
    if (upcomingResponse.ok) {
      setUpcomingRequests(await upcomingResponse.json());
    }

    setInspectionInputs((previous) => {
      const updated = { ...previous };
      delete updated[record.GR_ID];
      return updated;
    });
  } catch (error) {
    alert(
      error instanceof Error ? error.message : "Something went wrong."
    );
  } finally {
    setConfirmingGR(null);
  }
};

  const getInspectionStatusLabel = (record: GoodsReceived) => {
  return record.InspectionStatus;
  };

  const isInspectionCompleted = (record: GoodsReceived) => {
    return record.InspectionStatus === "Stock Confirmed";
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

          {/* Production - Material Requests */}
{activeDepartment === "Production" &&
  activeSection === "Material Requests" && (
    <div className="space-y-3">

      {materialRequestsLoading ? (
        <p className="p-6 text-center text-sm text-[#587176]">
          Loading Production material requests...
        </p>
      ) : materialRequestsError ? (
        <p className="p-6 text-center text-sm text-red-600">
          {materialRequestsError}
        </p>
      ) : materialRequests.length === 0 ? (
        <p className="p-6 text-center text-sm text-[#587176]">
          No pending material requests available.
        </p>
      ) : (
        materialRequests.map((request) => {
          const isExpanded = expandedMR === request.MR_ID;

          const allMaterialsReady =
            request.materials.length > 0 &&
            request.materials.every(
              (material) =>
                material.availability_status === "Ready to Release"
            );

          return (
            <div
              key={request.MR_ID}
              className="overflow-hidden rounded-xl border border-[#DCE7EA]"
            >
              {/* Compact Request Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4">

                <button
                  type="button"
                  onClick={() =>
                    setExpandedMR(
                      isExpanded ? null : request.MR_ID
                    )
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F7F8] text-[#365f68]">
                    {isExpanded ? "−" : "+"}
                  </span>

                  <div className="min-w-0">
                    <p className="font-bold text-[#1F3338]">
                      Material Request #{request.MR_ID}
                    </p>

                    <p className="mt-1 text-xs text-[#587176]">
                      Production Order #{request.productionID}
                      {" · "}
                      {request.materials.length} materials
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-[#587176]">
                      Required Date
                    </p>
                    <p className="text-sm font-medium text-[#1F3338]">
                      {new Date(
                        request.RequiredDate
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                    {request.Status}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      handleReleaseMaterialRequest(request);
                    }}
                    className="whitespace-nowrap rounded-lg bg-[#365f68] px-4 py-2 text-xs font-semibold text-white hover:bg-[#24363B] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {releasingMR === request.MR_ID
                      ? "Releasing..."
                      : "Release"}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-[#DCE7EA] bg-[#FAFCFC] p-4">

                  <div className="mb-3 flex flex-wrap gap-4 text-xs text-[#587176]">
                    <p>
                      <span className="font-semibold">Date Requested:</span>{" "}
                      {new Date(
                        request.DateRequested
                      ).toLocaleDateString()}
                    </p>

                    <p>
                      <span className="font-semibold">Required Date:</span>{" "}
                      {new Date(
                        request.RequiredDate
                      ).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Materials Table */}
                  <div className="overflow-x-auto rounded-lg border border-[#DCE7EA] bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F2F7F8] text-[#365f68]">
                        <tr>
                          <th className="p-3">Material</th>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Requested</th>
                          <th className="p-3">Total Available</th>
                          <th className="p-3">Missing</th>
                          <th className="p-3">Availability</th>
                        </tr>
                      </thead>

                      <tbody>
                        {request.materials.map((material) => (
                          <tr
                            key={material.IM_ID}
                            className="border-t border-[#DCE7EA] text-[#1F3338]"
                          >
                            <td className="p-3 font-medium">
                              {material.Item_Name}
                            </td>

                            <td className="p-3">
                              {material.SKU}
                            </td>

                            <td className="p-3">
                              {material.QuantityRequested}
                            </td>

                            <td className="p-3">
                              {material.total_available}
                            </td>

                            <td className="p-3">
                              {material.missing_quantity}
                            </td>

                            <td className="p-3">
                              <span
                                className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${
                                  material.availability_status ===
                                  "Ready to Release"
                                    ? "bg-green-100 text-green-700"
                                    : material.availability_status ===
                                      "Transfer Required"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                {material.availability_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Warehouse Details */}
                  <div className="mt-4">
                    <h4 className="mb-2 text-xs font-bold text-[#365f68]">
                      Warehouse Stock Details
                    </h4>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {request.materials.map((material) => (
                        <div
                          key={material.IM_ID}
                          className="rounded-lg border border-[#DCE7EA] bg-white p-3"
                        >
                          <p className="mb-2 text-xs font-semibold text-[#1F3338]">
                            {material.Item_Name}
                          </p>

                          {material.warehouses.map((warehouse) => (
                            <div
                              key={warehouse.WH_ID}
                              className="flex justify-between gap-2 py-1 text-xs"
                            >
                              <span className="text-[#587176]">
                                {warehouse.Warehouse_Name}
                              </span>

                              <span className="font-semibold text-[#1F3338]">
                                {warehouse.quantity_on_hand}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-[#587176]">
                    {allMaterialsReady
                      ? "All requested materials are ready for release."
                      : "Resolve stock shortages or transfer requirements before releasing."}
                  </p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  )}

          {/* Production - Material Release */}
          {activeDepartment === "Production" &&
            activeSection === "Material Release" && (
              <div className="space-y-5">
                {materialReleasesLoading ? (
                  <p className="p-8 text-center text-sm text-[#587176]">
                    Loading material release records...
                  </p>
                ) : materialReleasesError ? (
                  <p className="p-8 text-center text-sm text-red-600">
                    {materialReleasesError}
                  </p>
                ) : materialReleases.length === 0 ? (
                  <p className="p-8 text-center text-sm text-[#587176]">
                    No released material requests available.
                  </p>
                ) : (
                  materialReleases.map((request) => (
                    <div
                      key={request.MR_ID}
                      className="rounded-xl border border-[#DCE7EA] p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-[#1F3338]">
                            Material Request #{request.MR_ID}
                          </h3>
                          <p className="mt-1 text-sm text-[#587176]">
                            Production Order #{request.productionID}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            request.Status === "Received"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {request.Status}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs text-[#587176]">Released By</p>
                          <p className="mt-1 text-sm font-medium text-[#1F3338]">
                            {request.ReleasedBy ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#587176]">Release Date</p>
                          <p className="mt-1 text-sm font-medium text-[#1F3338]">
                            {request.ReleasedAt
                              ? new Date(request.ReleasedAt).toLocaleString()
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#587176]">Received By</p>
                          <p className="mt-1 text-sm font-medium text-[#1F3338]">
                            {request.ReceivedBy ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#587176]">Receipt Date</p>
                          <p className="mt-1 text-sm font-medium text-[#1F3338]">
                            {request.ReceivedAt
                              ? new Date(request.ReceivedAt).toLocaleString()
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 overflow-x-auto rounded-lg border border-[#DCE7EA]">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#F2F7F8] text-[#365f68]">
                            <tr>
                              <th className="p-3">Material</th>
                              <th className="p-3">SKU</th>
                              <th className="p-3">Requested</th>
                              <th className="p-3">Released</th>
                              <th className="p-3">Actual Received</th>
                              <th className="p-3">Warehouse</th>
                            </tr>
                          </thead>
                          <tbody>
                            {request.materials.map((material) => (
                              <tr
                                key={material.IM_ID}
                                className="border-t border-[#DCE7EA] text-[#1F3338]"
                              >
                                <td className="p-3 font-medium">
                                  {material.Item_Name}
                                </td>
                                <td className="p-3">{material.SKU}</td>
                                <td className="p-3">
                                  {material.QuantityRequested}
                                </td>
                                <td className="p-3">
                                  {material.ReleasedQuantity ?? "-"}
                                </td>
                                <td className="p-3">
                                  {material.ActualQuantity ?? "-"}
                                </td>
                                <td className="p-3">
                                  {material.Warehouse_Name ?? "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
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
<div className="mt-5 rounded-xl bg-[#F2F7F8] p-4 space-y-4">
  <div className="flex justify-between">
    <p className="text-xs text-[#587176]">Requested Quantity</p>
    <p className="text-sm font-semibold text-[#1F3338]">
      {record.RequestedQuantity}
    </p>
  </div>

  {!isInspectionCompleted(record) ? (
    <>
      <div>
        <label className="mb-2 block text-xs font-medium text-[#587176]">
          Quantity Received
        </label>
        <input
          type="number"
          min="0"
          max={record.RequestedQuantity}
          value={inspectionInputs[record.GR_ID]?.quantityReceived ?? ""}
          onChange={(e) =>
            updateInspectionInput(
              record.GR_ID,
              "quantityReceived",
              e.target.value
            )
          }
          className="w-full rounded-lg border border-[#DCE7EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#365f68]"
          placeholder="Enter quantity received"
        />
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-[#587176]">
          Item Condition
        </label>
        <select
          value={inspectionInputs[record.GR_ID]?.itemCondition ?? ""}
          onChange={(e) =>
            updateInspectionInput(
              record.GR_ID,
              "itemCondition",
              e.target.value
            )
          }
          className="w-full rounded-lg border border-[#DCE7EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#365f68]"
        >
          <option value="">Select condition</option>
          <option value="Good">Good</option>
          <option value="Partial">Partial</option>
          <option value="Damaged">Damaged</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-[#587176]">
          Remarks
        </label>
        <textarea
          value={inspectionInputs[record.GR_ID]?.remarks ?? ""}
          onChange={(e) =>
            updateInspectionInput(
              record.GR_ID,
              "remarks",
              e.target.value
            )
          }
          rows={3}
          className="w-full rounded-lg border border-[#DCE7EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#365f68]"
          placeholder="Enter remarks if necessary"
        />
      </div>
    </>
  ) : (
    <>
      <div className="flex justify-between">
        <p className="text-xs text-[#587176]">Quantity Received</p>
        <p className="text-sm font-semibold text-[#365f68]">
          {record.QuantityReceived ?? "-"}
        </p>
      </div>

      <div className="flex justify-between">
        <p className="text-xs text-[#587176]">Item Condition</p>
        <p className="text-sm font-semibold text-[#1F3338]">
          {record.ItemCondition ?? "-"}
        </p>
      </div>
    </>
  )}
</div>

                      {/* Confirm Stock */}
                      {!isInspectionCompleted(record) && (
                        <div className="mt-5 border-t border-[#DCE7EA] pt-5">
                          <button
                            type="button"
                            onClick={() => handleConfirmStock(record)}
                            disabled={confirmingGR === record.GR_ID}
                            className="w-full rounded-lg bg-[#365f68] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#24363B] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {confirmingGR === record.GR_ID
                              ? "Processing..."
                              : "Confirm Stock"}
                          </button>
                        </div>
                      )}

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
              ) &&
              !(
                activeDepartment === "Production" &&
                (
                  activeSection === "Material Requests" ||
                  activeSection === "Material Release"
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
