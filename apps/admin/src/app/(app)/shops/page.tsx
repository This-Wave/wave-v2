"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Button, RowAction } from "../../../components/ui/Button";
import { CreateShopModal } from "../../../components/CreateShopModal";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { approvalWait } from "@wave/shared";

interface Shop {
  id: string;
  name: string;
  category: string;
  locationText: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  owner: { id: string; fullName: string; phone: string };
  _count: { products: number; orders: number };
}

export default function ShopsPage() {
  const { accessToken } = useAdminAuth();
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<{ shops: Shop[] }>("/admin/shops", accessToken)
      .then((res) => setShops(res.shops))
      .catch(() => {
        setShops([]);
        setError("Could not load shops. Check your connection and try again.");
      });
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Approve a shop so students can see it.
   *
   * This is the whole approval mechanism for a self-registered shop owner. The
   * public `GET /shops` and `GET /shops/:id` both filter on
   * `isActive && isVerified`, and `POST /shops` leaves `isVerified` false — so
   * until this runs, an owner who signed up in the app has a real storefront
   * that no student can reach. There was no way to set the flag from anywhere
   * before this button existed.
   */
  async function approve(shop: Shop) {
    if (!accessToken) return;
    setActioning(shop.id);
    try {
      await apiFetch(`/admin/shops/${shop.id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ isVerified: true }),
      });
      load();
    } finally {
      setActioning(null);
    }
  }

  async function toggleActive(shop: Shop) {
    if (!accessToken) return;
    setActioning(shop.id);
    try {
      await apiFetch(`/admin/shops/${shop.id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !shop.isActive }),
      });
      load();
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<Shop>[] = [
    {
      header: "Shop",
      render: (s) => (
        <div>
          <div className="font-semibold">{s.name}</div>
          <div className="text-[12px] text-muted">{s.category}</div>
        </div>
      ),
    },
    {
      header: "Owner",
      render: (s) => (
        <div>
          <div>{s.owner.fullName}</div>
          <div className="text-[12px] text-muted">{s.owner.phone}</div>
        </div>
      ),
    },
    {
      header: "Location",
      render: (s) => <span className="text-muted">{s.locationText ?? "—"}</span>,
    },
    {
      header: "Products",
      width: "w-[110px]",
      render: (s) => s._count.products.toLocaleString(),
    },
    {
      header: "Orders",
      width: "w-[100px]",
      render: (s) => s._count.orders.toLocaleString(),
    },
    {
      header: "Status",
      width: "w-[210px]",
      // Verification outranks the active flag: an unverified shop is invisible
      // to students whatever `isActive` says, so showing it as "Active" would
      // tell an admin the storefront is live when it is not.
      render: (s) =>
        !s.isVerified ? (
          <StatusPill
            label={`Awaiting approval · ${approvalWait(s.createdAt).label}`}
            tone={approvalWait(s.createdAt).overdue ? "bad" : "warn"}
          />
        ) : (
          <StatusPill label={s.isActive ? "Active" : "Suspended"} tone={s.isActive ? "good" : "bad"} />
        ),
    },
    {
      header: "",
      width: "w-[110px]",
      align: "right",
      render: (s) =>
        !s.isVerified ? (
          <RowAction label="Approve" disabled={actioning === s.id} onClick={() => approve(s)} />
        ) : (
          <RowAction
            label={s.isActive ? "Suspend" : "Restore"}
            tone={s.isActive ? "danger" : "default"}
            disabled={actioning === s.id}
            onClick={() => toggleActive(s)}
          />
        ),
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Shops"
        subtitle="Directory and moderation"
        action={<Button label="Add shop" onClick={() => setCreating(true)} />}
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <CreateShopModal
        open={creating}
        accessToken={accessToken}
        onClose={() => setCreating(false)}
        onCreated={load}
        existingCategories={[...new Set((shops ?? []).map((s) => s.category).filter(Boolean))].sort()}
      />

      <DataTable columns={columns} rows={shops} rowKey={(s) => s.id} emptyMessage="No shops yet." />
    </div>
  );
}
