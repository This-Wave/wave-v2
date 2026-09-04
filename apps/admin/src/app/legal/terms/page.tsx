import type { Metadata } from "next";
import { TERMS } from "@wave/shared";
import { LegalDocView } from "../_render";

export const metadata: Metadata = {
  title: "Wave — Terms of Service",
  description: TERMS.description,
};

export default function TermsPage() {
  return <LegalDocView doc={TERMS} />;
}
