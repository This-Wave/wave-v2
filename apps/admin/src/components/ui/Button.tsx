import type { ReactNode } from "react";
import { FOCUS_RING } from "./Field";

type Variant = "primary" | "secondary" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-lime text-ink",
  secondary: "border border-border bg-surface text-ink",
  danger: "border border-danger-border bg-surface text-danger-text",
};

interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  type?: "button" | "submit";
  icon?: ReactNode;
}

export function Button({
  label,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  icon,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[42px] items-center gap-2 rounded-control px-5 py-2 text-[13.5px] font-semibold disabled:opacity-50 ${FOCUS_RING} ${VARIANT[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Compact inline action used inside table rows. */
export function RowAction({
  label,
  onClick,
  tone = "default",
  disabled,
}: {
  label: string;
  onClick?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      // A bare 13px text button in a table row measured about 17px tall,
      // against 2.5.8's 24x24 minimum. The negative margin keeps the row's
      // visual density while the target itself grows.
      className={`-my-1 inline-flex min-h-[24px] items-center rounded-control px-1 py-1 text-[13px] font-semibold disabled:opacity-40 ${FOCUS_RING} ${
        tone === "danger" ? "text-danger-text" : "text-ink"
      }`}
    >
      {label}
    </button>
  );
}
