import type { Metadata } from "next";
import { REFUNDS } from "@wave/shared";
import { LegalDocView } from "../_render";

export const metadata: Metadata = {
  title: "Wave — Refund Policy",
  description: REFUNDS.description,
};

export default function RefundsPage() {
  return <LegalDocView doc={REFUNDS} />;
}
