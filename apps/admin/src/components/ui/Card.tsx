import type { ReactNode } from "react";

/** v5 card: radius 24, hairline border, neutral elevation. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-card border border-border bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function StatTile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-card border border-border bg-surface p-[22px] shadow-card">
      <div
        className={`text-[30px] font-semibold leading-none tracking-tight ${accent ? "text-ink" : "text-ink"}`}
      >
        {value}
      </div>
      <div className="mt-2 text-[12px] font-medium text-muted">{label}</div>
    </div>
  );
}
