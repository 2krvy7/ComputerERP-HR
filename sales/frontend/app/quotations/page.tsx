
"use client";

import { useState } from "react";
import QuotationPanel from "../../components/sales-processing/QuotationPanel";
import OrderPanel from "../../components/sales-processing/OrderPanel";

type SalesTab = "orders" | "quotations";

export default function SalesProcessingPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>("orders");

  const tabClass = (tab: SalesTab) =>
    `rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
      activeTab === tab
        ? "bg-green-700 text-white shadow-sm"
        : "text-slate-700 hover:bg-[#DDE1E5] hover:text-blue-700"
    }`;

  return (
    <div className="min-h-full bg-green-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Sales processing sections"
          className="flex flex-wrap gap-2 rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-2 shadow-sm"
        >
          <button
            id="orders-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "orders"}
            aria-controls="orders-panel"
            onClick={() => setActiveTab("orders")}
            className={tabClass("orders")}
          >
            Sales Order
          </button>

          <button
            id="quotations-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "quotations"}
            aria-controls="quotations-panel"
            onClick={() => setActiveTab("quotations")}
            className={tabClass("quotations")}
          >
            Sales Quotation
          </button>
        </div>

        {/* Active Panel */}
        {activeTab === "orders" && (
          <section
            id="orders-panel"
            role="tabpanel"
            aria-labelledby="orders-tab"
            className="min-w-0"
          >
            <OrderPanel />
          </section>
        )}

        {activeTab === "quotations" && (
          <section
            id="quotations-panel"
            role="tabpanel"
            aria-labelledby="quotations-tab"
            className="min-w-0"
          >
            <QuotationPanel />
          </section>
        )}
      </div>
    </div>
  );
}
