"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Product = {
  PM_ID: number;
  IM_ID: number;
  Product_Name: string;
  Manual: string | null;
  Availability: string;
  Status: string;
};

type InventoryItem = {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
  Description: string | null;
  Category: string | null;
  Brand: string | null;
};

type BOMItem = {
  BOM_ID: number;
  PM_ID: number;
  IM_ID: number;
  Material_Name: string;
  SKU: string;
  MaterialRequired: number;
  Unit: string;
};

type ProductionBatch = {
  Production_ID: number;
  PM_ID: number;
  WH_ID: number;
  Product_Name: string;
  SKU: string;
  QuantityRequired: number;
  QuantityProduced: number;
  StartDate: string | null;
  Deadline: string | null;
  status: "Pending" | "In Progress" | "Completed";
};


export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  const [bomItems, setBomItems] = useState<Record<number, BOMItem[]>>({});
  const [bomLoading, setBomLoading] = useState<number | null>(null);

  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>([]);
  const [productionLoading, setProductionLoading] = useState(true);

  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [openStatusMenu, setOpenStatusMenu] = useState<number | null>(null);

  const [editingQuantity, setEditingQuantity] = useState<ProductionBatch | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [savingQuantity, setSavingQuantity] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [selectedIMId, setSelectedIMId] = useState("");
  const [manual, setManual] = useState("");

  const [savingProduct, setSavingProduct] = useState(false);
  const [modalError, setModalError] = useState("");

  const [expandedProducts, setExpandedProducts] = useState<number[]>([]);
  const [expandedBOM, setExpandedBOM] = useState<number | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/products/`);

        if (!response.ok) {
          throw new Error("Failed to retrieve products.");
        }

        const data: Product[] = await response.json();
        setProducts(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);


  useEffect(() => {
    const fetchProductionBatches = async () => {
      try {
        setProductionLoading(true);

        const response = await fetch(
          `${API_URL}/production-orders/kanban`
        );

        if (!response.ok) {
          throw new Error("Failed to retrieve production batches.");
        }

        const data: ProductionBatch[] = await response.json();
        setProductionBatches(data);

      } catch (err) {
        console.error("Production batches fetch error:", err);
      } finally {
        setProductionLoading(false);
      }
    };

    fetchProductionBatches();
  }, []);


    useEffect(() => {
    if (!showAddProduct) return;

    const fetchInventoryItems = async () => {
      try {
        setInventoryLoading(true);
        setModalError("");

        const response = await fetch(
          `${API_URL}/products/inventory-items`
        );

        if (!response.ok) {
          throw new Error("Failed to retrieve finished products.");
        }

        const data: InventoryItem[] = await response.json();
        setInventoryItems(data);

      } catch (err) {
        setModalError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchInventoryItems();
  }, [showAddProduct]);

  const toggleProduct = (pmId: number) => {
  setExpandedProducts((prev) =>
    prev.includes(pmId)
      ? prev.filter((id) => id !== pmId)
      : [...prev, pmId]
  );
};
  
const handleUpdateStatus = async (
  productionId: number,
  newStatus: "In Progress" | "Completed"
) => {
  try {
    setUpdatingStatus(productionId);

    const response = await fetch(
      `${API_URL}/production-orders/${productionId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update production status.");
    }

    const updatedBatch = await response.json();

    setProductionBatches((prev) =>
      prev.map((batch) =>
        batch.Production_ID === productionId
          ? {
              ...batch,
              status: updatedBatch.status,
              StartDate: updatedBatch.StartDate,
              Deadline: updatedBatch.Deadline,
            }
          : batch
      )
    );

    setOpenStatusMenu(null);

  } catch (err) {
    alert(
      err instanceof Error ? err.message : "Something went wrong."
    );
  } finally {
    setUpdatingStatus(null);
  }
};

