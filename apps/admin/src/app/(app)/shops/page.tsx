"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Button, RowAction } from "../../../components/ui/Button";

interface Shop {
  id: string;
  name: string;
  category: string;
  locationText: string | null;
  isActive: boolean;
  owner: { id: string; fullName: string; phone: string };
  _count: { products: number; orders: number };
}

export default function ShopsPage() {
  const { accessToken } = useAdminAuth();
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    apiFetch<{ shops: Shop[] }>("/admin/shops", accessToken)
      .then((res) => setShops(res.shops))
      .catch(() => setShops([]));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

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
      width: "w-[130px]",
      render: (s) => (
        <StatusPill label={s.isActive ? "Active" : "Suspended"} tone={s.isActive ? "good" : "bad"} />
      ),
    },
    {
      header: "",
      width: "w-[110px]",
      align: "right",
      render: (s) => (
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
        action={<Button label="Add shop" />}
      />
      <DataTable columns={columns} rows={shops} rowKey={(s) => s.id} emptyMessage="No shops yet." />
    </div>
  );
}
