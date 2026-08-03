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
    <aside className="flex h-screen w-[232px] flex-shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-[18px] pb-[22px] pt-[26px]">
        <span className="text-[19px] font-semibold tracking-tight text-ink">wave</span>
        <span className="rounded-pill bg-admin-bg px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] text-admin-text">
          Admin
        </span>
      </div>

      <nav className="flex-1 px-3">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-[3px] flex h-10 items-center gap-2.5 rounded-tile px-3 text-[13.5px] font-medium ${
                isActive ? "bg-wave-500 text-white" : "text-ink hover:bg-canvas"
              }`}
            >
              <Icon size={17} strokeWidth={1.7} className={isActive ? "text-white" : "text-muted"} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span
                  className={`rounded-pill border px-2 py-[2px] text-[10px] font-semibold ${
                    isActive
                      ? "border-transparent bg-white/20 text-white"
                      : "border-danger-border bg-danger-bg text-danger-text"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-[18px] py-4">
        <p className="mb-[3px] truncate text-[12.5px] font-semibold text-ink">
          {profile?.fullName ?? "Admin"}
        </p>
        <button onClick={() => signOut()} className="text-[11px] font-medium text-danger-text">
          Log out
        </button>
      </div>
    </aside>
  );
}
