
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authAPI, type AuthUser } from "../lib/api";
import { useAuth } from "@/contexts/auth-context";
import { getRoleName, isAdminRole } from "@/lib/roles";

type ProfileTab = "profile" | "edit" | "password";

const menuItems = [
  { name: "Dashboard", href: "/", icon: "⌂" },
  { name: "Customer Management", href: "/customers", icon: "♙" },
  { name: "Sales Processing", href: "/quotations", icon: "▤" },
  { name: "Selling Price Management", href: "/selling-prices", icon: "₱" },
  { name: "Delivery & Returns", href: "/deliveries", icon: "⇢" },
  { name: "Billing & Collections", href: "/invoices", icon: "▧" },
  { name: "Sales Reports", href: "/reports", icon: "▥" },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [hovered, setHovered] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const collapsed = !hovered;
  const profileRoleName = profile
    ? getRoleName(profile.role_id)
    : "Unknown role";

  const resetMessages = () => {
    setMessage("");
    setError("");
  };

  const handleOpenProfile = async () => {
    setProfileOpen(true);
    setActiveTab("profile");
    setProfileLoading(true);
    resetMessages();

    try {
      const data = await authAPI.getMe();

      setProfile(data);
      setUsername(data.username);
      setEmail(data.email);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your account information."
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCloseProfile = () => {
    if (saving) return;

    setProfileOpen(false);
    resetMessages();
    setActiveTab("profile");

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleUpdateProfile = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (saving) return;

    resetMessages();

    if (!username.trim() || !email.trim()) {
      setError("Username and email are required.");
      return;
    }

    setSaving(true);

    try {
      const updatedProfile = await authAPI.updateProfile({
        username: username.trim(),
        email: email.trim(),
      });

      setProfile(updatedProfile);
      setUsername(updatedProfile.username);
      setEmail(updatedProfile.email);
      setMessage("Your profile has been updated successfully.");
      setActiveTab("profile");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (saving) return;

    resetMessages();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);

    try {
      const result = await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(result.message);
      setActiveTab("profile");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change your password."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setLoggingOut(false);
    }
  };

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-sm text-[#24363B] outline-none transition focus:border-[#315F68] focus:ring-2 focus:ring-[#315F68]/10";

  const labelClass =
    "text-xs font-semibold text-[#52666B]";

  return (
    <>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`sticky top-3 z-40 my-3 ml-3 flex h-[calc(100vh-24px)] shrink-0 flex-col overflow-hidden rounded-[24px] bg-[#315F68] shadow-md transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-[72px]" : "w-[250px]"
        }`}
      >
        <div
          className={`flex h-[88px] shrink-0 items-center ${
            collapsed ? "justify-center" : "gap-3 px-5"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C5E0E1] text-lg font-extrabold text-[#315F68]">
            S
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <h1 className="whitespace-nowrap text-base font-extrabold tracking-wide text-white">
                SALES ERP
              </h1>
              <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-[#C5E0E1]">
                Sales Management
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1.5 overflow-x-hidden overflow-y-auto px-2.5 py-2">
          {menuItems
            .filter(
              (item) =>
                item.href !== "/selling-prices" ||
                isAdminRole(user?.role_id)
            )
            .map((item) => {
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
                className={`flex h-11 w-full shrink-0 items-center rounded-full text-[13px] font-semibold transition-colors duration-200 ${
                  collapsed ? "justify-center" : "gap-3.5 px-4"
                } ${
                  active
                    ? "bg-white text-[#315F68]"
                    : "text-[#F2F7F8] hover:bg-[#426F77]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center text-xl leading-none ${
                    active ? "text-[#315F68]" : "text-[#C5E0E1]"
                  }`}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="min-w-0 truncate whitespace-nowrap">
                    {item.name}
                  </span>
                )}
              </Link>
            );
            })}
        </nav>

        <div className="shrink-0 space-y-2 px-2.5 pb-4 pt-3">
          <button
            type="button"
            onClick={handleOpenProfile}
            title={collapsed ? "My Account" : undefined}
            className={`flex min-h-[58px] w-full items-center rounded-xl bg-[#527F87] text-left text-white transition-colors hover:bg-[#638F97] ${
              collapsed ? "justify-center px-0" : "gap-3 px-3"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C5E0E1] text-[#315F68]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="9" r="3" />
                <path d="M6.8 18a5.5 5.5 0 0 1 10.4 0" />
              </svg>
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate whitespace-nowrap text-xs font-bold">
                  My Account
                </p>
                <p className="mt-0.5 truncate whitespace-nowrap text-[10px] text-[#DCE7EA]">
                  Account Profile
                </p>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? "Log out" : undefined}
            className={`flex h-11 w-full items-center rounded-xl text-[13px] font-semibold text-[#DCE7EA] transition-colors hover:bg-[#426F77] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              collapsed ? "justify-center" : "gap-3.5 px-4"
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xl leading-none">
              ↪
            </span>

            {!collapsed && (
              <span className="truncate whitespace-nowrap">
                {loggingOut ? "Logging out..." : "Log out"}
              </span>
            )}
          </button>
        </div>
      </aside>

      {profileOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onMouseEnter={() => setHovered(false)}
          onClick={handleCloseProfile}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-[#315F68] px-6 py-5">
              <div>
                <h2
                  id="profile-title"
                  className="text-lg font-bold text-white"
                >
                  Account Profile
                </h2>
                <p className="mt-1 text-xs text-[#DCE7EA]">
                  Manage your account information
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseProfile}
                aria-label="Close profile"
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-white transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="flex border-b border-gray-200 bg-[#F8FAFA] px-4">
              {(
                [
                  { id: "profile", label: "Profile" },
                  { id: "edit", label: "Edit Profile" },
                  { id: "password", label: "Password" },
                ] as { id: ProfileTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    resetMessages();
                  }}
                  className={`flex-1 border-b-2 px-2 py-3 text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "border-[#315F68] text-[#315F68]"
                      : "border-transparent text-gray-500 hover:text-[#315F68]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6">
              {profileLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#DCE7EA] border-t-[#315F68]" />
                  <p className="mt-4 text-sm text-gray-500">
                    Loading account information...
                  </p>
                </div>
              ) : error && !profile ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-center">
                  <p className="text-sm font-semibold text-red-700">
                    Unable to load profile
                  </p>
                  <p className="mt-2 text-xs text-red-600">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenProfile}
                    className="mt-4 rounded-lg bg-[#315F68] px-4 py-2 text-xs font-semibold text-white hover:bg-[#426F77]"
                  >
                    Try Again
                  </button>
                </div>
              ) : profile ? (
                <>
                  {message && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs font-medium text-green-700">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                      {error}
                    </div>
                  )}

                  {activeTab === "profile" && (
                    <div>
                      <div className="mb-6 flex flex-col items-center border-b border-gray-200 pb-6">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#DCEBEC] text-3xl font-bold uppercase text-[#315F68]">
                          {profile.username?.charAt(0) || "U"}
                        </div>

                        <h3 className="mt-3 text-lg font-bold text-[#24363B]">
                          {profile.username}
                        </h3>

                        <p className="text-sm text-gray-500">
                          {profile.email}
                        </p>

                        <span className="mt-3 rounded-full bg-[#E6F0F0] px-4 py-1 text-xs font-semibold text-[#315F68]">
                          {profileRoleName}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {[
                          ["User ID", profile.user_id],
                          ["Username", profile.username],
                          ["Email", profile.email],
                          ["Role", profileRoleName],
                          ["Role ID", String(profile.role_id)],
                          ["Department ID", profile.dept_id ?? "Not assigned"],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-4"
                          >
                            <span className="text-sm text-gray-500">
                              {label}
                            </span>
                            <span className="break-all text-right text-sm font-semibold text-[#24363B]">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "edit" && (
                    <form
                      onSubmit={handleUpdateProfile}
                      className="space-y-5"
                    >
                      <div>
                        <label className={labelClass}>
                          Username
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(event) =>
                            setUsername(event.target.value)
                          }
                          maxLength={255}
                          required
                          autoComplete="username"
                          className={inputClass}
                          placeholder="Enter username"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(event) =>
                            setEmail(event.target.value)
                          }
                          maxLength={255}
                          required
                          autoComplete="email"
                          className={inputClass}
                          placeholder="Enter email address"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-lg bg-[#315F68] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#426F77] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Saving Changes..." : "Save Changes"}
                      </button>
                    </form>
                  )}

                  {activeTab === "password" && (
                    <form
                      onSubmit={handleChangePassword}
                      className="space-y-5"
                    >
                      <div>
                        <label className={labelClass}>
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(event) =>
                            setCurrentPassword(event.target.value)
                          }
                          required
                          autoComplete="current-password"
                          className={inputClass}
                          placeholder="Enter current password"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          New Password
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          minLength={8}
                          required
                          autoComplete="new-password"
                          className={inputClass}
                          placeholder="At least 8 characters"
                        />
                      </div>

                      <div>
                        <label className={labelClass}>
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          minLength={8}
                          required
                          autoComplete="new-password"
                          className={inputClass}
                          placeholder="Re-enter new password"
                        />
                      </div>

                      <p className="text-[11px] text-gray-500">
                        Your new password must contain at least 8 characters.
                      </p>

                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-lg bg-[#315F68] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#426F77] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Updating Password..." : "Change Password"}
                      </button>
                    </form>
                  )}
                </>
              ) : null}
            </div>

            <div className="flex justify-end border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={handleCloseProfile}
                disabled={saving}
                className="rounded-lg bg-[#315F68] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#426F77] disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
