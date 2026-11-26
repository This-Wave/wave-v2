import type { ReactNode } from "react";

/** v5 card: radius 24, hairline border, neutral elevation. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-card border border-border bg-surface shadow-card ${className}`}>
      {children}
    </div>
  );
}

/** v7 canvas figure card: label, then the number in Nunito; `accent` inks it. */
export function StatTile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`flex-1 rounded-card border p-5 ${accent ? "border-ink bg-ink" : "border-border bg-surface"}`}>
      <div className={`text-[13px] ${accent ? "text-[#fdfcf8]" : "text-muted"}`}>{label}</div>
      <div className={`mt-1 font-display text-[34px] font-black leading-none ${accent ? "text-[#fdfcf8]" : "text-ink"}`}>{value}</div>
    </div>
  );
}
