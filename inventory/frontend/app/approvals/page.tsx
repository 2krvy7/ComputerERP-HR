"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import DashboardLayout from "../../components/dashboardlayout";

interface InventoryUser {
  user_id: string;
  username: string;
  role_id: number;
  role: string;
  dept_id: string | null;
  must_change_password: boolean;
}

interface OrderDetail {
  order_detail_id: number;
  IM_ID: number;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
}

interface SalesOrder {
  order_id: number;
  customer_id: number;
  order_date: string;
  status: string;
  total_amount: number | string;
  details: OrderDetail[];
}

interface InventoryItem {
  IM_ID: number;
  SKU: string;
  Item_Name: string;
}

interface WarehouseStock {
  im_id: number;
  quantity_on_hand: number;
  item_type: string;
  warehouse_name: string;
}

const SALES_API = "/sales-api";

async function salesRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SALES_API}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

const canReviewRequests = (user: InventoryUser) =>
  user.dept_id === "IN" && (user.role_id === 2 || user.role_id === 3);

export default function ApprovalsPage() {
  const [user, setUser] = useState<InventoryUser | null>(null);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadRequests = useCallback(async () => {
    const [allOrders, inventoryItems, stock] = await Promise.all([
      salesRequest<SalesOrder[]>("/api/orders?page=1&page_size=100"),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/item_master/`).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load Inventory item names.");
        return response.json() as Promise<InventoryItem[]>;
      }),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/warehouses/stock`).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load current warehouse stock.");
        return response.json() as Promise<WarehouseStock[]>;
      }),
    ]);
    setOrders(allOrders.filter((order) => order.status === "Pending"));
    setItems(inventoryItems);
    setWarehouseStock(stock);
  }, []);

  useEffect(() => {
    let active = true;
    salesRequest<InventoryUser>("/api/auth/me")
      .then(async (session) => {
        if (!active) return;
        if (!canReviewRequests(session)) {
          setError("Sign in with an Inventory staff or admin account to review requests.");
          return;
        }
        if (session.must_change_password) {
          setError("Change this account’s temporary password in Sales before reviewing requests.");
          return;
        }
        setUser(session);
        try {
          await loadRequests();
        } catch (loadError) {
          if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load order requests.");
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadRequests]);

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.IM_ID, item])),
    [items]
  );
  const finishedGoodsStockByItem = useMemo(() => {
    const totals = new Map<number, number>();
    for (const stock of warehouseStock) {
      const normalizedWarehouse = stock.warehouse_name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isFinishedGoodsWarehouse = normalizedWarehouse.includes("finishedgood") || normalizedWarehouse.startsWith("fg");
      if (!isFinishedGoodsWarehouse || !normalizedWarehouse.endsWith("a") && !normalizedWarehouse.endsWith("b")) continue;
      totals.set(stock.im_id, (totals.get(stock.im_id) ?? 0) + Number(stock.quantity_on_hand || 0));
    }
    return totals;
  }, [warehouseStock]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await salesRequest<InventoryUser>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: identifier, password }),
      });
      if (!canReviewRequests(session)) {
        await salesRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        throw new Error("Only Inventory staff or admins can review order requests.");
      }
      if (session.must_change_password) {
        await salesRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        throw new Error("Change this account’s temporary password in Sales, then sign in again.");
      }
      setUser(session);
      setPassword("");
      await loadRequests();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function decide(orderId: number) {
    setBusyId(orderId);
    setError("");
    setNotice("");
    try {
      await salesRequest<SalesOrder>(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Accepted" }),
      });
      setOrders((current) => current.filter((order) => order.order_id !== orderId));
      setNotice(`SO-${String(orderId).padStart(4, "0")} accepted.`);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to update this request.");
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    await salesRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setOrders([]);
    setNotice("");
  }

  return (
    <DashboardLayout title="Sales Order Requests" description="Review requested items and accept each request.">
      {!user ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-[#dce7e8] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#294f58]">Inventory sign in</h2>
          <p className="mt-2 text-sm text-[#587176]">Use your Inventory staff or admin account.</p>
          <form onSubmit={(event) => void signIn(event)} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">Username or email
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-[#365f68]" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-[#365f68]" />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button disabled={loading} className="w-full rounded-lg bg-[#365f68] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{loading ? "Please wait…" : "Sign in"}</button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Signed in as <span className="font-semibold text-slate-800">{user.username}</span> · Inventory {user.role}</p>
            <button onClick={() => void signOut()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {loading ? <p className="py-8 text-center text-slate-500">Loading requests…</p> : orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No pending Sales order requests.</div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <article key={order.order_id} className="rounded-xl border border-[#dce7e8] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><h2 className="text-lg font-bold text-[#294f58]">SO-{String(order.order_id).padStart(4, "0")}</h2><p className="mt-1 text-sm text-slate-500">Customer #{order.customer_id} · {new Date(order.order_date).toLocaleDateString("en-PH")}</p></div>
                    <div className="text-right"><p className="text-xs uppercase tracking-wide text-slate-500">Request total</p><p className="text-lg font-bold text-slate-800">₱{Number(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p></div>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Requested item</th><th className="py-2">Requested qty</th><th className="py-2">FG stock A/B</th><th className="py-2">Unit price</th><th className="py-2 text-right">Line total</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{order.details.map((detail) => { const item = itemById.get(detail.IM_ID); const available = finishedGoodsStockByItem.get(detail.IM_ID) ?? 0; const enoughStock = available >= detail.quantity; return <tr key={detail.order_detail_id}><td className="py-2 font-medium text-slate-700">{item ? `${item.Item_Name} (${item.SKU})` : `Item #${detail.IM_ID}`}</td><td className="py-2">{detail.quantity}</td><td className={`py-2 font-semibold ${enoughStock ? "text-emerald-700" : "text-amber-700"}`}>{available}{!enoughStock && " · short"}</td><td className="py-2">₱{Number(detail.unit_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td><td className="py-2 text-right">₱{Number(detail.line_total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>; })}</tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex justify-end gap-3">
                    <button disabled={busyId === order.order_id} onClick={() => void decide(order.order_id)} className="rounded-lg bg-[#365f68] px-5 py-2 text-sm font-semibold text-white hover:bg-[#294f58] disabled:opacity-50">Accept request</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
