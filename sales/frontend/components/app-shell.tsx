"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { isAdminRole } from "@/lib/roles";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#8FB1B8]">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 shadow-lg">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#DCE7EA] border-t-[#315F68]" />
        <p className="text-sm font-medium text-[#52666B]">Restoring your session…</p>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const isPasswordChange = pathname === "/change-password";
  const isAdminOnlyRoute = pathname === "/selling-prices" || pathname.startsWith("/selling-prices/");
  const canManageSellingPrices = isAdminRole(user?.role_id);

  useEffect(() => {
    if (!loading && !user && !isLogin) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [isLogin, loading, router, user]);

  useEffect(() => {
    if (!loading && user && isLogin) {
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/";
      router.replace(user.must_change_password ? "/change-password" : destination);
    }
  }, [isLogin, loading, router, user]);

  useEffect(() => {
    if (!loading && user?.must_change_password && !isLogin && !isPasswordChange) {
      router.replace(`/change-password?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLogin, isPasswordChange, loading, pathname, router, user]);

  useEffect(() => {
    if (!loading && user && isAdminOnlyRoute && !canManageSellingPrices) {
      router.replace("/");
    }
  }, [canManageSellingPrices, isAdminOnlyRoute, loading, router, user]);

  if (loading) return <LoadingScreen />;
  if (isLogin) {
    if (user) return <LoadingScreen />;
    return <>{children}</>;
  }
  if (!user) return <LoadingScreen />;
  if (user.must_change_password && !isPasswordChange) return <LoadingScreen />;
  if (isAdminOnlyRoute && !canManageSellingPrices) return <LoadingScreen />;
  if (isPasswordChange) return <>{children}</>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#8FB1B8]">
      <Sidebar />
      <main className="m-3 ml-2 h-[calc(100vh-24px)] min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-xl bg-white">
        {children}
      </main>
    </div>
  );
}
