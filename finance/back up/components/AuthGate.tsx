"use client";

import type { ReactNode } from "react";

const LOCAL = "http://127.0.0.1:8000";
const API = (process.env.NEXT_PUBLIC_API_URL ?? LOCAL).replace(/\/$/, "");
const LOGIN_URL = "https://vercel.app";

export type SessionUser = {
  sub: string;
  username: string;
  role: string;
  department: string | null;
  exp: number;
};

// Temporary mock Finance user while editing
export function getUser(): SessionUser | null {
  return {
    sub: "FN002",
    username: "Finance Dev",
    role: "Admin",
    department: "FN",
    exp: Math.floor(Date.now() / 1000) + 86400,
  };
}

export function logout() {
  window.location.href = LOGIN_URL;
}

// Keeps the localhost -> deployed API URL rewrite active while bypassing auth
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

    if (url.startsWith(LOCAL)) {
      url = API + url.slice(LOCAL.length);
    }
    return original(url, init);
  };
}

export default function AuthGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
