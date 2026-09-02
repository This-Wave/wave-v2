import type { Metadata } from "next";
import { PRIVACY } from "@wave/shared";
import { LegalDocView } from "../_render";

export const metadata: Metadata = {
  title: "Wave — Privacy Policy",
  description: PRIVACY.description,
};

export default function PrivacyPage() {
  return <LegalDocView doc={PRIVACY} />;
}
