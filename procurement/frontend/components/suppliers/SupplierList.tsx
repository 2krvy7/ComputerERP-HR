"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";

const API = "http://127.0.0.1:8000";
const PAGE_SIZE = 10;

type Supplier = {
  SupplierID: number;
  SupplierName: string;
  ContactPerson: string | null;
  Contact: string | null;
  Email: string | null;
  Address: string | null;
  status: "Active" | "Archived";
};
type Filter = "Active" | "Archived" | "All";

// Empty form boxes are sent as null (the backend rejects "" as an email)
const clean = (v: string) => (v.trim() === "" ? null : v.trim());

const inputStyle = {
  padding: "0.55vw 0.9vw",
  fontSize: "0.85vw",
  fontWeight: 400,
  borderRadius: "0.6vw",
  border: "1px solid #c9d6d9",
  outline: "none",
  color: "#24363b",
  backgroundColor: "#ffffff",
};

/* ---------- Add / Edit popup ---------- */
function SupplierForm({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null; // null = adding a new one
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supplier?.SupplierName ?? "");
  const [person, setPerson] = useState(supplier?.ContactPerson ?? "");
  const [phone, setPhone] = useState(supplier?.Contact ?? "");
  const [email, setEmail] = useState(supplier?.Email ?? "");
  const [address, setAddress] = useState(supplier?.Address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (name.trim() === "") {
      setError("Supplier name is required");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      supplier_name: name.trim(),
      contact_person: clean(person),
      contact: clean(phone),
      email: clean(email),
      address: clean(address),
    };
    try {
      const res = await fetch(supplier ? `${API}/suppliers/${supplier.SupplierID}` : `${API}/suppliers/`, {
        method: supplier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.detail === "string" ? data.detail : "Please check the fields (is the email valid?)");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, wide = false) => (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.3vw",
        gridColumn: wide ? "1 / -1" : undefined,
        fontSize: "0.78vw",
        fontWeight: 600,
        color: "#668d98",
      }}
    >
      {label}
      <input value={value} onChange={(e) => set(e.target.value)} style={inputStyle} />
    </label>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "36vw",
          backgroundColor: "#ffffff",
          color: "#24363b",
          borderRadius: "1.6vw",
          padding: "1.6vw",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <h2 style={{ margin: "0 0 1vw", fontSize: "1.2vw", color: "#365f68" }}>
          {supplier ? "Edit supplier" : "Add supplier"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9vw" }}>
          {field("Supplier name *", name, setName, true)}
          {field("Main contact person", person, setPerson)}
          {field("Phone", phone, setPhone)}
          {field("Email", email, setEmail, true)}
          {field("Address", address, setAddress, true)}
        </div>

        {error && <p style={{ margin: "0.8vw 0 0", fontSize: "0.8vw", color: "#a14646" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6vw", marginTop: "1.2vw" }}>
          <button
            onClick={onClose}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "0.5vw 1.2vw",
              borderRadius: "99vw",
              fontSize: "0.82vw",
              fontWeight: 600,
              backgroundColor: "#e4e9ec",
              color: "#55656b",
            }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "0.5vw 1.4vw",
              borderRadius: "99vw",
              fontSize: "0.82vw",
              fontWeight: 600,
              backgroundColor: "#365f68",
              color: "#ffffff",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- The list ---------- */
export default function SupplierList({ limit }: { limit?: number }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("Active");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Supplier | "new" | null>(null); // which popup is open

  // The backend does the searching, so we ask again when the text or filter changes
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: filter });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${API}/suppliers/?${params}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setSuppliers(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  // Wait 300 ms after the last keystroke so we don't call the backend on every letter
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function changeStatus(s: Supplier, action: "archive" | "restore") {
    if (
      action === "archive" &&
      !window.confirm(`Archive ${s.SupplierName}? It will be hidden from new quotations, but past orders keep its name.`)
    )
      return;
    const res = await fetch(`${API}/suppliers/${s.SupplierID}/${action}`, { method: "PATCH" });
    if (!res.ok) {
      alert("Could not update the supplier");
      return;
    }
    load();
  }

  const shown = limit ? suppliers.slice(0, limit) : suppliers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
  const pages = Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE));
  if (page > pages) setPage(pages);
  }, [suppliers, page]);

  const note = (text: string) => (
    <p style={{ padding: "2vw", textAlign: "center", color: "#888", fontSize: "0.85vw", margin: 0 }}>{text}</p>
  );
  const cell = { padding: "0.8vw 1.2vw", textAlign: "left" as const, verticalAlign: "top" as const };
  const empty = <span style={{ color: "#aaa" }}>—</span>;

  const smallButton = (text: string, color: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${color}`,
        backgroundColor: "#ffffff",
        color,
        cursor: "pointer",
        padding: "0.25vw 0.8vw",
        borderRadius: "99vw",
        fontSize: "0.75vw",
        fontWeight: 600,
      }}
    >
      {text}
    </button>
  );

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
      {/* Toolbar: search, filter pills, count, add button (hidden when used as a small widget) */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, contact, email, address..."
              style={{ ...inputStyle, width: "24vw", borderRadius: "99vw" }}
            />
            <div style={{ display: "flex", gap: "0.3vw" }}>
              {(["Active", "Archived", "All"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "0.3vw 0.9vw",
                    borderRadius: "99vw",
                    fontSize: "0.75vw",
                    fontWeight: 600,
                    backgroundColor: filter === f ? "#365f68" : "#e4e9ec",
                    color: filter === f ? "#ffffff" : "#55656b",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1vw" }}>
            <span style={{ fontSize: "0.8vw", color: "#668d98" }}>
              {suppliers.length} {suppliers.length === 1 ? "supplier" : "suppliers"}
            </span>
            <button
              onClick={() => setForm("new")}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "0.5vw 1.2vw",
                borderRadius: "99vw",
                fontSize: "0.8vw",
                fontWeight: 600,
                backgroundColor: "#365f68",
                color: "#ffffff",
              }}
            >
              + Add supplier
            </button>
          </div>
        </div>
      )}

      {/* The scrolling area */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          note("Loading suppliers...")
        ) : error ? (
          note(`Failed to load: ${error}`)
        ) : shown.length === 0 ? (
          note(search ? "No suppliers match your search." : filter === "Archived" ? "No archived suppliers." : "No suppliers yet.")
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85vw" }}>
            <thead>
              <tr>
                {["Name", "Contact person", "Phone", "Email", "Address", ...(limit ? [] : [""])].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      ...cell,
                      position: "sticky", // header stays visible while scrolling
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
              {shown.map((s) => (
                <tr
                  key={s.SupplierID}
                  style={{ borderBottom: "1px solid #f0f0f0", opacity: s.status === "Archived" ? 0.6 : 1 }}
                >
                  <td style={{ ...cell, fontWeight: 500 }}>
                    {s.SupplierName}
                    {s.status === "Archived" && (
                      <span
                        style={{
                          marginLeft: "0.6vw",
                          padding: "0.15vw 0.6vw",
                          borderRadius: "99vw",
                          fontSize: "0.68vw",
                          backgroundColor: "#e4e9ec",
                          color: "#55656b",
                        }}
                      >
                        Archived
                      </span>
                    )}
                  </td>
                  <td style={cell}>{s.ContactPerson ?? empty}</td>
                  <td style={cell}>{s.Contact ?? empty}</td>
                  <td style={cell}>{s.Email ?? empty}</td>
                  <td style={{ ...cell, maxWidth: "16vw" }}>{s.Address ?? empty}</td>
                  {!limit && (
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.4vw" }}>
                        {smallButton("Edit", "#365f68", () => setForm(s))}
                        {s.status === "Active"
                          ? smallButton("Archive", "#a14646", () => changeStatus(s, "archive"))
                          : smallButton("Restore", "#2a7a66", () => changeStatus(s, "restore"))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!limit && <Pagination total={suppliers.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />}
      {/* Add / Edit popup */}
      {form && (
        <SupplierForm
          supplier={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}