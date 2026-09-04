"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { useApiQuery } from "../../../hooks/useApiQuery";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { approvalWait } from "@wave/shared";

/** "oldest 3 days", or nothing when the queue is empty. */
function waitHint(oldestAt: string | null | undefined): string | undefined {
  if (!oldestAt) return undefined;
  const wait = approvalWait(oldestAt);
  return `oldest ${wait.label}${wait.overdue ? " — overdue" : ""}`;
}

function isOverdue(oldestAt: string | null | undefined): boolean {
  return !!oldestAt && approvalWait(oldestAt).overdue;
}

interface Stats {
  ordersToday: number;
  activeRiders: number;
  revenueToday: number;
  pendingRiders: number;
  pendingShops: number;
  oldestPendingRiderAt: string | null;
  oldestPendingShopAt: string | null;
}

interface RecentOrder {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  student?: { fullName: string } | null;
  shop?: { name: string } | null;
  checkpoint?: { name: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  en_route: "bg-success-bg text-wave-700",
  confirmed: "bg-admin-bg text-admin-text",
  rider_assigned: "bg-admin-bg text-admin-text",
  at_checkpoint: "bg-success-bg text-wave-700",
  delivered: "bg-success-bg text-wave-700",
  cancelled: "bg-danger-bg text-danger-text",
  refunded: "bg-danger-bg text-danger-text",
  pending: "bg-surface-muted text-ink",
  payment_pending: "bg-surface-muted text-ink",
};

function formatGhs(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

export default function DashboardPage() {
  const { accessToken } = useAdminAuth();
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

  return (
    <div className="px-10 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">Platform Overview</h1>
          <p className="mt-0.5 text-[13px] text-muted">Today across all Wave activity</p>
        </div>
        <span className="rounded-full bg-success-bg px-3 py-1.5 text-[11px] font-bold text-wave-700">
          Run Day Active
        </span>
      </div>

      {statsQuery.error ? (
        <FetchErrorBanner message={statsQuery.error} onRetry={statsQuery.retry} />
      ) : null}
      {ordersError ? <FetchErrorBanner message={ordersError} onRetry={loadOrders} /> : null}

      <div className="mb-8 grid grid-cols-5 gap-4">
        <StatTile label="Total Orders Today" value={stats ? String(stats.ordersToday) : "—"} />
        <StatTile label="Active Riders" value={stats ? String(stats.activeRiders) : "—"} />
        <StatTile label="Platform Revenue" value={stats ? formatGhs(Number(stats.revenueToday)) : "—"} />
        {/* A count alone reads the same on day one and day nine, so the tile
            carries the oldest wait and turns red once it passes the day the app
            promises the rider. */}
        <StatTile
          label="Pending Verifications"
          value={stats ? String(stats.pendingRiders) : "—"}
          hint={waitHint(stats?.oldestPendingRiderAt)}
          attention={!!stats && (stats.pendingRiders > 0 || isOverdue(stats.oldestPendingRiderAt))}
        />
        {/* A shop waiting here is invisible to every student, and its owner has
            no way to tell that from Wave simply having no orders. */}
        <StatTile
          label="Shops Awaiting Approval"
          value={stats ? String(stats.pendingShops) : "—"}
          hint={waitHint(stats?.oldestPendingShopAt)}
          attention={!!stats && (stats.pendingShops > 0 || isOverdue(stats.oldestPendingShopAt))}
        />
      </div>

      <h2 className="mb-3 text-[13px] font-bold text-ink">Recent Orders</h2>
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Shop</th>
              <th className="px-4 py-3 font-semibold">Checkpoint</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ordersLoading ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : ordersError ? (
              <tr>
                <td className="px-4 py-6 text-danger-text" colSpan={5}>
                  {ordersError}
                </td>
              </tr>
            ) : !orders || orders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={5}>
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order, i) => (
                <tr key={order.id} className={i < orders.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-4 py-3 font-medium text-ink">{order.student?.fullName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{order.shop?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{order.checkpoint?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-pill px-[11px] py-[5px] text-[11px] font-semibold ${STATUS_STYLE[order.status] ?? "bg-surface-muted text-ink"}`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                    {formatGhs(Number(order.totalAmount))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
      <p className={`mb-1.5 text-[11px] ${attention ? "text-danger-text" : "text-muted"}`}>{label}</p>
      <p className={`text-[24px] font-semibold tracking-tight ${attention ? "text-danger-text" : "text-ink"}`}>
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-[11px] ${attention ? "text-danger-text" : "text-muted"}`}>{hint}</p>
      ) : null}
    </div>
  );
}
