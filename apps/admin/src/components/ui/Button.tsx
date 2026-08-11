import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-wave-500 text-white",
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
      className={`inline-flex h-[42px] items-center gap-2 rounded-control px-5 text-[13.5px] font-semibold disabled:opacity-50 ${VARIANT[variant]}`}
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
      className={`text-[13px] font-semibold disabled:opacity-40 ${
        tone === "danger" ? "text-danger-text" : "text-wave-500"
      }`}
    >
      {label}
    </button>
  );
}
