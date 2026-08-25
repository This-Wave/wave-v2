import type { ReactNode } from "react";
import { Card } from "./Card";

export interface Column<T> {
  header: string;
  /** Tailwind width utility, e.g. "w-[220px]". Omit to let the column flex. */
  width?: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  /** Shown when rows is an empty array. `null` rows means still loading. */
  emptyMessage: string;
}

/**
 * v5 admin table. Header band on canvas, 60px rows, hairline dividers.
 * `rows === null` renders the loading state; `[]` renders emptyMessage.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyMessage }: DataTableProps<T>) {
  return (
    <Card>
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-canvas">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`h-11 px-[22px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted ${
                  col.width ?? ""
                } ${col.align === "right" ? "text-right" : ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows === null ? (
            <tr>
              <td className="px-[22px] py-7 text-[13.5px] text-muted" colSpan={columns.length}>
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td className="px-[22px] py-7 text-[13.5px] text-muted" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey(row)} className={i < rows.length - 1 ? "border-b border-border" : ""}>
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`h-[60px] truncate px-[22px] text-[13.5px] text-ink ${
                      col.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

/** Segmented filter row used above several tables. */
export function FilterTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`h-10 rounded-control px-[18px] text-[13px] ${
            active === t.key
              ? "bg-lime font-semibold text-ink"
              : "border border-border bg-surface font-medium text-muted"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
