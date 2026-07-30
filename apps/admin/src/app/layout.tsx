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
      {/* v5 type. `next/font/google` in Next 14.2 predates Geist, so it is
          loaded as a stylesheet rather than through the font optimizer. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-canvas font-sans text-ink">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
