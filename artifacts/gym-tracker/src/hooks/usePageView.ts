import { useEffect, useRef } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function usePageView(page: string) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    fetch(`${BASE}/api/analytics/pageview`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page }),
    }).catch(() => {});
  }, [page]);
}
