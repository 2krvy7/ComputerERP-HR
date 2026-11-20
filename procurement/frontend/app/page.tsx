"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate the progress bar smoothly over 4 seconds
    const start = Date.now();
    const duration = 10000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
    }, 30);

    // Redirect to /dashboard after 4 seconds
    const timer = setTimeout(() => {
      router.replace("/dashboard");
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #668d98 0%, #4b717c 100%)",
        fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
      }}
    >
      {/* Floating Card matching your Dashboard container */}
      <div
        style={{
          width: "32rem",
          maxWidth: "90vw",
          backgroundColor: "#edf2f3",
          borderRadius: "1.5rem",
          padding: "2.75rem 2.5rem",
          boxShadow: "0 20px 50px rgba(24, 42, 48, 0.25)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Top Badge / Icon matching your sidebar brand circle */}
        <div
          style={{
            width: "4rem",
            height: "4rem",
            borderRadius: "9999px",
            backgroundColor: "#d9e4e6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#365f68"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>

        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#668d98",
            marginBottom: "0.4rem",
          }}
        >
          Computer Building &amp; Retail ERP
        </span>

        <h1
          style={{
            margin: 0,
            fontSize: "1.85rem",
            fontWeight: 700,
            color: "#24363b",
            letterSpacing: "-0.02em",
          }}
        >
          Welcome to Procurement
        </h1>

        <p
          style={{
            margin: "0.65rem 0 1.75rem",
            fontSize: "0.95rem",
            color: "#5b747b",
            lineHeight: 1.5,
          }}
        >
          Preparing your workspace, suppliers, and purchase orders...
        </p>

        {/* Smooth 4-second progress bar */}
        <div
          style={{
            width: "100%",
            height: "6px",
            backgroundColor: "#d5e0e2",
            borderRadius: "9999px",
            overflow: "hidden",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: "#365f68",
              borderRadius: "9999px",
              transition: "width 50ms linear",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => router.replace("/dashboard")}
          style={{
            background: "none",
            border: "none",
            color: "#4b717c",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            padding: "0.25rem 0.5rem",
          }}
        >
          Continue to Dashboard →
        </button>
      </div>
    </div>
  );
}
