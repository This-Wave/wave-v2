"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAdminAuth } from "../../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../../lib/api";
import { RefundOrderModal, canRefund } from "../../../../components/RefundOrderModal";

interface OrderDetail {
  id: string;
  status: string;
  orderType: string;
  totalAmount: string;
  deliveryFee: string;
  itemPrice: string | null;
  paidAt: string | null;
  goodsPaidAt: string | null;
  paystackRef: string | null;
  goodsPaystackRef: string | null;
  scheduledDate: string;
  isSpecialOrder: boolean;
  itemDescription: string;
  cancellationReason: string | null;
  createdAt: string;
  student?: { fullName: string; phone: string; studentId: string | null } | null;
  shop?: { name: string } | null;
  checkpoint?: { name: string } | null;
  rider?: { fullName: string; phone: string | null } | null;
  items: { name: string; quantity: number; unitPrice: string | null }[];
  statusHistory: {
    status: string;
    note: string | null;
    createdAt: string;
    changer: { fullName: string } | null;
  }[];
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

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { accessToken } = useAdminAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const load = useCallback(() => {
    if (!accessToken || !orderId) return;
    setError(null);
    apiFetch<{ order: OrderDetail }>(`/admin/orders/${orderId}`, accessToken)
      .then((res) => setOrder(res.order))
      .catch(() => setError("Could not load this order."));
  }, [accessToken, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="px-10 py-8">
        <Link href="/orders" className="text-[12px] font-semibold text-muted hover:text-ink">
          ← Orders
        </Link>
        <p className="mt-6 text-[13px] text-danger-text">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-10 py-8">
        <p className="text-[13px] text-muted">Loading…</p>
      </div>
    );
  }

  const refundable = canRefund(order);

  return (
    <div className="px-10 py-8">
      <Link href="/orders" className="text-[12px] font-semibold text-muted hover:text-ink">
        ← Orders
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">Order detail</h1>
          <p className="mt-1 font-mono text-[12px] text-muted">{order.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-pill px-[11px] py-[5px] text-[11px] font-semibold ${STATUS_STYLE[order.status] ?? "bg-surface-muted text-ink"}`}
          >
            {order.status.replace(/_/g, " ")}
          </span>
          {refundable && accessToken ? (
            <button
              type="button"
              onClick={() => setRefundOpen(true)}
              className="rounded-tile border border-danger-text bg-danger-bg px-4 py-2 text-[12px] font-semibold text-danger-text"
            >
              Refund
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        <DetailCard title="Student">
          <p className="font-medium text-ink">{order.student?.fullName ?? "—"}</p>
          <p className="text-[12px] text-muted">{order.student?.phone ?? "—"}</p>
          {order.student?.studentId ? (
            <p className="mt-1 font-mono text-[11px] text-muted">{order.student.studentId}</p>
          ) : null}
        </DetailCard>
        <DetailCard title="Delivery">
          <p className="text-ink">{order.checkpoint?.name ?? "—"}</p>
          <p className="text-[12px] text-muted">
            {new Date(order.scheduledDate).toLocaleDateString()}
            {order.isSpecialOrder ? " · special order" : ""}
          </p>
        </DetailCard>
        <DetailCard title="Shop">
          <p className="text-ink">{order.shop?.name ?? order.orderType.replace(/_/g, " ")}</p>
          <p className="text-[12px] text-muted">{order.itemDescription}</p>
        </DetailCard>
        <DetailCard title="Rider">
          <p className="text-ink">{order.rider?.fullName ?? "Unassigned"}</p>
          <p className="text-[12px] text-muted">{order.rider?.phone ?? ""}</p>
        </DetailCard>
      </div>

      <div className="mt-6 rounded-card border border-border bg-surface p-5">
        <h2 className="mb-3 text-[13px] font-bold text-ink">Payment</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <div>
            <dt className="text-muted">Total</dt>
            <dd className="font-mono font-semibold text-ink">{formatGhs(Number(order.totalAmount))}</dd>
          </div>
          <div>
            <dt className="text-muted">Delivery fee</dt>
            <dd className="font-mono text-ink">{formatGhs(Number(order.deliveryFee))}</dd>
          </div>
          <div>
            <dt className="text-muted">Delivery paid</dt>
            <dd className="text-ink">{order.paidAt ? new Date(order.paidAt).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Goods paid</dt>
            <dd className="text-ink">
              {order.goodsPaidAt ? new Date(order.goodsPaidAt).toLocaleString() : "—"}
            </dd>
          </div>
          {order.paystackRef ? (
            <div className="col-span-2">
              <dt className="text-muted">Paystack ref</dt>
              <dd className="font-mono text-[11px] text-ink">{order.paystackRef}</dd>
            </div>
          ) : null}
        </dl>
        {order.cancellationReason ? (
          <p className="mt-4 text-[12px] text-danger-text">Reason: {order.cancellationReason}</p>
        ) : null}
      </div>

      {order.items.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-canvas text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Unit</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={`${item.name}-${i}`} className={i < order.items.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-4 py-3 text-ink">{item.name}</td>
                  <td className="px-4 py-3 text-muted">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink">
                    {item.unitPrice ? formatGhs(Number(item.unitPrice)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {order.statusHistory.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-3 text-[13px] font-bold text-ink">Status history</h2>
          <ul className="space-y-2 text-[12px] text-muted">
            {order.statusHistory.map((row) => (
              <li key={`${row.createdAt}-${row.status}`}>
                <span className="font-semibold text-ink">{row.status.replace(/_/g, " ")}</span>
                {" · "}
                {new Date(row.createdAt).toLocaleString()}
                {row.changer?.fullName ? ` · ${row.changer.fullName}` : ""}
                {row.note ? ` — ${row.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {accessToken ? (
        <RefundOrderModal
          open={refundOpen}
          orderId={order.id}
          accessToken={accessToken}
          onClose={() => setRefundOpen(false)}
          onRefunded={load}
        />
      ) : null}
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </div>
  );
}
