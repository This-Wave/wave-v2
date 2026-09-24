"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  Bike,
  Building2,
  FlaskConical,
  LayoutDashboard,
  MapPin,
  Package,
  Lightbulb,
  Settings2,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { LEGAL_OPERATOR, staffRoleLabel, type Permission } from "@wave/shared";
import { useAdminAuth } from "../providers/AdminAuthProvider";
import { FOCUS_RING } from "./ui/Field";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  /** Hidden from staff roles without it. */
  permission: Permission;
}

export function Sidebar({
  pendingVerifications = 0,
  pendingShops = 0,
}: {
  pendingVerifications?: number;
  pendingShops?: number;
}) {
  const pathname = usePathname();
  const { profile, signOut, can } = useAdminAuth();

  const operate: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "ops.read" },
    { href: "/orders", label: "Orders", icon: Package, permission: "ops.read" },
    { href: "/riders", label: "Riders", icon: Bike, badge: pendingVerifications, permission: "pii.read" },
    { href: "/shops", label: "Shops", icon: Store, badge: pendingShops, permission: "ops.read" },
    { href: "/suggestions", label: "Suggested", icon: Lightbulb, permission: "ops.read" },
    { href: "/users", label: "Users", icon: Users, permission: "ops.read" },
    { href: "/checkpoints", label: "Checkpoints", icon: MapPin, permission: "ops.read" },
    { href: "/config", label: "Config", icon: Settings2, permission: "ops.read" },
  ];
  const control: NavItem[] = [
    { href: "/audit", label: "Activity log", icon: Activity, permission: "ops.read" },
    { href: "/refunds", label: "Refund requests", icon: Banknote, permission: can("refunds.approve") ? "refunds.approve" : "refunds.request" },
    { href: "/beta", label: "Beta testers", icon: FlaskConical, permission: "ops.read" },
    { href: "/campus-admins", label: "Campus admins", icon: Building2, permission: "campus_admins.manage" },
    { href: "/staff", label: "Staff", icon: ShieldCheck, permission: "staff.manage" },
  ];
  const groups = [
    { label: "Operations", items: operate.filter((i) => can(i.permission)) },
    { label: "Control", items: control.filter((i) => can(i.permission)) },
  ].filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-screen w-[232px] flex-shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-[18px] pb-[22px] pt-[26px]">
        <span className="text-[19px] font-semibold tracking-tight text-ink">wave</span>
        <span className="rounded-pill bg-admin-bg px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] text-admin-text">
          {profile?.campus ? "Campus" : "Admin"}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Admin sections">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  // The active route was marked by lime fill alone. 1.4.1 — and a
                  // screen reader had no way to tell where it was.
                  aria-current={isActive ? "page" : undefined}
                  className={`mb-[3px] flex min-h-10 items-center gap-2.5 rounded-tile px-3 py-2 text-[13.5px] font-medium ${FOCUS_RING} ${
                    isActive ? "bg-lime font-semibold text-ink" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.7}
                    aria-hidden
                    className={isActive ? "text-ink" : "text-muted"}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span
                      aria-label={`${item.badge} pending`}
                      className={`rounded-pill border px-2 py-[2px] text-[10px] font-semibold ${
                        isActive
                          ? "border-transparent bg-ink/10 text-ink"
                          : "border-danger-border bg-danger-bg text-danger-text"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-[18px] py-4">
        <p className="mb-[3px] truncate text-[12.5px] font-semibold text-ink">
          {profile?.fullName ?? "Admin"}
        </p>
        <p className="mb-1.5 text-[11px] text-muted">
          {staffRoleLabel(profile?.staffRole)}
          {profile?.campus ? ` · ${profile.campus.name}` : ""}
        </p>
        <button
          onClick={() => signOut()}
          className={`-mx-1 inline-flex min-h-[24px] items-center rounded-control px-1 text-[11px] font-medium text-danger-text ${FOCUS_RING}`}
        >
          Log out
        </button>
        <p className="mt-3 text-[10.5px] leading-4 text-muted">{LEGAL_OPERATOR}</p>
      </div>
    </aside>
  );
}
