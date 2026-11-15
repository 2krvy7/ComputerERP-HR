"use client";

import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Product = {
  PM_ID: number;
  IM_ID: number;
  Product_Name: string;
  Manual: string | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

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

    return (
    <div className="p-6 space-y-6">

      {/* Product Master Header */}
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

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-3">PM ID</th>
              <th className="px-4 py-3">Product Name</th>
              <th className="px-4 py-3">Manual</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.PM_ID}>
                  <td className="px-4 py-4 font-medium text-gray-700">
                    {product.PM_ID}
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    {product.Product_Name}
                  </td>
                  <td className="px-4 py-4 text-gray-600">
                    {product.Manual || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a finished product...
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manual
                </label>

                <textarea
                  rows={3}
                  placeholder="Enter product details..."
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
                disabled
                className="px-4 py-2 rounded-lg bg-[#365f68] text-white opacity-60 cursor-not-allowed"
              >
                Save Product
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}