"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  LayoutDashboard,
  MapPin,
  Package,
  Settings2,
  Store,
  Users,
} from "lucide-react";
import { useAdminAuth } from "../providers/AdminAuthProvider";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export function Sidebar({ pendingVerifications = 0 }: { pendingVerifications?: number }) {
  const pathname = usePathname();
  const { profile, signOut } = useAdminAuth();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/riders", label: "Riders", icon: Bike, badge: pendingVerifications },
    { href: "/shops", label: "Shops", icon: Store },
    { href: "/users", label: "Users", icon: Users },
    { href: "/checkpoints", label: "Checkpoints", icon: MapPin },
    { href: "/config", label: "Config", icon: Settings2 },
  ];

  return (
    <aside className="flex h-screen w-[220px] flex-shrink-0 flex-col border-r border-border bg-surface-subtle">
      <div className="px-5 pb-5 pt-6">
        <span className="text-[18px] font-extrabold tracking-tight text-ink">wave</span>
        <span className="ml-2 rounded-full bg-admin-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-admin-text">
          Admin
        </span>
      </div>

      <nav className="flex-1 px-2.5">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-0.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium ${
                isActive ? "bg-success-bg text-wave-700" : "text-ink hover:bg-surface-muted"
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-danger-text">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="mb-0.5 truncate text-[12px] font-semibold text-ink">{profile?.fullName ?? "Admin"}</p>
        <button onClick={() => signOut()} className="text-[11px] font-medium text-danger-text">
          Log out
        </button>
      </div>
    </aside>
  );
}
