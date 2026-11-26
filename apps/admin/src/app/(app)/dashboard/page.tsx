"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { useApiQuery } from "../../../hooks/useApiQuery";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { OrderFailures } from "../../../components/OrderFailures";
import { OrdersTable, type OrderTableRow } from "../../../components/ui/OrdersTable";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusPill } from "../../../components/ui/StatusPill";
import type { ServiceSwitchRow } from "@wave/shared";



interface Stats {
  ordersToday: number;
  deliveredToday?: number;
  ridersOnline?: number;
  weekRevenue?: number | string;
  weekOrders?: number;
  weekNewStudents?: number;
  activeRiders: number;
  revenueToday: number;
  pendingRiders: number;
  pendingShops: number;
  oldestPendingRiderAt: string | null;
  oldestPendingShopAt: string | null;
}

interface RecentOrder extends OrderTableRow {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  student?: { fullName: string } | null;
  shop?: { name: string } | null;
  checkpoint?: { name: string } | null;
}



export default function DashboardPage() {
  const { accessToken, profile } = useAdminAuth();
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const statsQuery = useApiQuery(
    () => (accessToken ? apiFetch<Stats>("/admin/stats", accessToken) : null),
    [accessToken],
    "Could not load dashboard stats.",
  );

  const loadOrders = () => {
    if (!accessToken) return;
    setOrdersLoading(true);
    setOrdersError(null);
    apiFetch<{ orders: RecentOrder[] }>("/admin/orders?limit=10", accessToken)
      .then((res) => setOrders(res.orders))
      .catch(() => {
        setOrders(null);
        setOrdersError("Could not load recent orders.");
      })
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [accessToken]);

  const stats = statsQuery.data;
  const switches = useApiQuery(
    () => (accessToken ? apiFetch<{ rows: ServiceSwitchRow[] }>("/admin/switches", accessToken) : null),
    [accessToken],
    "Could not load services.",
  );
  const state = (key: string) => {
    const row = switches.data?.rows.find((r) => r.key === key);
    return row?.hidden ? "Hidden" : row?.paused ? "Paused" : "Running";
  };
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const attention = (orders ?? []).filter((o) => o.status !== "delivered" && o.status !== "cancelled").slice(0, 8);

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Dashboard"
        subtitle={`${profile?.campus ? profile.campus.name : "All campuses"} · ${today}`}
      />

      {statsQuery.error ? <FetchErrorBanner message={statsQuery.error} onRetry={statsQuery.retry} /> : null}
      {ordersError ? <FetchErrorBanner message={ordersError} onRetry={loadOrders} /> : null}

      {/* v7 canvas: four figures, the first one inked as the headline. */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <Figure label="Orders today" value={stats ? String(stats.ordersToday) : "—"} inked />
        <Figure label="Delivered" value={stats?.deliveredToday != null ? String(stats.deliveredToday) : "—"} />
        <Figure label="Taken today" value={stats ? ghs(Number(stats.revenueToday)) : "—"} />
        <Figure
          label="Riders online"
          value={stats ? String(stats.ridersOnline ?? stats.activeRiders) : "—"}
          hint={stats && stats.pendingRiders > 0 ? `${stats.pendingRiders} waiting for verification` : undefined}
        />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <section>
          <h2 className="mb-3 text-[15px] font-bold text-ink">Needs attention</h2>
          {ordersLoading && !orders ? (
            <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
          ) : attention.length === 0 ? (
            <p className="rounded-card border border-border bg-surface p-5 text-[14px] text-muted">Nothing open right now.</p>
          ) : (
            <OrdersTable orders={attention} />
          )}
        </section>
        <aside className="space-y-6">
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-ink">Services</h2>
            <div className="rounded-card border border-border bg-surface px-4">
              {[["pickup", "Pickup & deliveries"], ["buy_for_me", "Buy for me"]].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between border-b border-border/70 py-3 last:border-b-0">
                  <span className="text-[14px] font-bold text-ink">{label}</span>
                  <StatusPill label={state(key!)} tone={state(key!) === "Running" ? "good" : state(key!) === "Paused" ? "warn" : "neutral"} />
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="text-[14px] font-bold text-ink">Today&apos;s Wave</span>
                <StatusPill label={new Date().getHours() < 12 ? "Closes 12:00" : "Closed"} tone="warn" />
              </div>
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-ink">This week</h2>
            <div className="rounded-card border border-border bg-surface p-5">
              <p className="font-display text-[30px] font-black leading-none text-ink">{stats?.weekRevenue != null ? ghs(Number(stats.weekRevenue)) : "—"}</p>
              <p className="mt-2 text-[13px] text-muted">
                {stats?.weekOrders ?? 0} orders · {stats?.weekNewStudents ?? 0} new students
              </p>
            </div>
          </section>
        </aside>
      </div>

      <div className="mt-8">
        <OrderFailures />
      </div>
    </div>
  );
}

function ghs(n: number): string {
  return `GH₵${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

/** v7 canvas stat card; `inked` is the headline figure on Sacramento. */
function Figure({ label, value, inked, hint }: { label: string; value: string; inked?: boolean; hint?: string }) {
  return (
    <div className={`rounded-card border p-5 ${inked ? "border-ink bg-ink" : "border-border bg-surface"}`}>
      <p className={`text-[13px] ${inked ? "text-[#fdfcf8]" : "text-muted"}`}>{label}</p>
      <p className={`mt-1 font-display text-[34px] font-black leading-none ${inked ? "text-[#fdfcf8]" : "text-ink"}`}>{value}</p>
      {hint ? <p className="mt-2 text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  attention,
  hint,
}: {
  label: string;
  value: string;
  attention?: boolean;
  /** Small line under the number — used for how long the oldest item has waited. */
  hint?: string;
}) {
  return (
    <div
      className={`rounded-card border p-4 ${
        attention ? "border-danger-bg bg-danger-bg" : "border-border bg-surface"
      }`}
    >
      <p className={`mb-1.5 text-[12.5px] font-bold ${attention ? "text-danger-text" : "text-ink"}`}>{label}</p>
      <p className={`text-[24px] font-display font-black ${attention ? "text-danger-text" : "text-ink"}`}>
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-[12px] ${attention ? "text-danger-text" : "text-muted"}`}>{hint}</p>
      ) : null}
    </div>
  );
}
