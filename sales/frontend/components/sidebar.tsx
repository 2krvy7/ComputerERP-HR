
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  { name: "Dashboard", href: "/", icon: "⌂" },
  { name: "Customer Management", href: "/customers", icon: "♙" },
  { name: "Sales Processing", href: "/quotations", icon: "▤" },
  { name: "Delivery & Returns", href: "/deliveries", icon: "⇢" },
  { name: "Billing & Collections", href: "/invoices", icon: "▧" },
  { name: "Sales Reports", href: "/reports", icon: "▥" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [hovered, setHovered] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const collapsed = !hovered;

  const handleLogout = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Logout failed.");
    }

    window.location.href = "/login";
  } catch (error) {
    console.error("Logout error:", error);
  }
};

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`sticky top-0 z-40 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-[#365f68] transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-[76px]" : "w-64"
      }`}
    >
      {/* Brand */}
      <div
        className={`flex h-[88px] shrink-0 items-center border-b border-white/10 ${
          collapsed ? "justify-center px-2" : "px-5"
        }`}
      >
        {collapsed ? (
          <span className="text-xl font-extrabold text-white">S</span>
        ) : (
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-white">
              Sales ERP
            </h1>

            <p className="mt-1 whitespace-nowrap text-[11px] font-medium text-white/70">
              Sales &amp; Customer Management
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto p-3">
        {!collapsed && (
          <p className="whitespace-nowrap px-3 pb-3 pt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">
            Main Menu
          </p>
        )}

        {menuItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-lg text-sm font-semibold transition ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${
                active
                  ? "bg-white text-[#365f68] shadow-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span
                className="flex w-6 shrink-0 items-center justify-center text-lg"
                aria-hidden="true"
              >
                {item.icon}
              </span>

              {!collapsed && (
                <span className="truncate whitespace-nowrap">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? "Log out" : undefined}
          className={`flex min-h-11 w-full items-center rounded-lg text-sm font-semibold text-red-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50 ${
            collapsed ? "justify-center px-2" : "gap-3 px-3"
          }`}
        >
          <span className="flex w-6 shrink-0 items-center justify-center text-lg">
            ↪
          </span>

          {!collapsed && (
            <span className="whitespace-nowrap">
              {loggingOut ? "Logging out..." : "Log out"}
            </span>
          )}
        </button>

        {!collapsed && (
          <p className="mt-3 whitespace-nowrap px-3 text-[10px] font-medium text-white/50">
            Sales Module ERP
          </p>
        )}
      </div>
    </aside>
  );
}
