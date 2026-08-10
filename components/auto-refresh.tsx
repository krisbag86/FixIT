"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 60_000;
const REFRESH_AFTER_RETURN_MS = 30_000;
const autoRefreshPaths = new Set([
  "/tickets",
  "/tickets/archive",
  "/store",
  "/admin/dashboard",
  "/admin/tickets",
  "/admin/kanban",
  "/admin/daylog",
  "/admin/reports",
  "/admin/schedule"
]);

export function AutoRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    if (!autoRefreshPaths.has(pathname)) {
      return;
    }

    const canRefresh = () =>
      document.visibilityState === "visible" &&
      navigator.onLine &&
      !document.querySelector("details[open] form, dialog[open], form:focus-within");

    const refresh = () => {
      if (!canRefresh()) {
        return;
      }

      lastRefreshAt.current = Date.now();
      router.refresh();
    };

    const refreshAfterReturn = () => {
      if (Date.now() - lastRefreshAt.current >= REFRESH_AFTER_RETURN_MS) {
        refresh();
      }
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshAfterReturn);
    window.addEventListener("focus", refreshAfterReturn);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshAfterReturn);
      window.removeEventListener("focus", refreshAfterReturn);
    };
  }, [pathname, router]);

  return null;
}
