"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type MaterialRequirement = {
  PM_ID: number;
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  unit_of_measure: string;
  MaterialRequired: number;
};

type Product = {
  PM_ID: number;
  Product_Name: string;
  SKU: string;
};

type BatchMaterial = {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  unit_of_measure: string;
  QuantityPerProduct: number;
  BatchQuantity: number;
};

type ProductionRequest = {
  RR_ID: number;
  productionID: number | null;
  PM_ID: number;
  SKU: string;
  Item_Name: string;
  WH_ID: number;
  quantity: number | null;
  productCost: number | null;
  status: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type RequestedMaterial = {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  unit_of_measure: string;
  QuantityRequested: number;
};

type MaterialRequest = {
  MR_ID: number;
  productionID: number;
  DateRequested: string;
  RequiredDate: string;
  Status: "Pending" | "Released" | "Received";
  ReleasedBy?: string | null;
  ReleasedAt?: string | null;
  ReceivedBy?: string | null;
  ReceivedAt?: string | null;
  SKU: string;
  Item_Name: string;
  quantity: number;
  materials: RequestedMaterial[];
};

function formatQuantity(value: number) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export default function RequestsPage() {
  const [activeFunction, setActiveFunction] = useState(
    "production-replenishment"
  );

  // BOM reference
  const [selectedPM, setSelectedPM] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<MaterialRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Replenishment requests
  const [productionRequests, setProductionRequests] = useState<
    ProductionRequest[]
  >([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [requestRefreshKey, setRequestRefreshKey] = useState(0);
  const [processingID, setProcessingID] = useState<number | null>(null);
  const [requestMessage, setRequestMessage] = useState("");

  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false);
  const [selectedRequestID, setSelectedRequestID] = useState<number | null>(null);

  // Expandable batch requirements
  const [expandedRequestID, setExpandedRequestID] = useState<number | null>(
    null
  );
  const [batchMaterials, setBatchMaterials] = useState<
    Record<number, BatchMaterial[]>
  >({});
  const [batchLoadingID, setBatchLoadingID] = useState<number | null>(null);
  const [batchError, setBatchError] = useState("");

  // MATERIAL REQUEST SUBMISSION
  const [showMaterialRequestModal, setShowMaterialRequestModal] =
    useState(false);
  const [selectedProductionID, setSelectedProductionID] =
    useState<number | null>(null);
  const [requiredDate, setRequiredDate] = useState("");
  const [submittingMaterialID, setSubmittingMaterialID] =
    useState<number | null>(null);

  // MATERIAL ISSUANCE
  const [materialQueue, setMaterialQueue] = useState<MaterialRequest[]>([]);
  const [materialHistory, setMaterialHistory] = useState<MaterialRequest[]>([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialError, setMaterialError] = useState("");
  const [materialRefreshKey, setMaterialRefreshKey] = useState(0);
  const [expandedMaterialID, setExpandedMaterialID] = useState<number | null>(
    null
  );
  const [receivingID, setReceivingID] = useState<number | null>(null);
  const [receiptMessage, setReceiptMessage] = useState("");

  // SEPARATE PENDING AND ACCEPTED REQUESTS
const pendingRequests = productionRequests
  .filter((request) => request.status?.toLowerCase() === "pending")
  .sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

const acceptedRequests = productionRequests.filter(
  (request): request is ProductionRequest & { productionID: number } =>
    request.status?.toLowerCase() === "accepted" &&
    request.productionID !== null
);

useEffect(() => {
  const fetchProducts = async () => {
    try {
      const response = await fetch(
        `${API_URL}/products/active`
      );

      if (!response.ok) {
        throw new Error("Failed to retrieve active products.");
      }

      const data: Product[] = await response.json();

      setProducts(data);

      if (data.length > 0) {
        setSelectedPM(data[0].PM_ID);
      }
    } catch (error) {
      console.error("Product retrieval error:", error);
    }
  };

  fetchProducts();
}, []);

  // FETCH BOM REFERENCE
  useEffect(() => {
    if (activeFunction !== "material-requirement") return;

    const fetchMaterials = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/requests/material-requirements/?pm_id=${selectedPM}`
        );

        if (!response.ok) {
          throw new Error("Failed to retrieve material requirements.");
        }

        const data: MaterialRequirement[] = await response.json();
        setMaterials(data);
      } catch (error) {
        console.error(error);
        setError("Unable to load material requirements.");
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, [activeFunction, selectedPM, refreshKey]);

  // FETCH INVENTORY REPLENISHMENT REQUESTS
  useEffect(() => {
    if (activeFunction !== "production-replenishment") return;

    const fetchRequests = async () => {
      setRequestsLoading(true);
      setRequestsError("");

      try {
        const response = await fetch(
          `${API_URL}/requests/production-requests/`
        );

        if (!response.ok) {
          throw new Error("Failed to retrieve production requests.");
        }

        const data: ProductionRequest[] = await response.json();
        setProductionRequests(data);
      } catch (error) {
        console.error(error);
        setRequestsError("Unable to load production requests.");
      } finally {
        setRequestsLoading(false);
      }
    };

    fetchRequests();
  }, [activeFunction, requestRefreshKey]);

  // FETCH MATERIAL ISSUANCE QUEUE AND HISTORY
useEffect(() => {
  if (activeFunction !== "material-issuance") return;

  const fetchMaterialRequests = async () => {
    setMaterialLoading(true);
    setMaterialError("");

    try {
      const [queueResponse, historyResponse] = await Promise.all([
        fetch(`${API_URL}/requests/material-requests/queue/`),
        fetch(`${API_URL}/requests/material-requests/history/`),
      ]);

      if (!queueResponse.ok || !historyResponse.ok) {
        throw new Error("Failed to retrieve material requests.");
      }

      const queueData: MaterialRequest[] = await queueResponse.json();
      const historyData: MaterialRequest[] = await historyResponse.json();

      setMaterialQueue(queueData);
      setMaterialHistory(historyData);
    } catch (error) {
      console.error(error);
      setMaterialError("Unable to load material requests.");
    } finally {
      setMaterialLoading(false);
    }
  };

  fetchMaterialRequests();
}, [activeFunction, materialRefreshKey]);

  // EXPAND AN ACCEPTED REQUEST AND LOAD ITS BATCH MATERIALS
  const toggleBatchDetails = async (
  request: ProductionRequest & { productionID: number }) => {
    const requestID = request.productionID;

    if (expandedRequestID === requestID) {
      setExpandedRequestID(null);
      setBatchError("");
      return;
    }

    setExpandedRequestID(requestID);
    setBatchError("");

    // Use previously loaded details if available.
    if (batchMaterials[requestID]) {
      return;
    }

    setBatchLoadingID(requestID);

    try {
      const response = await fetch(
        `${API_URL}/requests/production-requests/${requestID}/material-requirements/`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to calculate batch requirements."
        );
      }

      setBatchMaterials((current) => ({
        ...current,
        [requestID]: data,
      }));
    } catch (error) {
      console.error(error);
      setBatchError(
        error instanceof Error
          ? error.message
          : "Unable to load batch requirements."
      );
    } finally {
      setBatchLoadingID(null);
    }
  };

  // EXPAND OR COLLAPSE MATERIAL REQUEST DETAILS
  const toggleMaterialDetails = (mrID: number) => {
    setExpandedMaterialID((current) =>
      current === mrID ? null : mrID
    );
  };

  // CONFIRM MATERIAL RECEIPT
  const handleConfirmReceipt = async (mrID: number) => {
    setReceivingID(mrID);
    setReceiptMessage("");
    setMaterialError("");

    try {
      const response = await fetch(
        `${API_URL}/requests/material-requests/${mrID}/confirm-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ReceivedBy: "Production Department",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to confirm material receipt."
        );
      }

      setReceiptMessage(
        `Material Request #${mrID} received successfully.`
      );

      setMaterialRefreshKey((current) => current + 1);
    } catch (error) {
      console.error(error);
      setMaterialError(
        error instanceof Error
          ? error.message
          : "Unable to confirm material receipt."
      );
    } finally {
      setReceivingID(null);
    }
  };

  // SUBMIT MATERIAL REQUEST
  const handleSubmitMaterialRequest = async () => {
    if (selectedProductionID === null || !requiredDate) return;

    setSubmittingMaterialID(selectedProductionID);
    setRequestsError("");
    setRequestMessage("");

    try {
      const response = await fetch(
        `${API_URL}/requests/material-requests/${selectedProductionID}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            RequiredDate: requiredDate,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to submit Material Request."
        );
      }

      setRequestMessage(
        `Material Request #${data.MR_ID} submitted successfully for Production #${selectedProductionID}.`
      );

      setMaterialRefreshKey((current) => current + 1);

      setShowMaterialRequestModal(false);
      setSelectedProductionID(null);
      setRequiredDate("");
    } catch (error) {
      console.error(error);
      setRequestsError(
        error instanceof Error
          ? error.message
          : "Unable to submit Material Request."
      );
    } finally {
      setSubmittingMaterialID(null);
    }
  };

  // ACCEPT A REPLENISHMENT REQUEST

  const handleRequestAction = async (rrID: number): Promise<boolean> => {
    setProcessingID(rrID);
    setRequestMessage("");
    setRequestsError("");

    try {
      const response = await fetch(
        `${API_URL}/requests/production-requests/${rrID}/accept`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to accept production request."
        );
      }

      setRequestMessage(
        `Restock Request #${rrID} accepted successfully.`
      );
      setRequestRefreshKey((current) => current + 1);
      return true;

    } catch (error) {
      console.error(error);
      setRequestsError(
        error instanceof Error
          ? error.message
          : "Unable to accept production request."
      );
      return false;
    } finally {
      setProcessingID(null);
    }
  };

  // CONFIRM ACCEPTANCE FROM CUSTOM MODAL
  const confirmAcceptRequest = async () => {
  if (selectedRequestID === null) return;

  const accepted = await handleRequestAction(selectedRequestID);

  if (accepted) {
    setShowAcceptConfirmation(false);
    setSelectedRequestID(null);
  }
};


  // REUSABLE EXPANDED MATERIAL DETAILS
  const renderBatchDetails = (
  request: ProductionRequest & { productionID: number }) => {
    const requestID = request.productionID;

    if (expandedRequestID !== requestID) return null;
    const batch = batchMaterials[requestID];

    return (
      <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap justify-between gap-2">
          <div>
            <h4 className="font-semibold text-gray-800">
              Batch Material Requirements
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              BOM quantities multiplied by the approved production quantity.
            </p>
          </div>

          <span className="text-xs font-semibold text-[#365f68]">
            {request.quantity ?? 0} units to produce
          </span>
        </div>

        {batchLoadingID === requestID ? (
          <p className="p-6 text-center text-sm text-gray-500">
            Calculating batch material requirements...
          </p>
        ) : batchError ? (
          <p className="p-4 text-sm text-red-600">{batchError}</p>
        ) : batch && batch.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 border-b">
                  <tr>
                    <th className="p-3">Material SKU</th>
                    <th className="p-3">Material Name</th>
                    <th className="p-3">Per Product</th>
                    <th className="p-3">Batch Required</th>
                    <th className="p-3">Unit</th>
                  </tr>
                </thead>

                <tbody>
                  {batch.map((material) => (
                    <tr
                      key={material.IM_ID}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="p-3 font-medium">{material.SKU}</td>
                      <td className="p-3">{material.Item_Name}</td>
                      <td className="p-3">
                        {formatQuantity(material.QuantityPerProduct)}
                      </td>
                      <td className="p-3 font-bold text-[#365f68]">
                        {formatQuantity(material.BatchQuantity)}
                      </td>
                      <td className="p-3">
                        {material.unit_of_measure}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-[#f5f8f8] border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-800">
                Material Request Preview
              </p>
              <p className="text-xs text-gray-500 mt-1">
                These are the total materials Production needs to request
                from Inventory for this batch.
              </p>
              <p className="text-xs text-amber-700 mt-3">
                Preview only — submission will be enabled after the shared
                Material Request database structure is agreed with Inventory.
              </p>
            </div>
          </>
        ) : (
          <p className="p-6 text-center text-sm text-gray-500">
            No BOM materials found for this product.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 space-y-6">

      
      {/* REQUEST WORKFLOW TABS */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {[
          "Product Replenishment",
          "Material Issuance",
          "Material Requirements",
        ].map((tab) => {
          const tabValue =
            tab === "Product Replenishment"
              ? "production-replenishment"
              : tab === "Material Issuance"
              ? "material-issuance"
              : "material-requirement";

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFunction(tabValue)}
              className={`px-5 py-3 text-sm font-medium rounded-t-lg transition ${
                activeFunction === tabValue
                  ? "bg-[#365f68] text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>


      <div className="bg-white border border-gray-200 rounded-xl p-6">

        {/* MATERIAL REQUIREMENTS */}
        {activeFunction === "material-requirement" && (
          <div className="space-y-8">

            {/* ORIGINAL BOM REFERENCE */}
            <section>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    BOM Reference
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Original material quantities required per product.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={selectedPM}
                    onChange={(event) =>
                      setSelectedPM(Number(event.target.value))
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
                  >
                    {products.map((product) => (
                      <option key={product.PM_ID} value={product.PM_ID}>
                        {product.Product_Name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setRefreshKey((current) => current + 1)}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    Refresh BOM
                  </button>
                </div>
              </div>

              {loading ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  Loading BOM...
                </p>
              ) : error ? (
                <p className="py-6 text-center text-sm text-red-600">
                  {error}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-3">Material SKU</th>
                        <th className="p-3">Material Name</th>
                        <th className="p-3">Quantity per Product</th>
                        <th className="p-3">Unit</th>
                      </tr>
                    </thead>

                    <tbody>
                      {materials.length > 0 ? (
                        materials.map((material) => (
                          <tr
                            key={material.IM_ID}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="p-3">{material.SKU}</td>
                            <td className="p-3">{material.Item_Name}</td>
                            <td className="p-3 font-semibold">
                              {formatQuantity(material.MaterialRequired)}
                            </td>
                            <td className="p-3">
                              {material.unit_of_measure}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-8 text-center text-gray-500"
                          >
                            No material requirements found for this product.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* PRODUCTION REPLENISHMENT */}
        {activeFunction === "production-replenishment" && (
          <section>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Product Replenishment Requests
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review requests sent by Inventory before accepting production.
                </p>
              </div>

              <button
                onClick={() =>
                  setRequestRefreshKey((current) => current + 1)
                }
                className="px-4 py-2 text-sm rounded-lg bg-[#365f68] text-white hover:bg-[#294b53]"
              >
                Refresh
              </button>
            </div>

            {requestMessage && (
              <p className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                {requestMessage}
              </p>
            )}
    
            {requestsLoading ? (
              <p className="py-6 text-center text-sm text-gray-500">
                Loading production requests...
              </p>
            ) : requestsError ? (
              <p className="py-6 text-center text-sm text-red-600">
                {requestsError}
              </p>
            ) : (
              <div className="space-y-8">

                {/* PENDING PRODUCTION REQUESTS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      Pending Production Requests
                    </h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-800">
                      {pendingRequests.length} Pending
                    </span>
                  </div>

                  {pendingRequests.length > 0 ? (
                    pendingRequests.map((request) => {

                      return (
                        <div
                          key={request.RR_ID}
                          className="border border-yellow-200 rounded-xl overflow-hidden bg-white"
                        >
                          <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-gray-800">
                                #{request.RR_ID} — {request.Item_Name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {request.SKU} · WH-{request.WH_ID} ·{" "}
                                {request.quantity ?? "N/A"} units
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Created: {new Date(request.created_at).toLocaleString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs px-3 py-1 rounded-full border bg-yellow-100 text-yellow-800 border-yellow-200">
                                Pending
                              </span>

                              <button
                                onClick={() => {
                                  setSelectedRequestID(request.RR_ID);
                                  setShowAcceptConfirmation(true);
                                }}
                                disabled={processingID === request.RR_ID}
                                className="px-4 py-2 rounded-lg bg-[#365f68] text-white text-xs font-semibold hover:bg-[#294b53] disabled:opacity-50"
                              >
                                {processingID === request.RR_ID ? "Processing..." : "Accept"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <p className="text-sm text-gray-500">
                        No pending production requests.
                      </p>
                    </div>
                  )}
                </div>

                {/* ACCEPTED PRODUCTION REQUESTS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      Accepted Production Requests
                    </h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
                      {acceptedRequests.length} Accepted
                    </span>
                  </div>

                  {acceptedRequests.length > 0 ? (
                    acceptedRequests.map((request) => (
                      <div
                        key={request.productionID}
                        className="border border-green-200 rounded-xl overflow-hidden bg-white"
                      >
                        <div className="p-4 flex flex-col gap-4">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-800">
                                #{request.productionID} — {request.Item_Name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {request.SKU} · WH-{request.WH_ID} ·{" "}
                                {request.quantity ?? "N/A"} units
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                Created: {new Date(request.created_at).toLocaleString()}
                              </p>
                            </div>

                            <span className="text-xs px-3 py-1 rounded-full border bg-green-100 text-green-700 border-green-200">
                              Accepted
                            </span>
                          </div>

                          <div className="border-t border-gray-100 pt-3 flex flex-col gap-3">
                            <button
                              onClick={() => toggleBatchDetails(request)}
                              className="text-sm font-semibold text-[#365f68] hover:underline text-left"
                            >
                              {expandedRequestID === request.productionID
                                ? "Hide material details"
                                : "Show material details"}
                            </button>

                            {renderBatchDetails(request)}

                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  setSelectedProductionID(request.productionID);
                                  setRequiredDate("");
                                  setRequestsError("");
                                  setRequestMessage("");
                                  setShowMaterialRequestModal(true);
                                }}
                                className="px-4 py-2 rounded-lg bg-[#365f68] text-white text-xs font-semibold hover:bg-[#294b53]"
                              >
                                Request Materials
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <p className="text-sm text-gray-500">
                        No accepted production requests yet.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

          </section>
        )}

        {/* MATERIAL ISSUANCE */}
        {activeFunction === "material-issuance" && (
          <div className="space-y-8">
            {receiptMessage && (
              <p className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                {receiptMessage}
              </p>
            )}

            {/* MATERIAL REQUEST QUEUE */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Material Request Queue
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Pending material requests awaiting Inventory release.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setMaterialRefreshKey((current) => current + 1)
                  }
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              {materialLoading ? (
                <p className="text-sm text-gray-500">
                  Loading material requests...
                </p>
              ) : materialError ? (
                <p className="text-sm text-red-600">{materialError}</p>
              ) : materialQueue.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No pending material requests.
                </p>
              ) : (
                <div className="space-y-3">
                {materialQueue.map((request) => (
                  <div
                    key={request.MR_ID}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          MR #{request.MR_ID} — Production #{request.productionID}
                        </h3>

                        <p className="text-sm text-gray-600 mt-1">
                          {request.SKU} — {request.Item_Name}
                        </p>

                        <p className="text-sm text-gray-500 mt-1">
                          Quantity: {formatQuantity(request.quantity)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-medium px-3 py-1 rounded-full bg-yellow-50 text-yellow-700">
                          {request.Status}
                        </span>

                        <button
                          onClick={() => toggleMaterialDetails(request.MR_ID)}
                          className="block text-sm text-blue-600 hover:underline mt-3 ml-auto"
                        >
                          {expandedMaterialID === request.MR_ID
                            ? "Hide Materials"
                            : "View Materials"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <p className="text-gray-500">
                        Date Requested:{" "}
                        <span className="text-gray-700">
                          {new Date(request.DateRequested).toLocaleDateString()}
                        </span>
                      </p>

                      <p className="text-gray-500">
                        Required Date:{" "}
                        <span className="text-gray-700">
                          {new Date(request.RequiredDate).toLocaleDateString()}
                        </span>
                      </p>
                    </div>

                    {expandedMaterialID === request.MR_ID && (
                      <div className="mt-4 border-t pt-4">
                        <h4 className="font-medium text-gray-800 mb-3">
                          Requested Materials
                        </h4>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600">
                              <tr>
                                <th className="p-2">SKU</th>
                                <th className="p-2">Material</th>
                                <th className="p-2">Quantity</th>
                                <th className="p-2">Unit</th>
                              </tr>
                            </thead>

                            <tbody>
                              {request.materials.map((material) => (
                                <tr key={material.IM_ID} className="border-t">
                                  <td className="p-2">{material.SKU}</td>
                                  <td className="p-2">{material.Item_Name}</td>
                                  <td className="p-2">
                                    {formatQuantity(material.QuantityRequested)}
                                  </td>
                                  <td className="p-2">
                                    {material.unit_of_measure}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </section>

            {/* MATERIAL REQUEST HISTORY */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-800">
                  Material Request History
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Released and received material requests.
                </p>
              </div>

              {materialLoading ? (
                <p className="text-sm text-gray-500">
                  Loading material history...
                </p>
              ) : materialHistory.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No material request history yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {materialHistory.map((request) => (
                    <div
                      key={request.MR_ID}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            MR #{request.MR_ID} — Production #{request.productionID}
                          </h3>

                          <p className="text-sm text-gray-600 mt-1">
                            {request.SKU} — {request.Item_Name}
                          </p>

                          <p className="text-sm text-gray-500 mt-1">
                            Quantity: {formatQuantity(request.quantity)}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xs font-medium px-3 py-1 rounded-full ${
                              request.Status === "Received"
                                ? "bg-green-50 text-green-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {request.Status}
                          </span>

                          <button
                            onClick={() => toggleMaterialDetails(request.MR_ID)}
                            className="block text-sm text-blue-600 hover:underline mt-3 ml-auto"
                          >
                            {expandedMaterialID === request.MR_ID
                              ? "Hide Materials"
                              : "View Materials"}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                        <p className="text-gray-500">
                          Date Requested:{" "}
                          <span className="text-gray-700">
                            {new Date(request.DateRequested).toLocaleDateString()}
                          </span>
                        </p>

                        <p className="text-gray-500">
                          Required Date:{" "}
                          <span className="text-gray-700">
                            {new Date(request.RequiredDate).toLocaleDateString()}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 text-sm space-y-1">
                        {request.ReleasedBy && (
                          <p className="text-gray-500">
                            Released By:{" "}
                            <span className="text-gray-700">{request.ReleasedBy}</span>
                          </p>
                        )}

                        {request.ReleasedAt && (
                          <p className="text-gray-500">
                            Released At:{" "}
                            <span className="text-gray-700">
                              {new Date(request.ReleasedAt).toLocaleString()}
                            </span>
                          </p>
                        )}

                        {request.ReceivedBy && (
                          <p className="text-gray-500">
                            Received By:{" "}
                            <span className="text-gray-700">{request.ReceivedBy}</span>
                          </p>
                        )}

                        {request.ReceivedAt && (
                          <p className="text-gray-500">
                            Received At:{" "}
                            <span className="text-gray-700">
                              {new Date(request.ReceivedAt).toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>

                      {expandedMaterialID === request.MR_ID && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-medium text-gray-800 mb-3">
                            Requested Materials
                          </h4>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                  <th className="p-2">SKU</th>
                                  <th className="p-2">Material</th>
                                  <th className="p-2">Quantity</th>
                                  <th className="p-2">Unit</th>
                                </tr>
                              </thead>

                              <tbody>
                                {request.materials.map((material) => (
                                  <tr key={material.IM_ID} className="border-t">
                                    <td className="p-2">{material.SKU}</td>
                                    <td className="p-2">{material.Item_Name}</td>
                                    <td className="p-2">
                                      {formatQuantity(material.QuantityRequested)}
                                    </td>
                                    <td className="p-2">
                                      {material.unit_of_measure}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {request.Status === "Released" && (
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => handleConfirmReceipt(request.MR_ID)}
                            disabled={receivingID === request.MR_ID}
                            className="px-4 py-2 rounded-lg bg-[#365f68] text-white text-xs font-semibold hover:bg-[#294b53] disabled:opacity-50"
                          >
                            {receivingID === request.MR_ID
                              ? "Confirming..."
                              : "Confirm Receipt"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

        {showMaterialRequestModal && selectedProductionID !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Submit Material Request
            </h2>

            <p className="text-sm text-gray-600 mt-3">
              Submit a BOM-based Material Request for Production Order
              <span className="font-semibold text-gray-800">
                {" "}#{selectedProductionID}
              </span>
              .
            </p>

            <div className="mt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required Date
              </label>

              <input
                type="date"
                value={requiredDate}
                onChange={(event) => setRequiredDate(event.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {requestsError && (
              <p className="mt-3 text-sm text-red-600">
                {requestsError}
              </p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMaterialRequestModal(false);
                  setSelectedProductionID(null);
                  setRequiredDate("");
                  setRequestsError("");
                }}
                disabled={submittingMaterialID !== null}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmitMaterialRequest}
                disabled={!requiredDate || submittingMaterialID !== null}
                className="px-4 py-2 rounded-lg bg-[#365f68] text-white text-sm font-semibold hover:bg-[#294b53] disabled:opacity-50"
              >
                {submittingMaterialID === selectedProductionID
                  ? "Submitting..."
                  : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

        {showAcceptConfirmation && selectedRequestID !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800">
              Confirm Acceptance
            </h2>

            <p className="text-sm text-gray-600 mt-3">
              Are you sure you want to accept Restock Request
              <span className="font-semibold text-gray-800">
                {" "}#{selectedRequestID}
              </span>
              ?
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAcceptConfirmation(false);
                  setSelectedRequestID(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                onClick={confirmAcceptRequest}
                disabled={processingID !== null}
                className="px-4 py-2 rounded-lg bg-[#365f68] text-white text-sm font-semibold hover:bg-[#294b53] disabled:opacity-50"
              >
                {processingID !== null ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}