"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";

interface OrderRow {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  student?: { fullName: string; phone: string } | null;
  shop?: { name: string } | null;
  checkpoint?: { name: string } | null;
  rider?: { fullName: string } | null;
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

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "payment_pending", label: "Payment Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rider_assigned", label: "Rider Assigned" },
  { value: "en_route", label: "En Route" },
  { value: "at_checkpoint", label: "At Checkpoint" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const PAGE_SIZE = 20;

function formatGhs(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const { accessToken } = useAdminAuth();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setOrders(null);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set("status", status);
    apiFetch<{ orders: OrderRow[]; total: number }>(`/admin/orders?${params}`, accessToken)
      .then((res) => {
        setOrders(res.orders);
        setTotal(res.total);
      })
      .catch(() => {
        setOrders([]);
        setTotal(0);
        setError("Could not load orders. Check your connection and try again.");
      });
  }, [accessToken, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="px-10 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">Orders</h1>
          <p className="mt-0.5 text-[13px] text-muted">{total} total</p>
        </div>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-control border border-border bg-surface px-3.5 py-2 text-[12px] font-semibold text-ink outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Shop</th>
              <th className="px-4 py-3 font-semibold">Checkpoint</th>
              <th className="px-4 py-3 font-semibold">Rider</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {!orders ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={7}>
                  No orders match this filter.
                </td>
              </tr>
            ) : (
              orders.map((order, i) => (
                // The whole row is the click target. Only the student cell used
                // to be a link, so clicking anywhere else on a 60px row did
                // nothing and read as broken. The <a> below stays, so the row
                // is still reachable by keyboard and still opens in a new tab.
                <tr
                  key={order.id}
                  onClick={(event) => {
                    // Let the real link handle its own clicks — following it here
                    // as well would push the same route twice.
                    if ((event.target as HTMLElement).closest("a")) return;
                    router.push(`/orders/${order.id}`);
                  }}
                  className={`cursor-pointer hover:bg-canvas ${i < orders.length - 1 ? "border-b border-border" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="block hover:opacity-80">
                      <div className="font-medium text-ink">{order.student?.fullName ?? "—"}</div>
                      <div className="font-mono text-[11px] text-muted">{order.student?.phone ?? ""}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{order.shop?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{order.checkpoint?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{order.rider?.fullName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-pill px-[11px] py-[5px] text-[11px] font-semibold ${STATUS_STYLE[order.status] ?? "bg-surface-muted text-ink"}`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink">
                    {formatGhs(Number(order.totalAmount))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="rounded-tile border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="rounded-tile border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
