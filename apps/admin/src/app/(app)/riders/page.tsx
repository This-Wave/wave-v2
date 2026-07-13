"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";

type VerificationStatus = "pending" | "approved" | "rejected";

interface Verification {
  id: string;
  idType: string;
  idNumber: string;
  idImageUrl: string;
  selfieUrl: string;
  status: VerificationStatus;
  createdAt: string;
  rider: { id: string; fullName: string; phone: string };
}

const TABS: { key: VerificationStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function RidersPage() {
  const { accessToken } = useAdminAuth();
  const [tab, setTab] = useState<VerificationStatus>("pending");
  const [verifications, setVerifications] = useState<Verification[] | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setVerifications(null);
    apiFetch<{ verifications: Verification[] }>(`/riders/admin/riders?status=${tab}`, accessToken)
      .then((res) => setVerifications(res.verifications))
      .catch(() => setVerifications([]));
  }, [accessToken, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReview(id: string, status: "approved" | "rejected") {
    if (!accessToken) return;
    setActioning(id);
    try {
      await apiFetch(`/riders/admin/riders/${id}/verify`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ status, rejectionReason: status === "rejected" ? "Did not meet requirements" : undefined }),
      });
      load();
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="px-8 py-7">
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Rider Verifications</h1>
        <p className="mt-0.5 text-[13px] text-muted">Review submitted IDs and selfies</p>
      </div>

      <div className="mb-5 inline-flex rounded-[10px] border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-[8px] px-4 py-2 text-[12px] font-semibold ${
              tab === t.key ? "bg-ink text-white" : "text-muted"
            }`}
          >
            {t.label}
            {t.key === "pending" && verifications && tab === "pending" ? ` (${verifications.length})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Rider</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Selfie</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              {tab === "pending" ? <th className="px-4 py-3 font-semibold">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {!verifications ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : verifications.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={7}>
                  No {tab} verifications.
                </td>
              </tr>
            ) : (
              verifications.map((v, i) => (
                <tr key={v.id} className={i < verifications.length - 1 ? "border-b border-surface-muted" : ""}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-wave-500 text-[11px] font-bold text-white">
                        {initials(v.rider.fullName)}
                      </div>
                      <span className="font-medium text-ink">{v.rider.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">{v.rider.phone}</td>
                  <td className="px-4 py-3 text-muted">{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="h-10 w-14 rounded-[6px] border border-border bg-surface-muted" title={v.idNumber} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-10 w-10 rounded-[6px] border border-border bg-surface-muted" />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        v.status === "approved"
                          ? "bg-success-bg text-wave-700"
                          : v.status === "rejected"
                            ? "bg-danger-bg text-danger-text"
                            : "bg-warning-bg text-warning-text"
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  {tab === "pending" ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(v.id, "rejected")}
                          disabled={actioning === v.id}
                          className="rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-danger-text disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleReview(v.id, "approved")}
                          disabled={actioning === v.id}
                          className="rounded-[8px] bg-wave-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
