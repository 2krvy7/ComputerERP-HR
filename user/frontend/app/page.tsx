"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8010";

// Where each department's frontend runs on the presentation machine (edit the ports to match yours)
const DEPT_URLS: Record<string, string> = {
  PR: process.env.NEXT_PUBLIC_PR_URL || "http://localhost:3000",
  HR: process.env.NEXT_PUBLIC_HR_URL || "http://localhost:3001",
  IN: process.env.NEXT_PUBLIC_IN_URL || "http://localhost:3002",
  PD: process.env.NEXT_PUBLIC_PD_URL || "http://localhost:3003",
  SL: process.env.NEXT_PUBLIC_SL_URL || "http://localhost:3004",
  FN: process.env.NEXT_PUBLIC_FN_URL || "http://localhost:3005",
};

type AppUser = { UserID: string; Username: string; role: string; department: string | null };
type LoginResult = { token: string; must_change_password: boolean; user: AppUser };

const inputStyle = {
  padding: "0.7vw 1vw",
  fontSize: "0.95vw",
  borderRadius: "0.6vw",
  border: "1px solid #c9d6d9",
  outline: "none",
  color: "#24363b",
  backgroundColor: "#ffffff",
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [session, setSession] = useState<LoginResult | null>(null); // set when the password must be changed first
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Save the token here, then send the person where they belong
  function enter(token: string, user: AppUser) {
    try {
      localStorage.setItem("erp_token", token);
    } catch {}
    if (user.role === "SuperAdmin") {
      router.push("/admin");
      return;
    }
    const url = user.department ? DEPT_URLS[user.department] : undefined;
    if (!url) {
      setError("Your account has no department yet. Please ask the admin.");
      return;
    }
    // the fragment (#) is never sent to a server or written to logs
    window.location.href = `${url}/#token=${token}`;
  }

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Could not log in");
      if (data.must_change_password) setSession(data);
      else enter(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    if (newPassword !== confirm) {
      setError("The two passwords don't match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ old_password: password, new_password: newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "Could not change the password");
      enter(data.token, session.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const button = {
    border: "none",
    cursor: "pointer",
    padding: "0.75vw 1vw",
    borderRadius: "99vw",
    fontSize: "0.95vw",
    fontWeight: 600,
    backgroundColor: "#365f68",
    color: "#ffffff",
    opacity: busy ? 0.6 : 1,
  };

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
      <form
        onSubmit={session ? changePassword : login}
        style={{
          width: "26vw",
          backgroundColor: "#ffffff",
          color: "#24363b",
          borderRadius: "1.6vw",
          padding: "2.2vw",
          display: "flex",
          flexDirection: "column",
          gap: "0.9vw",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.6vw", color: "#365f68" }}>
          {session ? "Set a new password" : "Log in"}
        </h1>
        <p style={{ margin: 0, fontSize: "0.85vw", color: "#668d98" }}>
          {session
            ? "This is your first login. Choose your own password (at least 8 characters)."
            : "Computer Building & Retail ERP"}
        </p>

        {!session ? (
          <>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoFocus
              style={inputStyle}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={inputStyle}
            />
          </>
        ) : (
          <>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoFocus
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              style={inputStyle}
            />
          </>
        )}

        {error && <p style={{ margin: 0, fontSize: "0.82vw", color: "#a14646" }}>{error}</p>}

        <button type="submit" disabled={busy} style={button}>
          {busy ? "Please wait..." : session ? "Save password" : "Log in"}
        </button>
      </form>
    </div>
  );
}