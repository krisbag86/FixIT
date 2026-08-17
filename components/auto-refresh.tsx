"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const autoRefreshConfig: Record<string, { intervalMs: number; refreshAfterReturnMs: number }> = {
  "/tickets": { intervalMs: 60_000, refreshAfterReturnMs: 30_000 },
  "/store": { intervalMs: 60_000, refreshAfterReturnMs: 30_000 },
  "/admin/tickets": { intervalMs: 30_000, refreshAfterReturnMs: 15_000 },
  "/admin/kanban": { intervalMs: 30_000, refreshAfterReturnMs: 15_000 },
  "/tickets/archive": { intervalMs: 5 * 60_000, refreshAfterReturnMs: 2 * 60_000 },
  "/admin/dashboard": { intervalMs: 2 * 60_000, refreshAfterReturnMs: 60_000 },
  "/admin/daylog": { intervalMs: 2 * 60_000, refreshAfterReturnMs: 60_000 },
  "/admin/reports": { intervalMs: 5 * 60_000, refreshAfterReturnMs: 2 * 60_000 },
  "/admin/schedule": { intervalMs: 5 * 60_000, refreshAfterReturnMs: 2 * 60_000 }
};

export function AutoRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const lastRefreshAt = useRef(Date.now());
  const config = autoRefreshConfig[pathname];

  useEffect(() => {
    if (!config) {
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
      if (Date.now() - lastRefreshAt.current >= config.refreshAfterReturnMs) {
        refresh();
      }
    };

    const interval = window.setInterval(refresh, config.intervalMs);
    document.addEventListener("visibilitychange", refreshAfterReturn);
    window.addEventListener("focus", refreshAfterReturn);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshAfterReturn);
      window.removeEventListener("focus", refreshAfterReturn);
    };
  }, [config, pathname, router]);

  return null;
}
