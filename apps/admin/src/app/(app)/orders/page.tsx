"use client";

import { orderRef } from "@wave/shared";
import { OrdersTable, type OrderTableRow } from "../../../components/ui/OrdersTable";
import { PageHeader } from "../../../components/ui/PageHeader";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { FOCUS_RING } from "../../../components/ui/Field";

const CHIPS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Paid" },
  { value: "en_route", label: "On the way" },
  { value: "at_checkpoint", label: "At checkpoint" },
  { value: "delivered", label: "Collected" },
  { value: "payment_pending", label: "Not paid" },
  { value: "cancelled", label: "Cancelled" },
];

/** The rows on screen as a CSV file, for a quick hand-off or a spreadsheet. */
function downloadCsv(rows: OrderRow[]) {
  const head = ["order", "student", "phone", "from", "to", "size", "status", "rider", "amount", "created"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((o) =>
    [orderRef(o.id), o.student?.fullName, o.student?.phone, o.originCheckpoint?.name ?? o.shop?.name, o.checkpoint?.name, o.packageSize, o.status, o.rider?.fullName, o.totalAmount, o.createdAt]
      .map(cell)
      .join(","),
  );
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wave-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface OrderRow extends OrderTableRow {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  student?: { fullName: string; phone: string } | null;
  shop?: { name: string } | null;
  checkpoint?: { name: string } | null;
  rider?: { fullName: string } | null;
}



const PAGE_SIZE = 20;


export default function OrdersPage() {
  const { accessToken } = useAdminAuth();
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const { profile } = useAdminAuth();
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
  const q = query.trim().toLowerCase();
  const shown = (orders ?? []).filter(
    (o) =>
      !q ||
      orderRef(o.id).toLowerCase().includes(q) ||
      (o.student?.fullName ?? "").toLowerCase().includes(q) ||
      (o.student?.phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~"),
  );

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Orders"
        subtitle={`Every delivery${profile?.campus ? ` at ${profile.campus.name}` : ""} · ${total} total`}
        action={
          <button
            type="button"
            onClick={() => downloadCsv(shown)}
            disabled={shown.length === 0}
            className={`min-h-10 rounded-control border-2 border-b-4 border-line bg-surface px-4 text-[13px] font-bold uppercase tracking-wider text-ink disabled:opacity-50 ${FOCUS_RING}`}
          >
            Export CSV
          </button>
        }
      />

      {/* v7 canvas: status as chips, then a search over what is loaded. */}
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter orders by status">
        {CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={status === c.value}
            onClick={() => handleStatusChange(c.value)}
            className={`min-h-9 rounded-control border-2 px-3.5 text-[13px] font-bold ${FOCUS_RING} ${
              status === c.value ? "border-ink bg-ink text-[#fdfcf8]" : "border-line bg-surface text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search order, student or phone"
        aria-label="Search orders"
        className={`mb-5 h-11 w-full max-w-[420px] rounded-control border-2 border-line bg-surface px-4 text-[14px] text-ink ${FOCUS_RING}`}
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      {!orders ? (
        <div className="h-48 animate-pulse rounded-card bg-surface-muted" />
      ) : shown.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-5 text-[14px] text-muted">No orders match.</p>
      ) : (
        <OrdersTable orders={shown} />
      )}

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
