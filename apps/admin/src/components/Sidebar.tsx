"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  Boxes,
  Truck,
  Bike,
  Building2,
  FlaskConical,
  LayoutDashboard,
  MapPin,
  Package,
  Lightbulb,
  MessageSquare,
  Sparkles,
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

  // v7 canvas order: Operations, Growth, Control. Shops / Suggested / Beta
  // and Campus admins are kept for the roles that use them, after the
  // canvas items of their group.
  const operate: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "ops.read" },
    { href: "/orders", label: "Orders", icon: Package, permission: "ops.read" },
    { href: "/packing", label: "Packing point", icon: Boxes, permission: "hub.manage" },
    { href: "/riders", label: "Riders", icon: Bike, badge: pendingVerifications, permission: "pii.read" },
    { href: "/users", label: "Users", icon: Users, permission: "ops.read" },
    { href: "/checkpoints", label: "Checkpoints", icon: MapPin, permission: "ops.read" },
    { href: "/delivery-company", label: "Delivery company", icon: Truck, permission: "companies.manage" },
    { href: "/config", label: "Config", icon: Settings2, permission: "ops.read" },
    { href: "/shops", label: "Shops", icon: Store, badge: pendingShops, permission: "ops.read" },
    { href: "/suggestions", label: "Suggested", icon: Lightbulb, permission: "ops.read" },
  ];
  const growth: NavItem[] = [
    { href: "/growth", label: "Growth", icon: Sparkles, permission: "growth.read" },
    { href: "/messages", label: "Messages", icon: MessageSquare, permission: "messages.send" },
  ];
  const control: NavItem[] = [
    { href: "/refunds", label: "Refunds", icon: Banknote, permission: can("refunds.approve") ? "refunds.approve" : "refunds.request" },
    { href: "/audit", label: "Activity log", icon: Activity, permission: "ops.read" },
    { href: "/staff", label: "Staff", icon: ShieldCheck, permission: "staff.manage" },
    { href: "/campus-admins", label: "Campus admins", icon: Building2, permission: "campus_admins.manage" },
    { href: "/beta", label: "Beta testers", icon: FlaskConical, permission: "ops.read" },
  ];
  const groups = [
    { label: "Operations", items: operate.filter((i) => can(i.permission)) },
    { label: "Growth", items: growth.filter((i) => can(i.permission)) },
    { label: "Control", items: control.filter((i) => can(i.permission)) },
  ].filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-screen w-[240px] flex-shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-[18px] pb-[22px] pt-[26px]">
        <WaveMark />
        <span className="text-[21px] font-bold tracking-tight text-ink">wave</span>
        <span className="text-[12px] font-bold text-muted">{profile?.campus ? "Campus" : "Admin"}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Admin sections">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1.5 px-3 text-[12px] font-bold text-muted">
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
                  className={`mb-[3px] flex min-h-10 items-center gap-2.5 rounded-control px-3 py-2 text-[14px] font-bold ${FOCUS_RING} ${
                    isActive ? "bg-wash text-ink" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.7}
                    aria-hidden
                    className="text-ink"
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

      <div className="flex items-start gap-3 px-[18px] py-4">
        <span aria-hidden className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-pill bg-wash font-display text-[15px] font-black text-ink">
          {(profile?.fullName ?? "W").trim()[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
        <p className="mb-[1px] truncate text-[13px] font-bold text-ink">
          {profile?.fullName ?? "Admin"}
        </p>
        <p className="mb-1 text-[12px] text-muted">
          {staffRoleLabel(profile?.staffRole)}
          {profile?.campus ? ` · ${profile.campus.name}` : ""}
        </p>
        <button
          onClick={() => signOut()}
          className={`-mx-1 inline-flex min-h-[24px] items-center rounded-control px-1 text-[11px] font-medium text-danger-text ${FOCUS_RING}`}
        >
          Log out
        </button>
        <p className="mt-2 text-[10.5px] leading-4 text-muted">{LEGAL_OPERATOR}</p>
        </div>
      </div>
    </aside>
  );
}

/** v7 mark (logo B): lime checkpoint pin with a wave on an ink tile. */
function WaveMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#154b3e" />
      <g transform="translate(5.3 5.3) scale(0.78)">
        <path d="M24 3c-9.6 0-17.5 7.6-17.5 17C6.5 33 24 45 24 45s17.5-12 17.5-25C41.5 10.6 33.6 3 24 3z" fill="#87ea5c" />
        <path d="M12.5 21 q2.9 -4.2 5.75 0 t5.75 0 t5.75 0 t5.75 0" fill="none" stroke="#154b3e" strokeWidth="3.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
