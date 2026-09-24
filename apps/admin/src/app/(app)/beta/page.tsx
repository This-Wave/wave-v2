"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, FilterTabs, type Column } from "../../../components/ui/DataTable";
import { StatusPill, toneForStatus } from "../../../components/ui/StatusPill";
import { Button, RowAction } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { FormError, TextField } from "../../../components/ui/Field";
import { Card } from "../../../components/ui/Card";

type Status = "pending" | "approved" | "rejected" | "revoked";
type Decision = "approve" | "reject" | "revoke";

interface Application {
  id: string;
  status: Status;
  reason: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  profile: { id: string; fullName: string; role: string; riderType: string | null; createdAt: string };
}

interface Feedback {
  id: string;
  message: string;
  screen: string | null;
  appVersion: string | null;
  createdAt: string;
  profile: { id: string; fullName: string; role: string };
}

const TABS: { key: Status; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Testers" },
  { key: "rejected", label: "Not this time" },
  { key: "revoked", label: "Withdrawn" },
];

const ROLE_LABEL: Record<string, string> = { student: "Student", rider: "Rider" };

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export default function BetaPage() {
  const { accessToken, can } = useAdminAuth();
  const canReview = can("beta.review");
  const [tab, setTab] = useState<Status>("pending");
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [counts, setCounts] = useState<Partial<Record<Status, number>>>({});
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ app: Application; decision: Decision } | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  // Switching tabs quickly fires overlapping requests. Only the newest may
  // write, or a slow "Waiting" reply lands on top of the "Testers" tab.
  const latest = useRef(0);

  const load = useCallback(() => {
    if (!accessToken) return;
    const request = ++latest.current;
    setApplications(null);
    setError(null);
    apiFetch<{ applications: Application[]; counts: Partial<Record<Status, number>> }>(
      `/admin/beta?status=${tab}`,
      accessToken,
    )
      .then((res) => {
        if (request !== latest.current) return;
        setApplications(res.applications);
        setCounts(res.counts);
      })
      .catch(() => {
        if (request !== latest.current) return;
        setApplications([]);
        setError("Could not load beta applications.");
      });
    apiFetch<{ feedback: Feedback[] }>("/admin/beta/feedback", accessToken)
      .then((res) => setFeedback(res.feedback))
      .catch(() => setFeedback([]));
  }, [accessToken, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(app: Application) {
    if (!accessToken) return;
    setActioning(app.id);
    try {
      await apiFetch(`/admin/beta/${app.id}/review`, accessToken, {
        method: "POST",
        body: JSON.stringify({ decision: "approve" }),
      });
      load();
    } catch (err) {
      setError(errorMessage(err, "Could not approve."));
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<Application>[] = [
    {
      header: "Person",
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{a.profile.fullName}</p>
          <p className="text-[12px] text-muted">
            {ROLE_LABEL[a.profile.role] ?? a.profile.role}
            {a.profile.riderType ? ` · ${a.profile.riderType}` : ""} · on Wave since{" "}
            {new Date(a.profile.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      header: "Why they want in",
      render: (a) => (
        <span className="block truncate text-muted" title={a.reason ?? undefined}>
          {a.reason ?? "—"}
        </span>
      ),
    },
    {
      header: tab === "pending" ? "Applied" : "Decided",
      width: "w-[130px]",
      render: (a) => <span className="text-muted">{daysAgo(tab === "pending" ? a.createdAt : (a.reviewedAt ?? a.createdAt))}</span>,
    },
    {
      header: "Status",
      width: "w-[130px]",
      render: (a) => <StatusPill label={TABS.find((t) => t.key === a.status)?.label ?? a.status} tone={toneForStatus(a.status)} />,
    },
    {
      header: "",
      width: "w-[190px]",
      align: "right",
      render: (a) =>
        !canReview ? null : a.status === "pending" ? (
          <div className="flex justify-end gap-4">
            <RowAction label="Approve" disabled={actioning === a.id} onClick={() => approve(a)} />
            <RowAction label="Reject" tone="danger" onClick={() => setDeciding({ app: a, decision: "reject" })} />
          </div>
        ) : a.status === "approved" ? (
          <RowAction label="Withdraw access" tone="danger" onClick={() => setDeciding({ app: a, decision: "revoke" })} />
        ) : (
          <RowAction label="Approve" disabled={actioning === a.id} onClick={() => approve(a)} />
        ),
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Beta testers"
        subtitle="Students and riders who asked to try features early. Flags set to “Beta testers” on the Config page turn on for them only."
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <FilterTabs
        tabs={TABS.map((t) => ({ ...t, label: counts[t.key] ? `${t.label} (${counts[t.key]})` : t.label }))}
        active={tab}
        onChange={setTab}
      />

      <DataTable
        columns={columns}
        rows={applications}
        rowKey={(a) => a.id}
        emptyMessage={tab === "pending" ? "Nobody is waiting." : "Nobody here yet."}
      />

      <h2 className="mb-3 mt-10 text-[15px] font-semibold text-ink">What testers are saying</h2>
      {feedback === null ? (
        <p className="text-[13px] text-muted">Loading…</p>
      ) : feedback.length === 0 ? (
        <p className="text-[13px] text-muted">No feedback yet. Approved testers send it from their profile.</p>
      ) : (
        <div className="flex max-w-[860px] flex-col gap-3">
          {feedback.map((f) => (
            <Card key={f.id} className="p-5">
              <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-ink">{f.message}</p>
              <p className="mt-2 text-[12px] text-muted">
                {f.profile.fullName} · {ROLE_LABEL[f.profile.role] ?? f.profile.role}
                {f.screen ? ` · from ${f.screen}` : ""}
                {f.appVersion ? ` · v${f.appVersion}` : ""} · {new Date(f.createdAt).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}

      <DecisionModal
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

function DecisionModal({
  target,
  accessToken,
  onClose,
  onDone,
}: {
  target: { app: Application; decision: Decision } | null;
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

  const revoking = target?.decision === "revoke";

  async function submit() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/beta/${target.app.id}/review`, accessToken, {
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
      title={revoking ? `Withdraw ${target?.app.profile.fullName ?? ""}'s beta access` : `Turn down ${target?.app.profile.fullName ?? ""}`}
      description={
        revoking
          ? "Beta features disappear for them on their next request. They can't re-apply on their own."
          : "They can apply again later."
      }
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label={saving ? "Saving…" : revoking ? "Withdraw access" : "Turn down"}
            variant="danger"
            disabled={saving}
            onClick={submit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Note for them (optional)"
          multiline
          value={note}
          onChange={setNote}
          placeholder={revoking ? "e.g. We're pausing the beta for exams" : "e.g. We're full for now — try again next month"}
        />
        <FormError message={error} />
      </div>
    </Modal>
  );
}
