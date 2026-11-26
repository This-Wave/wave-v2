"use client";

import Link from "next/link";
import { orderRef } from "@wave/shared";
import { OrderStatusPill } from "./StatusPill";

export interface OrderTableRow {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  orderType?: string;
  packageSize?: string | null;
  student?: { fullName: string; phone?: string } | null;
  shop?: { name: string } | null;
  checkpoint?: { name: string } | null;
  originCheckpoint?: { name: string } | null;
  rider?: { fullName: string } | null;
}

/** "Kwame Asante" → "Kwame A.", as the canvas tables show riders. */
function shortName(name?: string | null): string {
  if (!name) return "—";
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first!;
}

function route(o: OrderTableRow): string {
  const from = o.orderType === "pickup" ? (o.originCheckpoint?.name ?? "Accra").split(/ & |,/)[0] : (o.shop?.name ?? "Shop");
  return `${from} → ${o.checkpoint?.name ?? "—"}`;
}

/**
 * v7 canvas orders table: Order, Student, Route, Size, Status, Rider, Amount.
 * Each row opens the order.
 */
export function OrdersTable({ orders }: { orders: OrderTableRow[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border text-[12.5px] font-bold text-ink">
            {["Order", "Student", "Route", "Size", "Status", "Rider", "Amount"].map((h) => (
              <th key={h} className="h-10 px-3 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="whitespace-nowrap border-b border-border/70 text-[13.5px] text-ink last:border-b-0 hover:bg-canvas">
              <td className="h-12 px-3">
                <Link href={`/orders/${o.id}`} className="font-bold underline-offset-2 hover:underline">
                  {orderRef(o.id).replace(/^#/, "")}
                </Link>
              </td>
              <td className="px-3">{o.student?.fullName ?? "—"}</td>
              <td className="px-3">{route(o)}</td>
              <td className="px-3">{o.packageSize ? o.packageSize[0]!.toUpperCase() + o.packageSize.slice(1) : "—"}</td>
              <td className="px-3"><OrderStatusPill status={o.status} /></td>
              <td className="px-3">{shortName(o.rider?.fullName)}</td>
              <td className="px-3">GH₵{Number(o.totalAmount ?? 0).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
