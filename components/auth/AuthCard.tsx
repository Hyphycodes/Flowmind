"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Sparkles } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { authEnabled } from "@/lib/auth/config";

const COPY = {
  login: {
    title: "Welcome back",
    sub: "See what your AI system is actually doing. Sign in to save pipelines, connect sources, and export blueprints.",
    swap: "New here?",
    swapHref: "/signup",
    swapLabel: "Create an account",
  },
  signup: {
    title: "Start building",
    sub: "Build AI systems you can inspect, remix, and ship.",
    swap: "Already have an account?",
    swapHref: "/login",
    swapLabel: "Sign in",
  },
};

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const enabled = authEnabled();
  const c = COPY[mode];
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    setBusy("google");
    setError(null);
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  };

  const magicLink = async () => {
    const sb = getBrowserSupabase();
    if (!sb || !email.trim()) return;
    setBusy("email");
    setError(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
    });
    setBusy(null);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="flow-canvas flex min-h-[100dvh] w-full items-center justify-center px-6 py-10">
      <div className="fm-fade-up w-full max-w-sm rounded-2xl p-6 glass-strong shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-ink-faint transition hover:text-ink">
          <ArrowLeft size={13} /> Back to Flowmind
        </Link>
        <div className="mb-1 font-display text-[28px] italic leading-tight text-ink">{c.title}</div>
        <p className="mb-5 text-[12.5px] leading-relaxed text-ink-dim">{c.sub}</p>

        {!enabled ? (
          <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-3 text-[12px] leading-relaxed text-ink-dim">
            Accounts aren&apos;t enabled in this deployment yet. Flowmind runs as a public demo —
            explore the builder without signing in. To turn on accounts, configure
            the Supabase Google provider and set <code className="font-mono text-[11px]">NEXT_PUBLIC_AUTH_ENABLED=true</code>.
            <Link href="/" className="mt-3 block text-violet hover:underline">Continue to the demo →</Link>
          </div>
        ) : sent ? (
          <div className="rounded-xl border border-green/25 bg-green/[0.06] p-3 text-[12.5px] leading-relaxed text-ink-dim">
            Check <span className="text-ink">{email}</span> for a sign-in link.
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => void google()}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[13px] font-medium text-[#1a1a1a] transition hover:bg-white/90 disabled:opacity-60"
            >
              {busy === "google" ? <Loader2 size={15} className="animate-spin" /> : <GoogleMark />}
              Continue with Google
            </button>

            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-faint">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-line bg-black/30 px-3 py-2.5 text-[13px] text-ink outline-none focus:border-line-strong"
            />
            <button
              onClick={() => void magicLink()}
              disabled={busy !== null || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-white/[0.04] py-2.5 text-[13px] font-medium text-ink transition hover:bg-white/[0.1] disabled:opacity-50"
            >
              {busy === "email" ? <Loader2 size={15} className="animate-spin" /> : <Mail size={14} />}
              Email me a sign-in link
            </button>

            {error && <p className="text-[11.5px] text-red">{error}</p>}
          </div>
        )}

        <p className="mt-5 text-[12px] text-ink-faint">
          {c.swap}{" "}
          <Link href={c.swapHref} className="text-violet hover:underline">{c.swapLabel}</Link>
        </p>
        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-ink-faint">
          <Sparkles size={10} className="text-violet" /> Signing in with Google does not give Flowmind your Drive — that&apos;s a separate connection.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.1-3.8 6.2-9.5 6.2-17z" />
      <path fill="#FBBC05" d="M10.5 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.9-6.1C1 16.8 0 20.3 0 24s1 7.2 2.6 10.4l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.3-4.6 2.1-8.2 2.1-6.3 0-11.6-3.7-13.5-9.1l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
