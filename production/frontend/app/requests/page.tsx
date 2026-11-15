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

type BatchMaterial = {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  unit_of_measure: string;
  QuantityPerProduct: number;
  BatchQuantity: number;
};

type ProductionRequest = {
  productionID: number;
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

function formatQuantity(value: number) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function statusStyle(status: string | null) {
  switch (status?.toLowerCase()) {
    case "accepted":
      return "bg-green-100 text-green-700 border-green-200";
    case "rejected":
      return "bg-red-100 text-red-700 border-red-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export default function RequestsPage() {
  const [activeFunction, setActiveFunction] = useState(
    "material-requirement"
  );

  // BOM reference
  const [selectedPM, setSelectedPM] = useState(1);
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

  // Expandable batch requirements
  const [expandedRequestID, setExpandedRequestID] = useState<number | null>(
    null
  );
  const [batchMaterials, setBatchMaterials] = useState<
    Record<number, BatchMaterial[]>
  >({});
  const [batchLoadingID, setBatchLoadingID] = useState<number | null>(null);
  const [batchError, setBatchError] = useState("");

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
    if (
      activeFunction !== "material-requirement" &&
      activeFunction !== "production-replenishment"
    ) {
      return;
    }

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

  // EXPAND AN ACCEPTED REQUEST AND LOAD ITS BATCH MATERIALS
  const toggleBatchDetails = async (request: ProductionRequest) => {
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

  // ACCEPT OR REJECT A REPLENISHMENT REQUEST
  const handleRequestAction = async (
    productionID: number,
    action: "accept" | "reject"
  ) => {
    const actionLabel = action === "accept" ? "accept" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} Production Request #${productionID}?`
    );

    if (!confirmed) return;

    setProcessingID(productionID);
    setRequestMessage("");
    setRequestsError("");

    try {
      const response = await fetch(
        `${API_URL}/requests/production-requests/${productionID}/${action}`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || `Failed to ${actionLabel} production request.`
        );
      }

      setRequestMessage(
        `Production Request #${productionID} ${actionLabel}ed successfully.`
      );

      setRequestRefreshKey((current) => current + 1);
    } catch (error) {
      console.error(error);

      setRequestsError(
        error instanceof Error
          ? error.message
          : `Unable to ${actionLabel} production request.`
      );
    } finally {
      setProcessingID(null);
    }
  };

  // REUSABLE EXPANDED MATERIAL DETAILS
  const renderBatchDetails = (request: ProductionRequest) => {
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

  const acceptedRequests = productionRequests.filter(
    (request) => request.status?.toLowerCase() === "accepted"
  );

  return (
    <div className="p-8 space-y-6">

      {/* FUNCTION SELECTOR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setActiveFunction("material-requirement")}
          className={`text-left p-5 rounded-xl border transition ${
            activeFunction === "material-requirement"
              ? "border-[#365f68] bg-[#eaf2f2]"
              : "border-gray-200 bg-white hover:bg-gray-50"
          }`}
        >
          <h2 className="font-semibold text-gray-800">
            Material Requirements
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            View materials required for accepted production batches.
          </p>
        </button>

        <button
          onClick={() => setActiveFunction("production-replenishment")}
          className={`text-left p-5 rounded-xl border transition ${
            activeFunction === "production-replenishment"
              ? "border-[#365f68] bg-[#eaf2f2]"
              : "border-gray-200 bg-white hover:bg-gray-50"
          }`}
        >
          <h2 className="font-semibold text-gray-800">
            Production Replenishment
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Review and accept or reject requests from Inventory.
          </p>
        </button>

        <button
          onClick={() => setActiveFunction("material-issuance")}
          className={`text-left p-5 rounded-xl border transition ${
            activeFunction === "material-issuance"
              ? "border-[#365f68] bg-[#eaf2f2]"
              : "border-gray-200 bg-white hover:bg-gray-50"
          }`}
        >
          <h2 className="font-semibold text-gray-800">
            Material Issuance
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Manage the release of raw materials to Production.
          </p>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">

        {/* MATERIAL REQUIREMENTS */}
        {activeFunction === "material-requirement" && (
          <div className="space-y-8">

            <section>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Accepted Production Requests
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Expand a request to view its calculated batch materials.
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

              {requestsLoading ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  Loading accepted requests...
                </p>
              ) : requestsError ? (
                <p className="py-6 text-center text-sm text-red-600">
                  {requestsError}
                </p>
              ) : acceptedRequests.length > 0 ? (
                <div className="space-y-3">
                  {acceptedRequests.map((request) => (
                    <div
                      key={request.productionID}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-[#eaf2f2] text-[#365f68]">
                            REQUEST
                          </span>
                          <div>
                            <p className="font-semibold text-gray-800">
                              #{request.productionID} — {request.Item_Name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {request.SKU} · WH-{request.WH_ID} ·{" "}
                              {request.quantity} units
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-3 py-1 rounded-full border font-medium ${statusStyle(
                              request.status
                            )}`}
                          >
                            Accepted
                          </span>

                          <button
                            onClick={() => toggleBatchDetails(request)}
                            className="text-sm font-semibold text-[#365f68] hover:underline"
                          >
                            {expandedRequestID === request.productionID
                              ? "Hide details"
                              : "Show details"}
                          </button>
                        </div>
                      </div>

                      {renderBatchDetails(request)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <p className="font-medium text-gray-600">
                    No accepted production requests yet.
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Accepted requests from Inventory will appear here.
                  </p>
                </div>
              )}
            </section>

            {/* ORIGINAL BOM REFERENCE */}
            <section className="border-t border-gray-200 pt-6">
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
                    <option value={1}>Gaming PC</option>
                    <option value={4}>Office PC</option>
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
                  Production Replenishment Requests
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
            ) : productionRequests.length > 0 ? (
              <div className="space-y-3">
                {productionRequests.map((request) => {
                  const isReviewed =
                    request.reviewed_by !== null &&
                    request.reviewed_at !== null;

                  const canReview =
                    request.status?.toLowerCase() === "pending" &&
                    isReviewed;

                  return (
                    <div
                      key={request.productionID}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-[#eaf2f2] text-[#365f68]">
                            REQUEST
                          </span>

                          <div>
                            <p className="font-semibold text-gray-800">
                              #{request.productionID} — {request.Item_Name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {request.SKU} · WH-{request.WH_ID} ·{" "}
                              {request.quantity ?? "N/A"} units
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Created:{" "}
                              {new Date(
                                request.created_at
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`text-xs px-3 py-1 rounded-full border font-medium ${statusStyle(
                              request.status
                            )}`}
                          >
                            {request.status || "Unknown"}
                          </span>

                          {canReview ? (
                            <>
                              <button
                                onClick={() =>
                                  handleRequestAction(
                                    request.productionID,
                                    "accept"
                                  )
                                }
                                disabled={processingID === request.productionID}
                                className="px-4 py-2 rounded-lg bg-[#365f68] text-white text-xs font-semibold hover:bg-[#294b53] disabled:opacity-50"
                              >
                                {processingID === request.productionID
                                  ? "Processing..."
                                  : "Accept"}
                              </button>

                              <button
                                onClick={() =>
                                  handleRequestAction(
                                    request.productionID,
                                    "reject"
                                  )
                                }
                                disabled={processingID === request.productionID}
                                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {request.status?.toLowerCase() === "accepted"
                                ? "Already accepted"
                                : request.status?.toLowerCase() === "rejected"
                                ? "Request rejected"
                                : "Awaiting Inventory review"}
                            </span>
                          )}
                        </div>
                      </div>

                      {request.status?.toLowerCase() === "accepted" && (
                        <div className="px-4 pb-4">
                          <button
                            onClick={() => toggleBatchDetails(request)}
                            className="text-sm font-semibold text-[#365f68] hover:underline"
                          >
                            {expandedRequestID === request.productionID
                              ? "Hide material details"
                              : "Show material details"}
                          </button>

                          {renderBatchDetails(request)}
                        </div>
                      )}

                      {request.status?.toLowerCase() === "pending" &&
                        !isReviewed && (
                          <div className="px-4 pb-3 text-xs text-gray-400">
                            Inventory must review this request before
                            Production can accept or reject it.
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="font-medium text-gray-600">
                  No production replenishment requests found.
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Requests from Inventory will appear here.
                </p>
              </div>
            )}
          </section>
        )}

        {/* MATERIAL ISSUANCE */}
        {activeFunction === "material-issuance" && (
          <div className="py-12 text-center">
            <h2 className="text-lg font-semibold text-gray-800">
              Material Issuance
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              This function is awaiting Inventory integration.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}