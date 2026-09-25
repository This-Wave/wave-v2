import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "../providers/AdminAuthProvider";
import { THEME_BOOT_SCRIPT } from "../lib/theme";

export const metadata: Metadata = {
  title: "Wave Admin",
  description: "Wave — campus delivery platform admin dashboard",
};

// Admin is auth-gated; skip static prerender so builds don't need a live session.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script below sets the theme attributes before React hydrates,
    // so the server's <html> legitimately differs from the client's.
    <html lang="en" suppressHydrationWarning>
      {/* v5 type. `next/font/google` in Next 14.2 predates Geist, so it is
          loaded as a stylesheet rather than through the font optimizer. */}
      <head>
        {/* Theme before first paint — PLAN-THEMES.md. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- the rule
            tells you to move this to pages/_document.js, which does not exist
            in the App Router; a <head> in the root layout is already the
            every-page equivalent it is asking for. */}
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
