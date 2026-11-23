"use client";

import { useEffect, useState } from "react";
import Pagination from "@/components/Pagination"
import { printReport } from "@/components/printReport";

// One row per purchase order, taken from Finance's payable (APInvoice). Read-only.
type Invoice = {
  apInvoiceID: number;
  PO_ID: number;
  OrderDate: string;
  order_total: number;
  SupplierName: string;
  Item_Name: string;
  Quantity: number;
  amount: number | null;
  totalPaid: number | null;
  remainingBalance: number | null;
  payment_status: string | null;   // whatever text Finance stores in APInvoice.status
  dueDate: string | null;
};

const PAGE_SIZE = 10;
const FILTERS = ["All", "Outstanding", "Paid"] as const;

const money = (n: number | null) =>
  n === null || n === undefined
    ? "—"
    : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const date = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const isPaid = (i: Invoice) => (i.payment_status ?? "").toLowerCase() === "paid";

// Colors for the payment pill. Finance decides the status words, so unknown ones still show up.
function paymentBadge(i: Invoice) {
  const s = (i.payment_status ?? "").toLowerCase();
  if (s === "paid") return { label: i.payment_status!, bg: "#dff1ec", text: "#2a7a66" };
  if (s === "overdue") return { label: i.payment_status!, bg: "#f6e1e1", text: "#a14646" };
  return { label: i.payment_status ?? "Unknown", bg: "#f6ecd6", text: "#8a6d2f" };
}

export default function InvoiceList({ limit }: { limit?: number }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://127.0.0.1:8000/invoices/");
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setInvoices(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const text = search.toLowerCase();
  const filtered = invoices.filter((i) => {
    const matchesFilter =
      filter === "All" ||
      (filter === "Outstanding" && !isPaid(i)) ||
      (filter === "Paid" && isPaid(i));
    const matchesSearch =
      !text ||
      i.SupplierName.toLowerCase().includes(text) ||
      i.Item_Name.toLowerCase().includes(text);
    return matchesFilter && matchesSearch;
  });
  const shown = limit ? filtered.slice(0, limit) : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handlePrint() {
    const total = filtered.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const paid = filtered.reduce((s, i) => s + Number(i.totalPaid ?? 0), 0);
    const balance = filtered.reduce((s, i) => s + Number(i.remainingBalance ?? 0), 0);
    printReport({
      title: "Purchase Invoices Report",
      subtitle: `Filter: ${filter}${search ? ` · Search: "${search}"` : ""}`,
      summary: [
        ["Invoices", String(filtered.length)],
        ["Total amount", money(total)],
        ["Paid", money(paid)],
        ["Outstanding balance", money(balance)],
      ],
      headers: ["Invoice", "Order", "Supplier", "Item", "Ordered", "Amount", "Paid", "Balance", "Payment", "Due date"],
      rows: filtered.map((i) => [
        `#${i.apInvoiceID}`, `#${i.PO_ID}`, i.SupplierName, i.Item_Name, date(i.OrderDate),
        money(i.amount), money(i.totalPaid), money(i.remainingBalance),
        paymentBadge(i).label, date(i.dueDate),
      ]),
    });
  }

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > pages) setPage(pages);
  }, [filtered.length, page]);

  const note = (t: string) => (
    <p style={{ padding: "2vw", textAlign: "center", color: "#888", fontSize: "0.85vw", margin: 0 }}>
      {t}
    </p>
  );

  const cell = { padding: "0.8vw 1.2vw", textAlign: "left" as const };

  return (
    <div
      style={{
        height: "100%",
        backgroundColor: "#ffffff",
        color: "#24363b",
        borderRadius: "1vw",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Filter pills + search + count (hidden when used as a small dashboard widget) */}
      {!limit && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1vw",
            padding: "1vw 1.4vw",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ display: "flex", gap: "0.5vw" }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                style={{
                  padding: "0.4vw 1vw",
                  borderRadius: "99vw",
                  fontSize: "0.8vw",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid #c9d6d9",
                  backgroundColor: filter === f ? "#365f68" : "#ffffff",
                  color: filter === f ? "#ffffff" : "#365f68",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search supplier or item..."
              style={{
                width: "15vw",
                padding: "0.45vw 1vw",
                fontSize: "0.8vw",
                borderRadius: "99vw",
                border: "1px solid #c9d6d9",
                outline: "none",
                color: "#24363b",
                backgroundColor: "#ffffff",
              }}
            />
            <span style={{ fontSize: "0.8vw", color: "#668d98", whiteSpace: "nowrap" }}>
              {filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}
            </span>
            <button
              onClick={handlePrint}
              style={{
                border: "none", cursor: "pointer", padding: "0.45vw 1.1vw", borderRadius: "99vw",
                fontSize: "0.8vw", fontWeight: 600, backgroundColor: "#365f68", color: "#ffffff",
              }}
            >
              Print report
            </button>
          </div>
        </div>
      )}

      {/* The scrolling area */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          note("Loading invoices...")
        ) : error ? (
          note(`Failed to load: ${error}`)
        ) : shown.length === 0 ? (
          note(invoices.length === 0 ? "No invoices yet. They appear when a purchase order is created." : "No invoices match.")
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85vw" }}>
            <thead>
              <tr>
                {["Invoice", "Order", "Supplier", "Ordered", "Amount", "Paid", "Balance", "Payment", "Due date"].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...cell,
                      position: "sticky",
                      top: 0,
                      backgroundColor: "#ffffff",
                      color: "#668d98",
                      fontWeight: 600,
                      borderBottom: "1px solid #e5e5e5",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const b = paymentBadge(i);
                return (
                  <tr key={i.apInvoiceID} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ ...cell, color: "#888" }}>#{i.apInvoiceID}</td>
                    <td style={{ ...cell, color: "#888" }}>#{i.PO_ID}</td>
                    <td style={cell}>
                      <div style={{ fontWeight: 500 }}>{i.SupplierName}</div>
                      <div style={{ fontSize: "0.7vw", color: "#999" }}>{i.Item_Name}</div>
                    </td>
                    <td style={cell}>{date(i.OrderDate)}</td>
                    <td style={{ ...cell, fontWeight: 500 }}>{money(i.amount)}</td>
                    <td style={cell}>{money(i.totalPaid)}</td>
                    <td style={cell}>{money(i.remainingBalance)}</td>
                    <td style={cell}>
                      <span
                        style={{
                          padding: "0.25vw 0.8vw",
                          borderRadius: "99vw",
                          fontSize: "0.75vw",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          backgroundColor: b.bg,
                          color: b.text,
                        }}
                      >
                        {b.label}
                      </span>
                    </td>
                    <td style={{ ...cell, color: "#888" }}>{date(i.dueDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!limit && <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />}
    </div>
  );
}