
"use client";

import { useState } from "react";
import DashboardLayout from "@/components/dashboardlayout";

const departments = ["Procurement", "Production", "Sales"] as const;

type Department = (typeof departments)[number];

const departmentSections = {
  Procurement: [
    "Purchase Requests",
    "Purchase Orders",
    "Goods Received",
    "Upcoming Requests",
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

const sectionDescriptions: Record<string, string> = {
  "Purchase Requests":
    "Monitor incoming restock requests and purchase requests created by Procurement.",

  "Purchase Orders":
    "View and monitor purchase orders created by Procurement.",

  "Goods Received":
    "Inspect delivered items, record accepted quantities, and process stock in.",

  "Upcoming Requests":
    "Monitor upcoming restock requests and expected procurement activities.",

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
    useState<Department>("Procurement");

  const [activeSection, setActiveSection] =
    useState("Purchase Requests");

  const [purchaseRequestTab, setPurchaseRequestTab] =
    useState("Incoming Requests");

  const handleDepartmentChange = (department: Department) => {
    setActiveDepartment(department);
    setActiveSection(departmentSections[department][0]);
  };

  return (
    <DashboardLayout
      title="Orders"
      description="Monitor transactions and requests across Procurement, Production, and Sales."
    >
      <div className="space-y-6">

        {/* Department Tabs */}
        <div className="flex flex-wrap gap-3 border-b border-[#DCE7EA] pb-3">
          {departments.map((department) => (
            <button
              key={department}
              onClick={() => handleDepartmentChange(department)}
              className={`rounded-full px-6 py-3 text-sm font-bold transition-colors ${
                activeDepartment === department
                  ? "bg-[#365f68] text-white"
                  : "bg-[#F2F7F8] text-[#587176] hover:bg-[#DCE7EA]"
              }`}
            >
              {department}
            </button>
          ))}
        </div>

        {/* Department Subtabs */}
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

        {/* Content Area */}
        <div className="min-h-[350px] rounded-2xl border border-[#DCE7EA] bg-white p-6">

          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#668d98]">
              {activeDepartment}
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#1F3338]">
              {activeSection}
            </h2>

            <p className="mt-2 text-sm text-[#587176]">
              {sectionDescriptions[activeSection]}
            </p>
          </div>

          {/* Purchase Requests Subtabs */}
          {activeDepartment === "Procurement" &&
            activeSection === "Purchase Requests" && (
              <div className="space-y-5">

                <div className="flex flex-wrap gap-2 border-b border-[#DCE7EA] pb-3">
                  {["Incoming Requests", "Purchase Requests"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setPurchaseRequestTab(tab)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        purchaseRequestTab === tab
                          ? "bg-[#F2F7F8] text-[#365f68] border border-[#668d98]"
                          : "text-[#587176] hover:bg-[#F2F7F8]"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl bg-[#F2F7F8] p-8 text-center">
                  <h3 className="font-bold text-[#1F3338]">
                    {purchaseRequestTab}
                  </h3>

                  <p className="mt-2 text-sm text-[#587176]">
                    {purchaseRequestTab === "Incoming Requests"
                      ? "Approved Restock Requests from Inventory will appear here."
                      : "Purchase Requests created by Procurement will appear here."}
                  </p>

                  <p className="mt-4 text-sm text-[#668d98]">
                    No records available.
                  </p>
                </div>
              </div>
            )}

          {/* Other Sections */}
          {!(activeDepartment === "Procurement" &&
            activeSection === "Purchase Requests") && (
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
