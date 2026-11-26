"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const LOCAL = "http://127.0.0.1:8000";
const API = process.env.NEXT_PUBLIC_API_URL ?? LOCAL;

const LOGIN_URL = "https://computer-erp-login.vercel.app";

const DEPT = "HR";
const KEY = "erp_token";

export type SessionUser = {
  sub: string;
  username: string;
  role: string;
  department: string | null;
  exp: number;
};


// =========================
// READ TOKEN
// =========================

function readToken(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}


// =========================
// DECODE TOKEN
// =========================

function decode(token: string): SessionUser | null {
  try {
    if (!token) {
      return null;
    }

    const payload = token
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}


// =========================
// GET CURRENT USER
// =========================

export function getUser(): SessionUser | null {
  const user = decode(readToken());

  if (!user) {
    return null;
  }

  if (!user.exp || user.exp * 1000 <= Date.now()) {
    return null;
  }

  return user;
}


// =========================
// LOGOUT
// =========================

export function logout() {
  try {
    localStorage.removeItem(KEY);
  } catch {}

  window.location.href = LOGIN_URL;
}


// =========================
// PATCH FETCH
// =========================

let patched = false;

if (typeof window !== "undefined" && !patched) {
  patched = true;

  const original = window.fetch;

  window.fetch = (input, init = {}) => {
    let url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url;

    // Convert local backend URL to deployed backend URL
    if (url.startsWith(LOCAL)) {
      url = API + url.slice(LOCAL.length);

      const headers = new Headers(init.headers);

      const token = localStorage.getItem(KEY);

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return original(url, {
        ...init,
        headers,
      });
    }

    return original(input, init);
  };
}


// =========================
// AUTH GATE
// =========================

export default function AuthGate({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<"checking" | "ok" | "denied">(
    "checking"
  );

  useEffect(() => {
    // Login service sends the JWT token
    // through the URL fragment.
    const match = window.location.hash.match(/token=([^&]+)/);

    if (match) {
      try {
        localStorage.setItem(KEY, match[1]);
      } catch {}

      // Remove token from the address bar
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }

    const user = getUser();

    // No valid session
    if (!user) {
      window.location.href = LOGIN_URL;
      return;
    }

    // SuperAdmin can access HR
    // HR department users can access HR
    if (
      user.role === "SuperAdmin" ||
      user.department === DEPT
    ) {
      setState("ok");
    } else {
      setState("denied");
    }
  }, []);

  // Still checking authentication
  if (state === "checking") {
    return null;
  }

  // User is logged in but doesn't belong to HR
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
            borderRadius: "1.2vw",
            padding: "2vw",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.6vw",
              color: "#365f68",
              fontSize: "1.3vw",
            }}
          >
            No access
          </h2>

          <p
            style={{
              margin: "0 0 1.2vw",
              fontSize: "0.95vw",
            }}
          >
            Your account doesn&apos;t belong to the HR department.
          </p>

          <button
            onClick={logout}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "0.6vw 1.6vw",
              borderRadius: "99vw",
              fontSize: "0.9vw",
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