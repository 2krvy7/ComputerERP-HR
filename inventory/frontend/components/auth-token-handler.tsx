
"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

export default function AuthTokenHandler({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    const params = new URLSearchParams(
      window.location.hash.slice(1)
    );

    const token = params.get("token");

    if (token) {
      sessionStorage.setItem("erp_token", token);

      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, []);

  return <>{children}</>;
}
