"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export default function ChangePasswordPage() {
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      await refreshUser();
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/";
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change your password.");
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#8FB1B8] p-4 sm:p-8">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#315F68] text-xl font-extrabold text-white">S</div>
        <p className="mt-6 text-sm font-semibold text-[#64858B]">Account security</p>
        <h1 className="mt-1 text-2xl font-bold text-[#24363B]">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-[#6B7D81]">Your temporary password must be replaced before you can continue to the Sales ERP.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold text-[#34494E]">
            Temporary password
            <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D7E0E1] px-4 py-3 text-sm outline-none focus:border-[#315F68] focus:ring-4 focus:ring-[#315F68]/10" />
          </label>
          <label className="block text-sm font-semibold text-[#34494E]">
            New password
            <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D7E0E1] px-4 py-3 text-sm outline-none focus:border-[#315F68] focus:ring-4 focus:ring-[#315F68]/10" />
          </label>
          <label className="block text-sm font-semibold text-[#34494E]">
            Confirm new password
            <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D7E0E1] px-4 py-3 text-sm outline-none focus:border-[#315F68] focus:ring-4 focus:ring-[#315F68]/10" />
          </label>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#315F68] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#264F57] disabled:cursor-wait disabled:opacity-60">
            {saving ? "Updating password…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}
