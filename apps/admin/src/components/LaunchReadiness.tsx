"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { resolveSwitch, type ServiceSwitchRow } from "@wave/shared";
import { useAdminAuth } from "../providers/AdminAuthProvider";
import { apiFetch } from "../lib/api";
import { FOCUS_RING } from "./ui/Field";

interface Payload {
  rows: (ServiceSwitchRow & { updatedAt: string })[];
  campus: string | null;
  verifiedShops: Record<string, number>;
  minShopsToOpen: number;
}

/**
 * "Buy for me hasn't launched yet", on the dashboard, with the one number the
 * decision rests on.
 *
 * Shown only while it is unlaunched, so it disappears for good the day it
 * opens. Nothing here opens anything — "enough shops" is a judgement about
 * which shops, not just how many, so the prompt points at the switch and lets
 * a person decide.
 */
export function LaunchReadiness() {
  const { accessToken } = useAdminAuth();
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    apiFetch<Payload>("/admin/switches", accessToken)
      .then(setData)
      .catch(() => setData(null));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;
  const state = resolveSwitch("buy_for_me", data.campus, data.rows);
  if (!state.hidden) return null;

  const shops = data.campus
    ? (data.verifiedShops[data.campus] ?? 0)
    : Object.values(data.verifiedShops).reduce((a, b) => a + b, 0);
  const ready = shops >= data.minShopsToOpen;
  // On the lime banner the text is the accent's label colour, which stays dark
  // in dark mode; on the plain card it is ordinary ink.
  const ink = ready ? "text-admin-text" : "text-ink";

  return (
    <div
      role="status"
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border px-5 py-4 ${
        ready ? "border-transparent bg-lime" : "border-border bg-surface"
      }`}
    >
      <div className="min-w-0">
        <p className={`text-[14px] font-semibold ${ink}`}>
          {ready ? "Buy for me is ready to open" : "Buy for me hasn't launched yet"}
        </p>
        <p className={`mt-0.5 text-[12.5px] leading-5 ${ink}`}>
          {shops} of {data.minShopsToOpen} shops verified{data.campus ? " at your campus" : ""}. Students see Pickup
          only, and shop browsing is closed until you open it.
        </p>
      </div>
      <Link
        href="/config"
        className={`shrink-0 rounded-control border px-4 py-2 text-[12.5px] font-semibold ${ready ? "border-admin-text text-admin-text" : "border-ink text-ink"} ${FOCUS_RING}`}
      >
        {ready ? "Open it" : "See the switch"}
      </Link>
    </div>
  );
}
