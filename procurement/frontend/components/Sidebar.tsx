"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUser, logout } from "./AuthGate";
import type { SessionUser } from "./AuthGate";

import {
  LayoutDashboard,
  Contact,
  FileText,
  ClipboardList,
  Receipt,
  CircleUser,
  LogOut,
} from "lucide-react";

// Colors sampled from your design
const COLORS = {
  sidebar: "#365f68",
  light: "#668d98", // hover pill, user card, logout button
  logo: "#c0d9d9",
};

// HR frontend (employee self-service pages live there)
const HR_URL = (
  process.env.NEXT_PUBLIC_HR_URL ||
  "https://computer-erp-hr-frontend.vercel.app"
).replace(/\/+$/, "");

const NAV = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Suppliers", href: "/suppliers", Icon: Contact },
  { label: "Requests", href: "/requests", Icon: FileText },
  { label: "Orders", href: "/orders", Icon: ClipboardList },
  { label: "Invoices", href: "/invoices", Icon: Receipt },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverUser, setHoverUser] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  // Open my employee page in HR, carrying the login token
  const openMyPage = () => {
    let token = "";

    try {
      token =
        localStorage.getItem("erp_token") ||
        sessionStorage.getItem("erp_token") ||
        "";
    } catch {
      token = "";
    }

    window.location.href = `${HR_URL}/employee-dashboard#token=${encodeURIComponent(
      token
    )}`;
  };

  return (
    <aside
      style={{
        position: "fixed",
        top: "1.14vw",
        left: "1.14vw",
        bottom: "1.14vw",
        width: "15.66vw",
        zIndex: 50,
        backgroundColor: COLORS.sidebar,
        borderRadius: "1.8vw",
        padding: "1.9vw 0.76vw 2.6vw",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        color: "white",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Logo + title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65vw",
          paddingLeft: "1.04vw",
          marginBottom: "1.15vw",
        }}
      >
        <img
          src="/favicon.ico"
          alt="Procurement logo"
          style={{
            width: "2.65vw",
            height: "2.65vw",
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "0.85vw", fontWeight: 700, whiteSpace: "nowrap" }}>
          PROCUREMENT
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.5vw" }}>
        {NAV.map(({ label, href, Icon }) => {
          const active = pathname?.startsWith(href);
          const hover = hovered === href && !active;

          return (
            <Link
              key={href}
              href={href}
              onMouseEnter={() => setHovered(href)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: "relative",
                height: "3.15vw",
                borderRadius: "99vw",
                display: "flex",
                alignItems: "center",
                justifyContent: "center", // text is centered in the pill, like the design
                fontSize: "0.75vw",
                fontWeight: 500,
                textDecoration: "none",
                color: active ? COLORS.sidebar : "white",
                backgroundColor: active ? "#ffffff" : hover ? COLORS.light : "transparent",
                transition: "background-color 0.15s",
              }}
            >
              <Icon
                style={{
                  position: "absolute", // icon stays on the left
                  left: "1.5vw",
                  width: "1.65vw",
                  height: "1.65vw",
                }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Pushes the user card + logout to the bottom */}
      <div style={{ flexGrow: 1 }} />

      {/* User card (opens my employee page in HR) */}
      <button
        type="button"
        onClick={openMyPage}
        onMouseEnter={() => setHoverUser(true)}
        onMouseLeave={() => setHoverUser(false)}
        title="Open my employee page"
        style={{
          height: "5.2vw",
          borderRadius: "1vw",
          backgroundColor: COLORS.light,
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: "1vw",
          padding: "0 1.64vw",
          width: "100%",
          textAlign: "left",
          fontFamily: "inherit",
          color: "white",
          cursor: "pointer",
          filter: hoverUser ? "brightness(1.08)" : "none",
          transition: "filter 0.15s",
        }}
      >
        <CircleUser style={{ width: "1.5vw", height: "1.5vw", flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
          <span style={{ fontSize: "0.78vw", fontWeight: 600, color: "#ffffff" }}>
            {user?.username ?? "…"}
          </span>
          <span style={{ fontSize: "0.5vw", opacity: 0.8, color: "#ffffff" }}>
            {user ? `${user.sub} · ${user.department ?? "All departments"}` : ""}
          </span>
          <span style={{ fontSize: "0.5vw", opacity: 0.8, color: "#ffffff" }}>
            {user?.role ?? ""}
          </span>
        </div>
      </button>

      {/* Logout */}
      <button
        type="button"
        onClick={logout}
        style={{
          marginTop: "0.65vw",
          height: "3vw",
          borderRadius: "1vw",
          backgroundColor: COLORS.light,
          border: "none",
          color: "white",
          display: "flex",
          alignItems: "center",
          gap: "1.2vw",
          padding: "0 1.64vw",
          fontSize: "0.75vw",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <LogOut style={{ width: "1.5vw", height: "1.5vw" }} />
        Logout
      </button>
    </aside>
  );
}