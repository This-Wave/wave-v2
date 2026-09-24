"use client";

import { useEffect, useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { FormError, TextField } from "./ui/Field";
import { apiFetch, errorMessage } from "../lib/api";

/**
 * A campus admin asking HQ to refund an order. Nothing moves here: the request
 * lands in HQ's Refund requests queue, and an owner, claims officer or
 * accountant decides.
 */
export function RequestRefundModal({
  open,
  orderId,
  accessToken,
  onClose,
  onRequested,
}: {
  open: boolean;
  orderId: string;
  accessToken: string;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/admin/refund-requests", accessToken, {
        method: "POST",
        body: JSON.stringify({ orderId, reason: reason.trim() }),
      });
      onRequested();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not send the request."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Ask HQ to refund this order"
      description="HQ reviews every campus refund. The student's money only moves once an owner, claims officer or accountant approves it."
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button label={saving ? "Sending…" : "Send to HQ"} disabled={saving || reason.trim().length < 5} onClick={submit} />
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Why should this be refunded?"
          required
          multiline
          value={reason}
          onChange={setReason}
          placeholder="e.g. The shop was closed when the rider arrived, and the student was charged."
        />
        <FormError message={error} />
      </div>
    </Modal>
  );
}
