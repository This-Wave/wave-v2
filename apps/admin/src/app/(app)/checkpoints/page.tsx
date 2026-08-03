"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Button, RowAction } from "../../../components/ui/Button";

interface Checkpoint {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: { orders: number };
}

export default function CheckpointsPage() {
  const { accessToken } = useAdminAuth();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    apiFetch<{ checkpoints: Checkpoint[] }>("/admin/checkpoints", accessToken)
      .then((res) => setCheckpoints(res.checkpoints))
      .catch(() => setCheckpoints([]));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(cp: Checkpoint) {
    if (!accessToken) return;
    setActioning(cp.id);
    try {
      await apiFetch(`/checkpoints/${cp.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ isActive: !cp.isActive }),
      });
      load();
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<Checkpoint>[] = [
    {
      header: "Checkpoint",
      render: (cp) => <span className="font-semibold">{cp.name}</span>,
    },
    {
      header: "Location detail",
      width: "w-[34%]",
      render: (cp) => <span className="text-muted">{cp.description ?? "—"}</span>,
    },
    {
      header: "Orders routed",
      width: "w-[140px]",
      render: (cp) => cp._count.orders.toLocaleString(),
    },
    {
      header: "Status",
      width: "w-[130px]",
      render: (cp) => (
        <StatusPill label={cp.isActive ? "Active" : "Inactive"} tone={cp.isActive ? "good" : "neutral"} />
      ),
    },
    {
      header: "",
      width: "w-[130px]",
      align: "right",
      render: (cp) => (
        <RowAction
          label={cp.isActive ? "Deactivate" : "Reactivate"}
          tone={cp.isActive ? "danger" : "default"}
          disabled={actioning === cp.id}
          onClick={() => toggleActive(cp)}
        />
      ),
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Checkpoints"
        subtitle="Campus drop-off points"
        action={<Button label="Add checkpoint" />}
      />

      <DataTable
        columns={columns}
        rows={checkpoints}
        rowKey={(cp) => cp.id}
        emptyMessage="No checkpoints yet."
      />

      <div className="mt-5 flex max-w-[720px] gap-3 rounded-control border border-border bg-surface p-4">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="9" stroke="#6B7D63" strokeWidth="1.7" />
          <path d="M12 11v5.5M12 7.8v.4" stroke="#6B7D63" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        <p className="text-[12.5px] leading-5 text-muted">
          A checkpoint with past orders is deactivated, never deleted — historical orders keep pointing
          at it.
        </p>
      </div>
    </div>
  );
}
