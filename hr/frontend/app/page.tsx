"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Change these to match HR's theme
const COLORS = {
  bgFrom: "#7a74b8",
  bgTo: "#5a5499",
  card: "#f0eff8",
  badge: "#dedcf0",
  icon: "#3f3a7a",
  label: "#7a74b8",
  title: "#2a2650",
  text: "#5f5b86",
  track: "#d9d7ec",
  bar: "#3f3a7a",
  link: "#5a5499",
};

const REDIRECT_TO = "/dashboard";
const DURATION = 5000;

export default function Home() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / DURATION) * 100, 100));
    }, 30);

    const timer = setTimeout(() => {
      router.replace(REDIRECT_TO);
    }, DURATION);

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
        background: `linear-gradient(135deg, ${COLORS.bgFrom} 0%, ${COLORS.bgTo} 100%)`,
        fontFamily: "var(--font-geist-sans), Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "32rem",
          maxWidth: "90vw",
          backgroundColor: COLORS.card,
          borderRadius: "1.5rem",
          padding: "2.75rem 2.5rem",
          boxShadow: "0 20px 50px rgba(30, 27, 70, 0.28)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Badge with people icon */}
        <div
          style={{
            width: "4rem",
            height: "4rem",
            borderRadius: "9999px",
            backgroundColor: COLORS.badge,
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
            stroke={COLORS.icon}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.label,
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
            color: COLORS.title,
            letterSpacing: "-0.02em",
          }}
        >
          Welcome to Human Resources
        </h1>

        <p
          style={{
            margin: "0.65rem 0 1.75rem",
            fontSize: "0.95rem",
            color: COLORS.text,
            lineHeight: 1.5,
          }}
        >
          Preparing your employees, attendance, and payroll...
        </p>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: "6px",
            backgroundColor: COLORS.track,
            borderRadius: "9999px",
            overflow: "hidden",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: COLORS.bar,
              borderRadius: "9999px",
              transition: "width 50ms linear",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => router.replace(REDIRECT_TO)}
          style={{
            background: "none",
            border: "none",
            color: COLORS.link,
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