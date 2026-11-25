"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const LOCAL = "http://127.0.0.1:8000";
const API = process.env.NEXT_PUBLIC_API_URL ?? LOCAL;
const LOGIN_URL = "https://computer-erp-login.vercel.app";
const DEPT = "PD";
const KEY = "erp_token";

export type SessionUser = { sub: string; username: string; role: string; department: string | null; exp: number };

function readToken(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function decode(token: string): SessionUser | null {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function getUser(): SessionUser | null {
  const u = decode(readToken());
  return u && u.exp * 1000 > Date.now() ? u : null;
}

export function logout() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.location.href = LOGIN_URL;
}

// Every fetch to our API carries the token; an expired session goes back to login
let patched = false;
if (typeof window !== "undefined" && !patched) {
  patched = true;
  const original = window.fetch;
    window.fetch = (input, init = {}) => {
    let url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(LOCAL)) {
      url = API + url.slice(LOCAL.length);
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${localStorage.getItem("erp_token")}`);
      return original(url, { ...init, headers });
    }
    return original(input, init);
  };
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    // the login page sends the token in the URL fragment: save it, then remove it from the address bar
    const m = window.location.hash.match(/token=([^&]+)/);
    if (m) {
      try {
        localStorage.setItem(KEY, m[1]);
      } catch {}
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const user = getUser();
    if (!user) {
      window.location.href = LOGIN_URL;
      return;
    }
    setState(user.role === "SuperAdmin" || user.department === DEPT ? "ok" : "denied");
  }, []);

  if (state === "checking") return null;
  if (state === "denied")
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#668d98", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ backgroundColor: "#ffffff", color: "#24363b", borderRadius: "1.2vw", padding: "2vw", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 0.6vw", color: "#365f68", fontSize: "1.3vw" }}>No access</h2>
          <p style={{ margin: "0 0 1.2vw", fontSize: "0.95vw" }}>Your account doesn&apos;t belong to the Procurement department.</p>
          <button onClick={logout} style={{ border: "none", cursor: "pointer", padding: "0.6vw 1.6vw", borderRadius: "99vw", fontSize: "0.9vw", fontWeight: 600, backgroundColor: "#365f68", color: "#ffffff" }}>
            Back to login
          </button>
        </div>
      </div>
    );
  return <>{children}</>;
}