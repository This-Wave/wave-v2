"use client";

import { SIZE_INFO, orderRef } from "@wave/shared";
import { OrderStatusPill } from "../../../../components/ui/StatusPill";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAdminAuth } from "../../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../../lib/api";
import { RefundOrderModal, canRefund } from "../../../../components/RefundOrderModal";
import { RequestRefundModal } from "../../../../components/RequestRefundModal";

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
  senderName?: string | null;
  senderPhone?: string | null;
  pickupNotes?: string | null;
  packageSize?: string | null;
  originCheckpoint?: { name: string } | null;
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


function formatGhs(amount: number): string {
  return `GH₵${amount.toFixed(2)}`;
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { accessToken, can } = useAdminAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<{ status: string; createdAt: string } | null>(null);
  const canRequest = can("refunds.request") && !can("refunds.issue");

  const load = useCallback(() => {
    if (!accessToken || !orderId) return;
    setError(null);
    apiFetch<{ order: OrderDetail }>(`/admin/orders/${orderId}`, accessToken)
      .then((res) => setOrder(res.order))
      .catch(() => setError("Could not load this order."));
    // Any refund already asked for, so a campus admin doesn't ask twice and HQ
    // sees one is waiting.
    if (can("refunds.request") || can("refunds.approve")) {
      apiFetch<{ requests: { status: string; createdAt: string }[] }>(
        `/admin/refund-requests?orderId=${orderId}&status=pending`,
        accessToken,
      )
        .then((res) => setOpenRequest(res.requests[0] ?? null))
        .catch(() => setOpenRequest(null));
    }
    // `can` is derived from the profile, which is stable once loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const notes = parseNotes(order.pickupNotes);
  const paidWith = order.paystackRef ? "card or MoMo" : null;
  const live = ["rider_assigned", "en_route", "at_checkpoint"].includes(order.status);
  const rows: [string, string | null | undefined][] = [
    ["Building", notes.building],
    ["Landmark", notes.landmark],
    ["Handover", notes.handover],
    ["Instructions", notes.instructions],
    ["Size", order.packageSize ? `${order.packageSize[0]!.toUpperCase()}${order.packageSize.slice(1)}${SIZE_INFO.find((x) => x.key === order.packageSize) ? ` · up to ${SIZE_INFO.find((x) => x.key === order.packageSize)!.maxKg} kg` : ""}` : null],
    ["Description", order.itemDescription],
    ["Total", formatGhs(Number(order.totalAmount))],
    ["Delivery fee", formatGhs(Number(order.deliveryFee))],
  ];

  return (
    <div className="px-10 py-8">
      <Link href="/orders" className="text-[12px] font-semibold text-muted hover:text-ink">
        ← Orders
      </Link>

      {/* v7 canvas: the reference as the title, then route and details on the
          left, timeline and actions on the right. */}
      <div className="mb-6 mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-black text-ink">{orderRef(order.id).replace(/^#/, "")}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {[order.orderType === "pickup" ? "Pickup" : "Shop order", order.paidAt ? `paid${paidWith ? ` by ${paidWith}` : ""}` : "not paid", new Date(order.createdAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })].join(" · ")}
          </p>
        </div>
        <OrderStatusPill status={order.status} />
      </div>

      {openRequest ? (
        <div role="status" className="mb-4 max-w-[720px] rounded-control border border-warning-border bg-warning-bg px-4 py-3 text-[13px] text-warning-text">
          A refund was requested on {new Date(openRequest.createdAt).toLocaleDateString()} and is waiting for HQ.{" "}
          <Link href="/refunds" className="font-semibold underline">See refund requests</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-5">
            <RoutePins
              fromLabel={order.orderType === "pickup" ? "Collect from" : "Buy at"}
              from={order.orderType === "pickup" ? [order.senderName, localPhone(order.senderPhone)].filter(Boolean).join(" · ") || "—" : (order.shop?.name ?? "—")}
              fromSub={order.originCheckpoint?.name}
              toLabel="Deliver to"
              to={[order.student?.fullName, localPhone(order.student?.phone)].filter(Boolean).join(" · ") || "—"}
              toSub={order.checkpoint?.name}
            />
          </div>
          <div className="rounded-card border border-border bg-surface px-5">
            {rows.filter(([, v]) => !!v).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border/70 py-3 text-[14px] last:border-b-0">
                <span className="text-muted">{k}</span>
                <span className="text-right font-bold text-ink">{v}</span>
              </div>
            ))}
          </div>
          {order.items.length > 0 ? (
            <div className="rounded-card border border-border bg-surface px-5">
              {order.items.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex justify-between border-b border-border/70 py-3 text-[14px] last:border-b-0">
                  <span className="text-ink">{item.quantity}× {item.name}</span>
                  <span className="text-muted">{item.unitPrice ? formatGhs(Number(item.unitPrice)) : "—"}</span>
                </div>
              ))}
            </div>
          ) : null}
          {order.paystackRef ? (
            <p className="text-[12px] text-muted">Paystack ref {order.paystackRef}{order.goodsPaystackRef ? ` · goods ${order.goodsPaystackRef}` : ""}</p>
          ) : null}
          {order.cancellationReason ? <p className="text-[13px] text-danger-text">Reason: {order.cancellationReason}</p> : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-[15px] font-bold text-ink">Timeline</h2>
            <ul className="space-y-2.5">
              {order.paidAt ? <TimelineRow label="Paid" at={order.paidAt} /> : null}
              {[...order.statusHistory].reverse().map((row) => (
                <TimelineRow
                  key={`${row.createdAt}-${row.status}`}
                  label={`${STATUS_WORDS[row.status] ?? row.status.replace(/_/g, " ")}${row.changer?.fullName && row.status === "rider_assigned" ? ` to ${row.changer.fullName}` : ""}`}
                  at={row.createdAt}
                  note={row.note}
                />
              ))}
            </ul>
          </div>

          <div className="rounded-card border border-border bg-surface p-5">
            <h2 className="mb-3 text-[15px] font-bold text-ink">Actions</h2>
            <div className="space-y-2">
              {refundable && accessToken && can("refunds.issue") ? (
                <ActionButton onClick={() => setRefundOpen(true)}>Refund</ActionButton>
              ) : null}
              {refundable && accessToken && canRequest && !openRequest ? (
                <ActionButton onClick={() => setRequestOpen(true)}>Ask HQ for a refund</ActionButton>
              ) : null}
              {live && accessToken && can("orders.force_deliver") ? (
                <ActionButton onClick={() => setForceOpen(true)}>Mark delivered without code</ActionButton>
              ) : null}
              {!refundable && !live ? <p className="text-[13px] text-muted">Nothing to do on this order.</p> : null}
            </div>
          </div>
        </aside>
      </div>

      {forceOpen && accessToken ? (
        <ForceDeliverModal
          orderId={order.id}
          accessToken={accessToken}
          onClose={() => setForceOpen(false)}
          onDone={() => {
            setForceOpen(false);
            load();
          }}
        />
      ) : null}
      {accessToken ? (
        <RefundOrderModal open={refundOpen} orderId={order.id} accessToken={accessToken} onClose={() => setRefundOpen(false)} onRefunded={load} />
      ) : null}
      {accessToken ? (
        <RequestRefundModal open={requestOpen} orderId={order.id} accessToken={accessToken} onClose={() => setRequestOpen(false)} onRequested={load} />
      ) : null}
    </div>
  );
}

const STATUS_WORDS: Record<string, string> = {
  confirmed: "Paid",
  rider_assigned: "Assigned",
  en_route: "On the way",
  at_checkpoint: "At the checkpoint",
  delivered: "Collected",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function TimelineRow({ label, at, note }: { label: string; at: string; note?: string | null }) {
  return (
    <li className="flex items-start justify-between gap-3 text-[13.5px]">
      <span className="text-ink">
        {label}
        {note ? <span className="block text-[12px] text-muted">{note}</span> : null}
      </span>
      <span className="font-bold text-ink">{new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
    </li>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 w-full rounded-control border-2 border-b-4 border-line bg-surface px-4 text-[13px] font-bold uppercase tracking-wider text-ink active:border-b-2"
    >
      {children}
    </button>
  );
}

/** Two pins joined by a dashed line: where it starts, where it goes. */
function RoutePins({ fromLabel, from, fromSub, toLabel, to, toSub }: { fromLabel: string; from: string; fromSub?: string | null; toLabel: string; to: string; toSub?: string | null }) {
  const pin = (fill: string) => (
    <svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true">
      <path d="M12 1C6 1 1.5 5.5 1.5 11.2 1.5 19 12 27 12 27s10.5-8 10.5-15.8C22.5 5.5 18 1 12 1z" fill={fill} />
      <circle cx="12" cy="11" r="3.6" fill="#fff" />
    </svg>
  );
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        {pin("#154b3e")}
        <span className="my-1 w-px flex-1 border-l-2 border-dashed border-line" />
        {pin("#87ea5c")}
      </div>
      <div className="flex flex-col justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold text-muted">{fromLabel}</p>
          <p className="text-[16px] font-bold text-ink">{from}</p>
          {fromSub ? <p className="text-[13px] text-muted">{fromSub}</p> : null}
        </div>
        <div>
          <p className="text-[12px] font-bold text-muted">{toLabel}</p>
          <p className="text-[16px] font-bold text-ink">{to}</p>
          {toSub ? <p className="text-[13px] text-muted">{toSub}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Split the Send flow's " · "-joined pickup notes back into rows. */
function parseNotes(notes?: string | null) {
  const out = { building: null as string | null, landmark: null as string | null, handover: null as string | null, instructions: null as string | null };
  if (!notes) return out;
  const rest: string[] = [];
  notes.split(" · ").map((p) => p.trim()).filter(Boolean).forEach((p, i) => {
    const m = /^(Landmark|Handover):\s*(.*)$/i.exec(p);
    if (m) {
      if (m[1]!.toLowerCase() === "landmark") out.landmark = m[2] || null;
      else out.handover = m[2] || null;
    } else if (i === 0) out.building = p;
    else rest.push(p);
  });
  out.instructions = rest.join(" · ") || null;
  return out;
}

/** "Mark delivered without code": a reason is required and kept in the log. */
function ForceDeliverModal({ orderId, accessToken, onClose, onDone }: { orderId: string; accessToken: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div role="dialog" aria-modal="true" aria-label="Mark delivered without code" className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,28,24,0.35)]">
      <div className="w-[440px] rounded-card bg-surface p-6">
        <h2 className="font-display text-[22px] font-black text-ink">Mark delivered without code?</h2>
        <p className="mt-1 text-[13px] text-muted">Only when the student has the parcel and the code failed. Your reason goes in the activity log.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Student showed their ID at the checkpoint; SMS never arrived."
          className="mt-4 w-full rounded-control border-2 border-line p-3 text-[14px] text-ink"
        />
        {err ? <p className="mt-2 text-[13px] text-danger-text">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-10 rounded-control border-2 border-line px-4 text-[13px] font-bold uppercase tracking-wider text-ink">Cancel</button>
          <button
            type="button"
            disabled={reason.trim().length < 10 || busy}
            onClick={() => {
              setBusy(true);
              setErr(null);
              apiFetch(`/admin/orders/${orderId}/force-deliver`, accessToken, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) })
                .then(onDone)
                .catch((e) => setErr(errorMessage(e, "Couldn't mark it delivered.")))
                .finally(() => setBusy(false));
            }}
            className="min-h-10 rounded-control border-b-4 border-lime-edge bg-lime px-4 text-[13px] font-bold uppercase tracking-wider text-[#0b2a21] disabled:opacity-50"
          >
            {busy ? "Saving" : "Mark delivered"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "+233245550101" → "024 555 0101". */
function localPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("233") ? `0${d.slice(3)}` : d;
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : phone;
}
