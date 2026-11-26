import type { ReactNode } from "react";
import { FOCUS_RING } from "./Field";

type Variant = "primary" | "secondary" | "danger";

// v7 canvas sticker keys: a 4px bottom edge that presses down, bold caps.
const VARIANT: Record<Variant, string> = {
  primary: "border-b-4 border-lime-edge bg-lime text-[#0b2a21] active:border-b-2",
  secondary: "border-2 border-b-4 border-line bg-surface text-ink active:border-b-2",
  danger: "border-2 border-b-4 border-danger-border bg-surface text-danger-text active:border-b-2",
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
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-control px-5 py-2 text-[13px] font-bold uppercase tracking-wider disabled:opacity-50 ${FOCUS_RING} ${VARIANT[variant]}`}
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
      // v7 canvas: in-row actions are bold text links ("Remove"), green for a
      // way forward and red for a destructive one.
      className={`-my-1 inline-flex min-h-[24px] items-center rounded-control px-1 py-1 text-[13px] font-bold disabled:opacity-40 ${FOCUS_RING} ${
        tone === "danger" ? "text-danger-text" : "text-[#02833f]"
      }`}
    >
      {label}
    </button>
  );
}
