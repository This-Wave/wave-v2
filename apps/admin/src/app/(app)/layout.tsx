"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../../providers/AdminAuthProvider";
import { Sidebar } from "../../components/Sidebar";
import { apiFetch } from "../../lib/api";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { accessToken, profile, isLoading } = useAdminAuth();
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [pendingShops, setPendingShops] = useState(0);

  useEffect(() => {
    if (!isLoading && (!accessToken || !profile)) {
      router.replace("/login");
    }
  }, [isLoading, accessToken, profile, router]);

  useEffect(() => {
    if (!accessToken || profile?.role !== "admin") return;
    apiFetch<{ pendingRiders: number; pendingShops: number }>("/admin/stats", accessToken)
      .then((stats) => {
        setPendingVerifications(stats.pendingRiders);
        setPendingShops(stats.pendingShops);
      })
      .catch(() => {});
  }, [accessToken, profile]);

  if (isLoading || !accessToken || !profile) {
    return <div className="flex min-h-screen items-center justify-center text-[13px] text-muted">Loading…</div>;
  }

  if (profile.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-[14px] text-ink">
          This account (<span className="font-mono text-[13px]">{profile.role}</span>) doesn&apos;t have admin
          access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar pendingVerifications={pendingVerifications} pendingShops={pendingShops} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
