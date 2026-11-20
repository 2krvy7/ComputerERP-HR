"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8010";

type Employee = {
  employee_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  position_name: string | null;
  role_name: string | null;
};
type Dept = { DeptID: string; DeptName: string };
type UserRow = {
  UserID: string;
  Username: string;
  email: string;
  RoleName: string;
  DeptName: string | null;
  must_change_password: boolean;
};
type Credentials = { title: string; UserID: string; Username: string; email?: string; one_time_password: string };

const card: CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#24363b",
  borderRadius: "1.2vw",
  padding: "1.6vw",
  boxSizing: "border-box",
};

const inputStyle: CSSProperties = {
  padding: "0.6vw 0.9vw",
  fontSize: "0.9vw",
  borderRadius: "0.6vw",
  border: "1px solid #c9d6d9",
  outline: "none",
  color: "#24363b",
  backgroundColor: "#ffffff",
};

export default function AdminPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [empId, setEmpId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creds, setCreds] = useState<Credentials | null>(null);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem("erp_token");
    } catch {}
    router.replace("/");
  }, [router]);

  // fetch with the saved token; an expired or missing token sends you back to the login page
  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      let token = "";
      try {
        token = localStorage.getItem("erp_token") ?? "";
      } catch {}
      if (!token) {
        logout();
        throw new Error("Please log in");
      }
      const res = await fetch(`${API}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        throw new Error("Session expired");
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`);
      return data;
    },
    [logout]
  );

  const load = useCallback(async () => {
    try {
      const [e, d, u] = await Promise.all([
        api("/users/pending-employees"),
        api("/users/departments"),
        api("/users/"),
      ]);
      setEmployees(e);
      setDepts(d);
      setUsers(u);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function createAccount() {
    if (!empId || !deptId) {
      setError("Pick an employee and a department first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api("/users/", {
        method: "POST",
        body: JSON.stringify({ employee_id: Number(empId), dept_id: deptId }),
      });
      setCreds({ ...data, title: "Account created" });
      setEmpId("");
      setDeptId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u: UserRow) {
    if (!window.confirm(`Reset the password for ${u.Username}? Their current password will stop working.`)) return;
    setError("");
    try {
      const data = await api(`/users/${u.UserID}/reset-password`, { method: "POST" });
      setCreds({ ...data, title: "Password reset" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function copy(text: string) {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }

  const selected = employees.find((x) => String(x.employee_id) === empId);

  const label: CSSProperties = { fontSize: "0.78vw", fontWeight: 600, color: "#668d98" };
  const cell: CSSProperties = { padding: "0.7vw 1vw", textAlign: "left", verticalAlign: "middle" };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#668d98",
        padding: "2vw",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "1.2vw",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.7vw", color: "#ffffff" }}>User administration</h1>
          <p style={{ margin: "0.2vw 0 0", fontSize: "0.85vw", color: "#e4eef0" }}>
            Create accounts for employees and manage their passwords
          </p>
        </div>
        <button
          onClick={logout}
          style={{
            border: "none",
            cursor: "pointer",
            padding: "0.6vw 1.4vw",
            borderRadius: "99vw",
            fontSize: "0.85vw",
            fontWeight: 600,
            backgroundColor: "#ffffff",
            color: "#365f68",
          }}
        >
          Log out
        </button>
      </div>

      <div style={{ display: "flex", gap: "1.2vw", alignItems: "flex-start" }}>
        {/* Create account */}
        <div style={{ ...card, width: "28vw", display: "flex", flexDirection: "column", gap: "0.8vw" }}>
          <h2 style={{ margin: 0, fontSize: "1.1vw", color: "#365f68" }}>Create account</h2>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.3vw", ...label }}>
            Employee (without an account)
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} style={inputStyle}>
              <option value="">{employees.length === 0 ? "No employees waiting" : "Select an employee..."}</option>
              {employees.map((emp) => (
                <option key={emp.employee_id} value={emp.employee_id}>
                  {emp.last_name}, {emp.first_name} — {emp.position_name ?? "no position"}
                  {emp.email ? ` (${emp.email})` : " (no email)"}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.3vw", ...label }}>
            Department
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} style={inputStyle}>
              <option value="">Select a department...</option>
              {depts.map((d) => (
                <option key={d.DeptID} value={d.DeptID}>
                  {d.DeptName} ({d.DeptID})
                </option>
              ))}
            </select>
          </label>

          <p style={{ margin: 0, fontSize: "0.8vw", color: selected && !selected.role_name ? "#a14646" : "#365f68" }}>
            {selected
              ? selected.role_name
                ? `Role: ${selected.role_name} (according to record position)`
                : "This employee has no position yet. Ask HR to assign one."
              : "Role is assigned by the Position in records"}
          </p>

          {error && <p style={{ margin: 0, fontSize: "0.8vw", color: "#a14646" }}>{error}</p>}

          <button
            onClick={createAccount}
            disabled={busy}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "0.7vw 1vw",
              borderRadius: "99vw",
              fontSize: "0.9vw",
              fontWeight: 600,
              backgroundColor: "#365f68",
              color: "#ffffff",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Creating..." : "Create account"}
          </button>

          {/* One-time password, shown once */}
          {creds && (
            <div
              style={{
                marginTop: "0.4vw",
                padding: "1vw",
                borderRadius: "0.8vw",
                backgroundColor: "#f4f8f9",
                border: "1px solid #c9d6d9",
                color: "#24363b",
                fontSize: "0.85vw",
                display: "flex",
                flexDirection: "column",
                gap: "0.3vw",
              }}
            >
              <strong style={{ color: "#365f68" }}>{creds.title}</strong>
              <span>User ID: {creds.UserID}</span>
              <span>Username: {creds.Username}</span>
              {creds.email && <span>Email: {creds.email}</span>}
              <span>
                One-time password:{" "}
                <code style={{ fontWeight: 700, fontSize: "1vw", color: "#24363b" }}>{creds.one_time_password}</code>
              </span>
              <p style={{ margin: "0.2vw 0", fontSize: "0.75vw", color: "#a14646" }}>
                Shown only once. Give it to the employee now; they must change it at first login.
              </p>
              <div style={{ display: "flex", gap: "0.5vw" }}>
                <button
                  onClick={() => copy(creds.one_time_password)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "0.35vw 1vw",
                    borderRadius: "99vw",
                    fontSize: "0.78vw",
                    fontWeight: 600,
                    backgroundColor: "#365f68",
                    color: "#ffffff",
                  }}
                >
                  Copy password
                </button>
                <button
                  onClick={() => setCreds(null)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "0.35vw 1vw",
                    borderRadius: "99vw",
                    fontSize: "0.78vw",
                    fontWeight: 600,
                    backgroundColor: "#e4e9ec",
                    color: "#55656b",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Accounts list */}
        <div style={{ ...card, flex: 1, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
          <div
            style={{
              padding: "1.2vw 1.4vw",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.1vw", color: "#365f68" }}>Accounts</h2>
            <span style={{ fontSize: "0.8vw", color: "#668d98" }}>
              {users.length} {users.length === 1 ? "account" : "accounts"}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <p style={{ padding: "2vw", textAlign: "center", color: "#888", fontSize: "0.85vw", margin: 0 }}>
                Loading accounts...
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85vw" }}>
                <thead>
                  <tr>
                    {["ID", "Username", "Email", "Role", "Department", "Status", ""].map((h, i) => (
                      <th
                        key={i}
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
                  {users.map((u) => (
                    <tr key={u.UserID} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ ...cell, color: "#888" }}>{u.UserID}</td>
                      <td style={{ ...cell, fontWeight: 500 }}>{u.Username}</td>
                      <td style={cell}>{u.email}</td>
                      <td style={cell}>{u.RoleName}</td>
                      <td style={cell}>{u.DeptName ?? <span style={{ color: "#aaa" }}>—</span>}</td>
                      <td style={cell}>
                        <span
                          style={{
                            padding: "0.2vw 0.7vw",
                            borderRadius: "99vw",
                            fontSize: "0.72vw",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            backgroundColor: u.must_change_password ? "#f6ecd6" : "#dff1ec",
                            color: u.must_change_password ? "#8a6d2f" : "#2a7a66",
                          }}
                        >
                          {u.must_change_password ? "Needs new password" : "Active"}
                        </span>
                      </td>
                      <td style={cell}>
                        <button
                          onClick={() => resetPassword(u)}
                          style={{
                            border: "1px solid #a14646",
                            backgroundColor: "#ffffff",
                            color: "#a14646",
                            cursor: "pointer",
                            padding: "0.25vw 0.8vw",
                            borderRadius: "99vw",
                            fontSize: "0.75vw",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Reset password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}