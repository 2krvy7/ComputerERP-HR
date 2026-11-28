
"use client";

import { useState } from "react";
import InvoicePanel from "../../components/billing-collections/InvoicePanel";
import AccountsReceivablePanel from "../../components/billing-collections/AccountsReceivablePanel";
import CollectionsPanel from "../../components/billing-collections/CollectionsPanel";

type BillingTab = "invoices" | "receivables" | "collections";

const tabs: { id: BillingTab; label: string }[] = [
  { id: "invoices", label: "Sales Invoice" },
  { id: "receivables", label: "Accounts Receivable" },
  { id: "collections", label: "Payment Collections" },
];

export default function BillingCollectionsPage() {
  const [activeTab, setActiveTab] = useState<BillingTab>("invoices");

  const tabClass = (tab: BillingTab) =>
    `min-h-11 shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
      activeTab === tab
        ? "bg-green-900 text-white shadow-sm"
        : "text-slate-600 hover:bg-white hover:text-blue-700"
    }`;

  return (
    <main className="min-h-full w-full bg-white p-3 text-slate-900 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div
          role="tablist"
          aria-label="Billing and collections sections"
          className="flex w-full min-w-0 gap-2 overflow-x-auto rounded-xl border border-[#D1D5DB] bg-[#E5E7EB] p-2 shadow-sm"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`billing-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`billing-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={tabClass(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section
          id={`billing-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`billing-tab-${activeTab}`}
          className="min-w-0 w-full"
        >
          {activeTab === "invoices" && <InvoicePanel />}

          {activeTab === "receivables" && (
            <AccountsReceivablePanel />
          )}

          {activeTab === "collections" && <CollectionsPanel />}
        </section>
      </div>
    </main>
  );
}
