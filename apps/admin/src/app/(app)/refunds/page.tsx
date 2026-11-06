"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, FilterTabs, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Button, RowAction } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { FormError, TextField } from "../../../components/ui/Field";
import { FOCUS_RING } from "../../../components/ui/Field";

type Status = "pending" | "approved" | "rejected" | "failed";

interface RefundRequest {
  id: string;
  status: Status;
  reason: string;
  decisionNote: string | null;
  failureDetail: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedByName: string | null;
  decidedByName: string | null;
  university: { id: string; name: string };
  order: {
    id: string;
    status: string;
    totalAmount: string;
    student: { fullName: string };
    shop: { name: string } | null;
  };
}

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "failed", label: "Paystack refused" },
  { key: "approved", label: "Refunded" },
  { key: "rejected", label: "Turned down" },
];

const TONE: Record<Status, "warn" | "good" | "bad" | "neutral"> = {
  pending: "warn",
  approved: "good",
  rejected: "neutral",
  failed: "bad",
};

/**
 * Refunds a campus admin asked for. HQ (owner, claims, accountant) approves or
 * turns them down here; a campus admin sees the same list for their campus,
 * read-only, to follow what happened to what they asked for.
 */
export default function RefundRequestsPage() {
  const { accessToken } = useAdminAuth();
  const [tab, setTab] = useState<Status>("pending");
  const [rows, setRows] = useState<RefundRequest[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<Status, number>>>({});
  const [canDecide, setCanDecide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ row: RefundRequest; decision: "approve" | "reject" } | null>(null);
  const latest = useRef(0);

  const load = useCallback(() => {
    if (!accessToken) return;
    const request = ++latest.current;
    setRows(null);
    setError(null);
    apiFetch<{ requests: RefundRequest[]; counts: Partial<Record<Status, number>>; canDecide: boolean }>(
      `/admin/refund-requests?status=${tab}`,
      accessToken,
    )
      .then((res) => {
        if (request !== latest.current) return;
        setRows(res.requests);
        setCounts(res.counts);
        setCanDecide(res.canDecide);
      })
      .catch(() => {
        if (request !== latest.current) return;
        setRows([]);
        setError("Could not load refund requests.");
      });
  }, [accessToken, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<RefundRequest>[] = [
    {
      header: "Order",
      render: (r) => (
        <div className="min-w-0">
          <Link
            href={`/orders/${r.order.id}`}
            className={`block truncate rounded-control font-semibold text-ink hover:underline ${FOCUS_RING}`}
          >
            {r.order.student.fullName} · {r.order.shop?.name ?? "Pickup"}
          </Link>
          <p className="text-[12px] text-muted">
            GH₵{Number(r.order.totalAmount).toFixed(2)} · {r.university.name}
          </p>
        </div>
      ),
    },
    {
      header: "Why",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate" title={r.reason}>
            {r.reason}
          </p>
          <p className="text-[12px] text-muted">
            Asked by {r.requestedByName ?? "a campus admin"}, {new Date(r.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      header: "Status",
      width: "w-[210px]",
      render: (r) => (
        <div className="min-w-0">
          <StatusPill label={TABS.find((t) => t.key === r.status)?.label ?? r.status} tone={TONE[r.status]} />
          {r.status !== "pending" ? (
            <p className="mt-1 truncate text-[12px] text-muted" title={r.failureDetail ?? r.decisionNote ?? undefined}>
              {r.failureDetail ?? r.decisionNote ?? (r.decidedByName ? `by ${r.decidedByName}` : "")}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      header: "",
      width: "w-[170px]",
      align: "right",
      render: (r) =>
        canDecide && (r.status === "pending" || r.status === "failed") ? (
          <div className="flex justify-end gap-4">
            <RowAction
              label={r.status === "failed" ? "Retry" : "Approve"}
              onClick={() => setDeciding({ row: r, decision: "approve" })}
            />
            <RowAction label="Turn down" tone="danger" onClick={() => setDeciding({ row: r, decision: "reject" })} />
          </div>
        ) : null,
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Refund requests"
        subtitle={
          canDecide
            ? "Campus admins ask; HQ decides. Money only moves when you approve."
            : "Refunds you've asked HQ for, and what they decided."
        }
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <FilterTabs
        tabs={TABS.map((t) => ({ ...t, label: counts[t.key] ? `${t.label} (${counts[t.key]})` : t.label }))}
        active={tab}
        onChange={setTab}
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyMessage={tab === "pending" ? "Nothing waiting." : "Nothing here."}
      />

      <DecideModal
        target={deciding}
        accessToken={accessToken}
        onClose={() => setDeciding(null)}
        onDone={() => {
          setDeciding(null);
          load();
        }}
      />
    </div>
  );
}

function DecideModal({
  target,
  accessToken,
  onClose,
  onDone,
}: {
  target: { row: RefundRequest; decision: "approve" | "reject" } | null;
  accessToken: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote("");
    setError(null);
  }, [target]);

  const approving = target?.decision === "approve";
  const amount = target ? `GH₵${Number(target.row.order.totalAmount).toFixed(2)}` : "";

  async function submit() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/refund-requests/${target.row.id}/decide`, accessToken, {
        method: "POST",
        body: JSON.stringify({ decision: target.decision, note: note.trim() || undefined }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not save the decision."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={target !== null}
      title={approving ? `Refund ${amount} to ${target?.row.order.student.fullName ?? ""}?` : "Turn this refund down"}
      description={
        approving
          ? "Paystack is asked to return the money straight away, to the card or mobile money account that paid. This can't be undone."
          : "The campus admin sees your reason. No money moves."
      }
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label={saving ? "Working…" : approving ? "Approve and refund" : "Turn down"}
            variant={approving ? "primary" : "danger"}
            disabled={saving || (!approving && note.trim().length === 0)}
            onClick={submit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-control border border-border bg-canvas p-3.5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Their reason</p>
          <p className="mt-1 text-[13.5px] text-ink">{target?.row.reason}</p>
          <p className="mt-1 text-[12px] text-muted">
            {target?.row.requestedByName ?? "Campus admin"} · {target?.row.university.name}
          </p>
        </div>
        <TextField
          label={approving ? "Note (optional)" : "Why not"}
          required={!approving}
          multiline
          value={note}
          onChange={setNote}
          placeholder={approving ? "" : "e.g. The student collected the order"}
        />
        <FormError message={error} />
      </div>
    </Modal>
  );
}
