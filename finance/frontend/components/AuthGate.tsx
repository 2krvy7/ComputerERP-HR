"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const LOCAL = "http://127.0.0.1:8000";
const API = (process.env.NEXT_PUBLIC_API_URL ?? LOCAL).replace(/\/$/, "");
const LOGIN_URL = "https://computer-erp-login.vercel.app";
const DEPT = "FN";
const KEY = "erp_token";

export type SessionUser = {
  sub: string;
  username: string;
  role: string;
  department: string | null;
  exp: number;
};

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

let patched = false;
if (typeof window !== "undefined" && !patched) {
  patched = true;
  const original = window.fetch;
  window.fetch = async (input, init = {}) => {
    let url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;

    const isLocalTarget = url.startsWith(LOCAL);
    const isApiTarget = API && url.startsWith(API);

    if (isLocalTarget || isApiTarget) {
      if (isLocalTarget) {
        url = API + url.slice(LOCAL.length);
      }
      const headers = new Headers(init.headers);
      const token = readToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const res = await original(url, { ...init, headers });
      if (res.status === 401) {
        logout();
      }
      return res;
    }

    return original(input, init);
  };
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    const m = window.location.hash.match(/token=([^&]+)/);
    if (m) {
      try {
        localStorage.setItem(KEY, m[1]);
      } catch {}
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }

    const user = getUser();
    if (!user) {
      window.location.href = LOGIN_URL;
      return;
    }

    setState(
      user.role === "SuperAdmin" || user.department === DEPT ? "ok" : "denied"
    );
  }, []);

  if (state === "checking") return null;

  if (state === "denied") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#668d98",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            color: "#24363b",
            borderRadius: "16px",
            padding: "32px 36px",
            maxWidth: "420px",
            textAlign: "center",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.15)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", color: "#365f68", fontSize: "22px", fontWeight: 700 }}>
            No access
          </h2>
          <p style={{ margin: "0 0 22px", fontSize: "14px", color: "#475569" }}>
            Your account doesn&apos;t belong to the Finance department.
          </p>
          <button
            onClick={logout}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "10px 24px",
              borderRadius: "999px",
              fontSize: "14px",
              fontWeight: 600,
              backgroundColor: "#365f68",
              color: "#ffffff",
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