const handleUpdateQuantity = async () => {
  if (!editingQuantity || newQuantity === "") return;

  const quantity = Number(newQuantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    quantity > editingQuantity.QuantityRequired
  ) {
    alert("Enter a valid quantity within the required amount.");
    return;
  }

  try {
    setSavingQuantity(true);

    const response = await fetch(
      `${API_URL}/production-orders/${editingQuantity.Production_ID}/quantity`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_quantity: quantity,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update production quantity.");
    }

    const updatedBatch = await response.json();

    setProductionBatches((prev) =>
      prev.map((batch) =>
        batch.Production_ID === editingQuantity.Production_ID
          ? {
              ...batch,
              QuantityProduced: updatedBatch.QuantityProduced,
            }
          : batch
      )
    );

    setEditingQuantity(null);
    setNewQuantity("");

  } catch (err) {
    alert(
      err instanceof Error ? err.message : "Something went wrong."
    );
  } finally {
    setSavingQuantity(false);
  }
};

  const toggleBOM = async (pmId: number) => {
  // Close the BOM accordion if it is already open.
  if (expandedBOM === pmId) {
    setExpandedBOM(null);
    return;
  }

  // Open the selected BOM accordion.
  setExpandedBOM(pmId);

  // Don't fetch again if this product's BOM is already loaded.
  if (bomItems[pmId]) return;

  try {
    setBomLoading(pmId);

    const response = await fetch(`${API_URL}/products/${pmId}/bom`);

    if (!response.ok) {
      throw new Error("Failed to retrieve BOM details.");
    }

    const data: BOMItem[] = await response.json();

    setBomItems((prev) => ({
      ...prev,
      [pmId]: data,
    }));
  } catch (err) {
    console.error("BOM fetch error:", err);
  } finally {
    setBomLoading(null);
  }
};

    const handleSaveProduct = async () => {
    if (!selectedIMId) return;

    try {
      setSavingProduct(true);
      setModalError("");

      const response = await fetch(`${API_URL}/products/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          IM_ID: Number(selectedIMId),
          Manual: manual.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to register product.");
      }

      const productsResponse = await fetch(`${API_URL}/products/`);

      if (!productsResponse.ok) {
        throw new Error("Product saved, but the list could not refresh.");
      }

      const data: Product[] = await productsResponse.json();
      setProducts(data);

      setShowAddProduct(false);
      setSelectedIMId("");
      setManual("");

    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSavingProduct(false);
    }
  };

  return (
    <div className="p-6 space-y-6">

      {/* ERROR MESSAGE */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="text-center py-10 text-gray-400">
          Loading products...
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          No products found.
        </div>
      )}

      
      {/* PRODUCT MASTER LIST BOX */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">

        {/* BOX HEADER */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-700">
              Product Master List
            </h2>

            <p className="text-sm text-gray-500">
              {loading
                ? "Loading products..."
                : `${products.length} registered products`}
            </p>
          </div>

          <button
            onClick={() => setShowAddProduct(true)}
            className="bg-[#365f68] text-white px-4 py-2 rounded-lg hover:bg-[#294b53] transition"
          >
            + Add Product
          </button>
        </div>

        {/* PRODUCT ACCORDIONS */}
        <div className="space-y-3">
          {products.map((product) => {
            const isExpanded = expandedProducts.includes(product.PM_ID);
            const isUnavailable = product.Availability === "Unavailable";

            const cleanManual = product.Manual?.replace(
              /^\[RETIRED\]\s*/,
              ""
            );

            return (
              <div
                key={product.PM_ID}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >

                {/* PRODUCT HEADER */}
                <button
                  onClick={() => toggleProduct(product.PM_ID)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">

                    <span className="text-gray-400 text-lg">
                      {isExpanded ? "⌄" : "›"}
                    </span>

                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-800">
                        {product.Product_Name}
                      </h3>

                      <p className="text-xs text-gray-400 mt-1">
                        PM-{String(product.PM_ID).padStart(3, "0")}
                      </p>
                    </div>

                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 ${
                      isUnavailable
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {product.Availability}
                  </span>
                </button>

                {/* EXPANDED PRODUCT DETAILS */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 space-y-5">

                    {/* PRODUCT DETAILS */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 tracking-wider mb-3">
                        PRODUCT DETAILS
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">
                            Product Name
                          </p>

                          <p className="text-sm font-medium text-gray-700">
                            {product.Product_Name}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">
                            Inventory Item ID
                          </p>

                          <p className="text-sm font-medium text-gray-700">
                            {product.IM_ID}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2">
                          <p className="text-xs text-gray-400 mb-1">
                            Manual
                          </p>

                          <p className="text-sm text-gray-700">
                            {cleanManual || "—"}
                          </p>
                        </div>

                      </div>
                    </div>

                    {/* NESTED BOM ACCORDION */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">

                      <button
                        onClick={() => toggleBOM(product.PM_ID)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition text-left"
                      >
                        <div className="flex items-center gap-3">

                          <span className="text-gray-400">
                            {expandedBOM === product.PM_ID ? "⌄" : "›"}
                          </span>

                          <div>
                            <p className="text-sm font-semibold text-gray-700">
                              Bill of Materials
                            </p>

                            <p className="text-xs text-gray-400 mt-1">
                              View required raw materials and quantities
                            </p>
                          </div>

                        </div>

                        <span className="text-xs text-[#365f68] font-medium">
                          {expandedBOM === product.PM_ID ? "Hide" : "View BOM"}
                        </span>
                      </button>

                      {/* BOM MATERIALS */}
                      {expandedBOM === product.PM_ID && (
                        <div className="p-4 border-t border-gray-200">

                          {bomLoading === product.PM_ID ? (
                            <p className="text-center py-6 text-sm text-gray-400">
                              Loading BOM materials...
                            </p>
                          ) : bomItems[product.PM_ID]?.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                <thead>
                                  <tr className="text-xs text-gray-500 border-b border-gray-200">
                                    <th className="py-3 px-3 font-semibold">
                                      Material
                                    </th>
                                    <th className="py-3 px-3 font-semibold">
                                      SKU
                                    </th>
                                    <th className="py-3 px-3 font-semibold text-center">
                                      Required Quantity
                                    </th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {bomItems[product.PM_ID].map((item) => (
                                    <tr
                                      key={item.BOM_ID}
                                      className="border-b border-gray-100"
                                    >
                                      <td className="py-3 px-3 font-medium text-gray-700">
                                        {item.Material_Name}
                                      </td>

                                      <td className="py-3 px-3 text-gray-500">
                                        {item.SKU}
                                      </td>

                                      <td className="py-3 px-3 text-center text-gray-700">
                                        {item.MaterialRequired} {item.Unit}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-center py-6 text-sm text-gray-400">
                              No BOM materials have been defined for this product yet.
                            </p>
                          )}

                        </div>
                      )}

                    </div>

                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      
      {/* MANUFACTURING PROGRESS KANBAN */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-5">

        {/* BOARD HEADER */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700">
            Manufacturing Progress
          </h2>
          <p className="text-sm text-gray-500">
            Track the manufacturing progress of each production batch.
          </p>
        </div>

        {/* KANBAN COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {(["Pending", "In Progress", "Completed"] as const).map((status) => {
            const batches = productionBatches.filter(
              (batch) => batch.status === status
            );

            return (
              <div key={status} className="bg-gray-50 rounded-xl p-4 space-y-3">

                {/* COLUMN HEADER */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">
                    {status}
                  </h3>

                  <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-1 text-gray-600">
                    {batches.length}
                  </span>
                </div>

                {/* BATCH CARDS */}
                {productionLoading ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Loading batches...
                  </p>
                ) : batches.length > 0 ? (
                  batches.map((batch) => (
                    <div
                      key={batch.Production_ID}
                      className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#365f68]">
                          BATCH #{String(batch.Production_ID).padStart(3, "0")}
                        </span>

                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenStatusMenu(
                                openStatusMenu === batch.Production_ID
                                  ? null
                                  : batch.Production_ID
                              )
                            }
                            disabled={updatingStatus === batch.Production_ID}
                            className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100"
                          >
                            ⋮
                          </button>

                          {openStatusMenu === batch.Production_ID && (
                            <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">

                              {batch.status === "Pending" && (
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(batch.Production_ID, "In Progress")
                                  }
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Move to In Progress
                                </button>
                              )}

                              {batch.status === "In Progress" && (
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(batch.Production_ID, "Completed")
                                  }
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Mark as Completed
                                </button>
                              )}

                              {batch.status === "Completed" && (
                                <p className="px-3 py-2 text-xs text-gray-400">
                                  No further actions
                                </p>
                              )}

                            </div>
                          )}
                        </div>
                      </div>

                      <h4 className="font-semibold text-gray-800">
                        {batch.Product_Name}
                      </h4>

                      <p className="text-xs text-gray-400">
                        {batch.SKU}
                      </p>

                      <div className="text-sm text-gray-600 space-y-2">
                        <p>
                          Required: {batch.QuantityRequired} pcs
                        </p>

                        <p>
                          Produced: {batch.QuantityProduced} pcs
                        </p>

                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-[#668d98] h-2 rounded-full transition-all"
                            style={{
                              width: `${
                                batch.QuantityRequired > 0
                                  ? Math.min(
                                      (batch.QuantityProduced / batch.QuantityRequired) * 100,
                                      100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs text-gray-400">
                            {Math.round(
                              (batch.QuantityProduced / batch.QuantityRequired) * 100
                            ) || 0}% completed
                          </span>

                          <button
                            onClick={() => {
                              setEditingQuantity(batch);
                              setNewQuantity(String(batch.QuantityProduced));
                            }}
                            className="text-xs font-medium text-[#365f68] hover:underline"
                          >
                            Update Quantity
                          </button>
                        </div>
                      </div>

                      {batch.status !== "Pending" && (
                        <div className="border-t border-gray-100 pt-2 text-xs text-gray-500 space-y-1">
                          <p>
                            Started: {batch.StartDate
                              ? new Date(batch.StartDate).toLocaleDateString()
                              : "—"}
                          </p>
                          <p>
                            Deadline: {batch.Deadline
                              ? new Date(batch.Deadline).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No batches in this status.
                  </p>
                )}

              </div>
            );
          })}

        </div>
      </div>

      {/* UPDATE PRODUCTION QUANTITY MODAL */}
      {editingQuantity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">

            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-800">
                Update Production Quantity
              </h2>

              <button
                onClick={() => {
                  setEditingQuantity(null);
                  setNewQuantity("");
                }}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">

              <div>
                <p className="text-sm font-medium text-gray-700">
                  {editingQuantity.Product_Name}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  BATCH #{String(editingQuantity.Production_ID).padStart(3, "0")}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Required Quantity</span>
                  <span className="font-medium text-gray-700">
                    {editingQuantity.QuantityRequired} pcs
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Currently Produced</span>
                  <span className="font-medium text-gray-700">
                    {editingQuantity.QuantityProduced} pcs
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Produced Quantity
                </label>

                <input
                  type="number"
                  min="0"
                  max={editingQuantity.QuantityRequired}
                  step="1"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />

                <p className="text-xs text-gray-400 mt-1">
                  Enter the total number of PCs produced, not the additional quantity.
                </p>
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => {
                  setEditingQuantity(null);
                  setNewQuantity("");
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleUpdateQuantity}
                disabled={savingQuantity || newQuantity === ""}
                className="px-4 py-2 rounded-lg bg-[#365f68] text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingQuantity ? "Saving..." : "Save Quantity"}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6">

            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold text-gray-800">
                Add New Product
              </h2>

              <button
                onClick={() => setShowAddProduct(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              Register a finished product using an existing Inventory Item Master record.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inventory Item
                </label>

                <select
                  value={selectedIMId}
                  onChange={(e) => setSelectedIMId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">
                    {inventoryLoading
                      ? "Loading finished products..."
                      : "Select a finished product..."}
                  </option>

                  {inventoryItems.map((item) => (
                    <option key={item.IM_ID} value={item.IM_ID}>
                      {item.Item_Name} ({item.SKU})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manual
                </label>

                <textarea
                  rows={3}
                  placeholder="Enter product details..."
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddProduct(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveProduct}
                disabled={!selectedIMId || savingProduct}
                className="px-4 py-2 rounded-lg bg-[#365f68] text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingProduct ? "Saving..." : "Save Product"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}