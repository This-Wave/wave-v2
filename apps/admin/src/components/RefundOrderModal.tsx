"use client";

import { useState } from "react";
import { Modal } from "./ui/Modal";
import { apiFetch, errorMessage } from "../lib/api";

interface RefundOrderModalProps {
  open: boolean;
  orderId: string;
  accessToken: string;
  onClose: () => void;
  onRefunded: () => void;
}

export function RefundOrderModal({
  open,
  orderId,
  accessToken,
  onClose,
  onRefunded,
}: RefundOrderModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefund() {
    if (reason.trim().length < 3) {
      setError("Add a short reason — the student sees this in their order history.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ order: unknown; refundIssued: boolean }>(
        `/admin/refund/${orderId}`,
        accessToken,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      );
      onRefunded();
      onClose();
      setReason("");
    } catch (err) {
      setError(errorMessage(err, "Refund failed — check Paystack and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Refund this order"
      description="Paystack is called first. The order is only marked refunded once the money is queued back."
      onClose={() => {
        if (!loading) onClose();
      }}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-tile border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-ink disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRefund}
            disabled={loading}
            className="rounded-tile bg-danger-text px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            {loading ? "Refunding…" : "Issue refund"}
          </button>
        </div>
      }
    >
      <label className="block text-[12px] font-semibold text-ink" htmlFor="refund-reason">
        Reason
      </label>
      <textarea
        id="refund-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. Shop closed, rider could not complete pickup"
        className="mt-2 w-full rounded-control border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none"
      />
      {error ? <p className="mt-3 text-[12px] text-danger-text">{error}</p> : null}
    </Modal>
  );
}

function canRefund(order: { status: string; paidAt: string | null; goodsPaidAt: string | null }) {
  if (order.status === "refunded" || order.status === "cancelled") return false;
  return Boolean(order.paidAt || order.goodsPaidAt);
}

export { canRefund };
