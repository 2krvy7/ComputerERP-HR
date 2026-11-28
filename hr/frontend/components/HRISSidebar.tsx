"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Contact,
  FileText,
  ClipboardList,
  Receipt,
  CalendarDays,
  BarChart3,
  CircleUser,
  LogOut,
} from "lucide-react";
import { logout, getUser } from "@/components/AuthGate";

const COLORS = {
  sidebar: "#365f68",
  light: "#668d98",
  logo: "#c0d9d9",
};

const NAV = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Employees", href: "/employees", Icon: Contact },
  { label: "Recruitment", href: "/recruitment", Icon: FileText },
  { label: "Attendance", href: "/attendance", Icon: ClipboardList },
  { label: "Leave Management", href: "/leave", Icon: CalendarDays },
  { label: "Payroll", href: "/payroll", Icon: Receipt },
  { label: "Reports", href: "/reports", Icon: BarChart3 },
];

type Props = {
  username?: string;
  userId?: string;
  role?: string;
  // Kept so pages that still pass it don't break; logout always uses AuthGate
  onLogout?: () => void;
};

export default function HRISSidebar({
  username = "Admin User",
  userId = "HR-001",
  role = "HR Administrator",
}: Props) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverUser, setHoverUser] = useState(false);
  const [hoverLogout, setHoverLogout] = useState(false);

  const [displayName, setDisplayName] = useState(username);
  const [displayRole, setDisplayRole] = useState(role);

  // Show the signed-in user's info from the session
  useEffect(() => {
    const user = getUser();
    if (!user) return;

    if (user.username) setDisplayName(user.username);
    if (user.role) setDisplayRole(user.role);
  }, []);

  const handleLogout = () => {
    logout();
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
      {/* Logo + Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65vw",
          paddingLeft: "1.04vw",
          marginBottom: "1.15vw",
        }}
      >
        <div
          style={{
            width: "2.65vw",
            height: "2.65vw",
            borderRadius: "50%",
            backgroundColor: COLORS.logo,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLORS.sidebar,
            fontSize: "0.65vw",
            fontWeight: 700,
          }}
        >
          HR
        </div>

        <span
          style={{
            fontSize: "0.85vw",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          HRIS & PAYROLL
        </span>
      </div>

      {/* Navigation */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5vw",
        }}
      >
        {NAV.map(({ label, href, Icon }) => {
          const active =
            pathname === href || pathname?.startsWith(`${href}/`);

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
                justifyContent: "center",
                fontSize: "0.75vw",
                fontWeight: 500,
                textDecoration: "none",
                color: active ? COLORS.sidebar : "white",
                backgroundColor: active
                  ? "#ffffff"
                  : hover
                    ? COLORS.light
                    : "transparent",
                transition: "background-color 0.15s",
              }}
            >
              <Icon
                style={{
                  position: "absolute",
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

      {/* Push user section to bottom */}
      <div style={{ flexGrow: 1 }} />

      {/* User Card */}
      <div
        onMouseEnter={() => setHoverUser(true)}
        onMouseLeave={() => setHoverUser(false)}
        style={{
          height: "5.2vw",
          borderRadius: "1vw",
          backgroundColor: COLORS.light,
          display: "flex",
          alignItems: "center",
          gap: "1vw",
          padding: "0 1.64vw",
          filter: hoverUser ? "brightness(1.08)" : "none",
          transition: "filter 0.15s",
        }}
      >
        <CircleUser
          style={{
            width: "1.5vw",
            height: "1.5vw",
            flexShrink: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.3,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: "0.78vw",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </span>

          <span
            style={{
              fontSize: "0.5vw",
              opacity: 0.8,
            }}
          >
            {userId}
          </span>

          <span
            style={{
              fontSize: "0.5vw",
              opacity: 0.8,
            }}
          >
            {displayRole}
          </span>
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        onMouseEnter={() => setHoverLogout(true)}
        onMouseLeave={() => setHoverLogout(false)}
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
          filter: hoverLogout ? "brightness(1.12)" : "none",
          transition: "filter 0.15s",
        }}
      >
        <LogOut
          style={{
            width: "1.5vw",
            height: "1.5vw",
          }}
        />

        Logout
      </button>
    </aside>
  );
}