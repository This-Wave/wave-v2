"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ phone, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[380px] rounded-[14px] border border-border bg-surface p-8 shadow-sm">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-admin-text">Wave Admin</p>
        <h1 className="mb-6 text-[22px] font-extrabold tracking-tight text-ink">Sign in</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-ink" htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 XX XXX XXXX"
              className="w-full rounded-[10px] border border-border bg-surface-muted px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-wave-500"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-ink" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[10px] border border-border bg-surface-muted px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-wave-500"
              autoComplete="current-password"
              required
            />
          </div>
          {error ? <p className="text-[12px] text-danger-text">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-[44px] rounded-[12px] bg-lime text-[14px] font-semibold text-ink disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
