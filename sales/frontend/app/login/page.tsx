"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { login, loading, user } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      router.replace(user.must_change_password ? "/change-password" : destination);
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const authenticatedUser = await login(identifier.trim(), password);
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      router.replace(authenticatedUser.must_change_password ? "/change-password" : destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#8FB1B8]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/60 border-t-[#315F68]" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center overflow-y-auto bg-[#8FB1B8] p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl lg:min-h-[600px] lg:grid-cols-[1fr_1.05fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#315F68] p-10 text-white lg:flex">
          <div className="absolute -right-28 -top-20 h-80 w-80 rounded-full border-[44px] border-white/5" />
          <div className="absolute -bottom-36 -left-20 h-96 w-96 rounded-full border-[56px] border-[#C5E0E1]/10" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C5E0E1] text-xl font-extrabold text-[#315F68]">S</div>
            <div>
              <p className="text-sm font-extrabold tracking-[0.18em]">SALES ERP</p>
              <p className="mt-1 text-xs text-[#C5E0E1]">Sales Management</p>
            </div>
          </div>
          <div className="relative max-w-md py-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C5E0E1]">Sales Module</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">A clearer view of every customer relationship.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/75">Manage customers, orders, deliveries, invoices, and collections from one connected workspace.</p>
          </div>
          <p className="relative text-xs text-white/55">Secure access for authorized Admin and Staff accounts.</p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#315F68] text-xl font-extrabold text-white">S</div>
              <p className="mt-3 text-sm font-extrabold tracking-[0.16em] text-[#315F68]">SALES ERP</p>
            </div>
            <p className="text-sm font-semibold text-[#64858B]">Welcome back</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#24363B]">Sign in to your account</h2>
            <p className="mt-2 text-sm leading-6 text-[#6B7D81]">Use your username or email and password. Your account role will be applied automatically.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="identifier" className="text-sm font-semibold text-[#34494E]">Username or email</label>
                <input id="identifier" name="identifier" type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required autoFocus className="mt-2 w-full rounded-xl border border-[#D7E0E1] bg-[#FBFDFD] px-4 py-3.5 text-sm text-[#24363B] outline-none transition placeholder:text-[#9AA9AC] focus:border-[#315F68] focus:ring-4 focus:ring-[#315F68]/10" placeholder="Enter username or email" />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-semibold text-[#34494E]">Password</label>
                <input id="password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-[#D7E0E1] bg-[#FBFDFD] px-4 py-3.5 text-sm text-[#24363B] outline-none transition placeholder:text-[#9AA9AC] focus:border-[#315F68] focus:ring-4 focus:ring-[#315F68]/10" placeholder="Enter password" />
              </div>

              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#315F68] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#264F57] focus:outline-none focus:ring-4 focus:ring-[#315F68]/20 disabled:cursor-wait disabled:opacity-60">
                {submitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Signing in…</> : "Sign in"}
              </button>
            </form>

            <p className="mt-7 text-center text-xs leading-5 text-[#829195]">Admin and Staff accounts sign in through the same secure portal.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
