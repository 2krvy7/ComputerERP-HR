
"use client";

import { useEffect, useState } from "react";
import type { Customer } from "../../types/customer";

type CustomerTableProps = {
  customers: Customer[];
  loading: boolean;
  onEdit: (customer: Customer) => void;
  onToggleStatus: (customer: Customer) => void;
  onViewHistory: (customer: Customer) => void;
};

const PAGE_SIZE = 10;

function extractContactNumbers(value: unknown): string[] {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  if (typeof value === "string" || typeof value === "number") {
    return [String(value).trim()].filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractContactNumbers);
  }

  if (typeof value === "object") {
    const contactObject = value as Record<string, unknown>;

    const preferredKeys = [
      "contact",
      "contact_number",
      "phone",
      "phone_number",
      "mobile",
      "landline",
      "number",
      "value",
    ];

    for (const key of preferredKeys) {
      if (contactObject[key] !== undefined) {
        return extractContactNumbers(contactObject[key]);
      }
    }

    return Object.values(contactObject).flatMap((item) =>
      typeof item === "string" || typeof item === "number"
        ? extractContactNumbers(item)
        : []
    );
  }

  return [];
}

function getContactType(contact: string): string {
  const digits = contact.replace(/\D/g, "");

  if (/^09\d{9}$/.test(digits) || /^639\d{9}$/.test(digits)) {
    return "Mobile Phone";
  }

  if (
    /^02\d{7,8}$/.test(digits) ||
    /^0[3-9]\d{6,8}$/.test(digits) ||
    /^632\d{7,8}$/.test(digits)
  ) {
    return "Landline";
  }

  return "Contact Number";
}

function getCustomerType(customer: Customer): string {
  return customer.customer_type || "—";
}

export default function CustomerTable({
  customers,
  loading,
  onEdit,
  onToggleStatus,
  onViewHistory,
}: CustomerTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(customers.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  const startIndex = (safePage - 1) * PAGE_SIZE;

  const paginatedCustomers = customers.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  if (loading) {
    return (
      <div className="p-10 text-center text-sm text-slate-500 sm:p-12">
        Loading customers...
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="p-8 text-center sm:p-12">
        <p className="font-medium text-slate-700">
          No customers found.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Add a customer or change your search.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* Mobile customer cards */}
      <div className="divide-y divide-[#D1D5DB] md:hidden">
        {paginatedCustomers.map((customer) => {
          const contactNumbers = extractContactNumbers(
            customer.contact
          );

          return (
            <article
              key={customer.customer_id}
              className="min-w-0 space-y-3 p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Customer #{customer.customer_id}
                  </p>
                  <h3 className="mt-1 break-words text-sm font-bold text-slate-900">
                    {customer.name}
                  </h3>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    customer.status
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {customer.status ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-500">Email</p>
                  <p className="mt-0.5 break-all text-slate-800">
                    {customer.email || "—"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-slate-500">Customer Type</p>
                  <p className="mt-0.5 text-slate-800">
                    {getCustomerType(customer)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-slate-500">Contact</p>
                  {contactNumbers.length > 0 ? (
                    <div className="mt-0.5 space-y-1">
                      {contactNumbers.map((contact, index) => (
                        <div key={`${contact}-${index}`}>
                          <p className="break-all font-medium text-slate-800">
                            {contact}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {getContactType(contact)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-slate-800">—</p>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="font-medium text-slate-500">Address</p>
                  <p className="mt-0.5 break-words text-slate-800">
                    {customer.address || "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-[#D1D5DB] pt-3">
                <button
                  type="button"
                  onClick={() => onViewHistory(customer)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  View History
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(customer)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => onToggleStatus(customer)}
                  className={`col-span-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                    customer.status
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  }`}
                >
                  {customer.status
                    ? "Deactivate Customer"
                    : "Activate Customer"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Tablet and desktop customer table */}
      <div className="hidden min-w-0 overflow-x-auto md:block">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-[#D1D5DB] text-slate-600">
            <tr>
              <th className="px-4 py-4 text-center font-semibold">
                Customer ID
              </th>

              <th className="px-4 py-4 text-center font-semibold">
                Customer Name
              </th>

              <th className="px-4 py-4 text-center font-semibold">
                Email
              </th>

              <th className="px-4 py-4 text-center font-semibold">
                Contact
              </th>

              <th className="px-4 py-4 text-center font-semibold">
                Type
              </th>

              <th className="px-4 py-4 text-center font-semibold">
                Status
              </th>

              <th className="px-4 py-4 text-center font-semibold">
                Address
              </th>

              <th className="px-4 py-4 text-center font-semibold">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {paginatedCustomers.map((customer) => {
              const contactNumbers = extractContactNumbers(
                customer.contact
              );

              return (
                <tr
                  key={customer.customer_id}
                  className="transition-colors hover:bg-[#DDE1E5]"
                >
                  <td className="px-4 py-4 text-center font-semibold text-slate-700">
                    #{customer.customer_id}
                  </td>

                  <td className="max-w-[200px] break-words px-4 py-4 font-medium text-slate-900">
                    {customer.name}
                  </td>

                  <td className="max-w-[220px] break-all px-4 py-4 text-slate-600">
                    {customer.email || "—"}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {contactNumbers.length > 0 ? (
                      <div className="space-y-1">
                        {contactNumbers.map((contact, index) => (
                          <div key={`${contact}-${index}`}>
                            <p className="font-medium text-slate-800">
                              {contact}
                            </p>

                            <span className="text-xs text-slate-500">
                              {getContactType(contact)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {getCustomerType(customer)}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        customer.status
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {customer.status ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="max-w-[220px] break-words px-4 py-4 text-slate-600">
                    {customer.address || "—"}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex min-w-[280px] items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onViewHistory(customer)}
                        className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        View History
                      </button>

                      <button
                        type="button"
                        onClick={() => onEdit(customer)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleStatus(customer)}
                        className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          customer.status
                            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {customer.status ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 border-t border-[#D1D5DB] bg-[#E5E7EB] px-3 py-3 sm:px-5 sm:py-4 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-slate-500 sm:text-sm">
          Showing{" "}
          <span className="font-semibold text-slate-700">
            {startIndex + 1}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-slate-700">
            {Math.min(startIndex + PAGE_SIZE, customers.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-700">
            {customers.length}
          </span>{" "}
          customers
        </p>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setCurrentPage(safePage - 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            Previous
          </button>

          <span className="whitespace-nowrap px-1 text-xs font-medium text-slate-600 sm:px-2 sm:text-sm">
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setCurrentPage(safePage + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
