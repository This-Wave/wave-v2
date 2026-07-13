import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "../providers/AdminAuthProvider";

export const metadata: Metadata = {
  title: "Wave Admin",
  description: "Wave — campus delivery platform admin dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-muted text-ink">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
