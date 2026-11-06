"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../providers/AdminAuthProvider";
import { apiFetch } from "../lib/api";
import { Card } from "./ui/Card";

interface Payload {
  days: number;
  delivered: number;
  unrecorded: number;
  failures: { reason: string; count: number }[];
}

/** What each category means to someone deciding what to chase. */
const LABELS: Record<string, { label: string; hint: string }> = {
  abandoned_payment: { label: "Left at payment", hint: "Never came back to pay." },
  student_cancelled: { label: "Student cancelled", hint: "Changed their mind or no longer needed it." },
  shop_rejected: { label: "Shop cancelled", hint: "Usually a stock-out." },
  admin_refunded: { label: "Refunded by admin", hint: "Someone here ended it." },
  out_of_stock: { label: "Out of stock", hint: "Recorded explicitly as a stock-out." },
  no_rider: { label: "No rider", hint: "Nobody accepted it before the run." },
};

/**
 * Why orders ended without a delivery.
 *
 * A count of cancellations says there is a problem; only the breakdown says
 * whether to chase shops about stock, riders about coverage, or Paystack about
 * dropped payments. Percentages are of *failures*, not of all orders — the
 * question this answers is "of the ones that went wrong, which kind".
 */
export function OrderFailures() {
  const { accessToken } = useAdminAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    apiFetch<Payload>("/admin/order-failures?days=30", accessToken)
      .then(setData)
      .catch(() => setError("Could not load order outcomes. Check your connection and try again."));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.failures ?? [];
  const totalFailures = rows.reduce((n, r) => n + r.count, 0) + (data?.unrecorded ?? 0);

  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">Why orders failed</h2>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">
        {data
          ? `Last ${data.days} days · ${totalFailures} failed, ${data.delivered} delivered`
          : "Last 30 days"}
      </p>

      {!data ? (
        <p role="status" aria-live="polite" className="mt-4 text-[13px] text-muted">
          {error ?? "Loading…"}
        </p>
      ) : totalFailures === 0 ? (
        <p className="mt-4 text-[13px] text-muted">
          No failed orders in this window. Nothing to chase.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {rows.map((row) => {
            const meta = LABELS[row.reason] ?? { label: row.reason, hint: "" };
            const pct = Math.round((row.count / totalFailures) * 100);
            return (
              <li key={row.reason} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">{meta.label}</p>
                  {meta.hint ? (
                    <p className="mt-0.5 text-[12.5px] text-muted">{meta.hint}</p>
                  ) : null}
                </div>
                {/* The bar repeats the number rather than replacing it — a
                    length alone is not readable to everyone, and this is a
                    figure people will quote at each other. */}
                <div className="flex w-40 items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-border">
                    <div className="h-full rounded-pill bg-ink" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-14 text-right text-[13px] tabular-nums text-ink">
                    {row.count} · {pct}%
                  </span>
                </div>
              </li>
            );
          })}

          {data.unrecorded > 0 ? (
            <li className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-ink">Not recorded</p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  Ended before outcomes were tracked, or through a path that does not set one.
                </p>
              </div>
              <span className="w-14 text-right text-[13px] tabular-nums text-muted">
                {data.unrecorded}
              </span>
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}
