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
      <table className="w-full table-auto border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-surface">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`h-10 px-4 text-[12.5px] font-bold text-ink ${
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
              <td className="px-4 py-7 text-[13.5px] text-muted" colSpan={columns.length}>
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td className="px-4 py-7 text-[13.5px] text-muted" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey(row)} className={i < rows.length - 1 ? "border-b border-border" : ""}>
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`h-12 whitespace-nowrap px-4 text-[13.5px] text-ink ${
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
          aria-pressed={active === t.key}
          className={`h-9 rounded-control border-2 px-3.5 text-[13px] font-bold ${
            active === t.key ? "border-ink bg-ink text-[#fdfcf8]" : "border-line bg-surface text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
