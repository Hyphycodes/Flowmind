import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { getCurrentUser } from "@/lib/auth/user";
import { authEnabled } from "@/lib/auth/config";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ConnectedAccounts } from "@/components/auth/ConnectedAccounts";

export default async function AccountPage() {
  const enabled = authEnabled();
  const user = enabled ? await getCurrentUser() : null;

  return (
    <PageShell title="Account" subtitle="Your profile and connected sources">
      <div className="max-w-2xl space-y-5">
        {!enabled ? (
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5 text-[13px] leading-relaxed text-ink-dim">
            Flowmind is running as a public demo — accounts aren&apos;t enabled in this deployment.
            Pipelines save locally / to the shared prototype store. To turn on accounts, enable the
            Supabase Google provider and set <code className="font-mono text-[12px]">NEXT_PUBLIC_AUTH_ENABLED=true</code>.
            <Link href="/" className="mt-3 block text-violet hover:underline">Back to the builder →</Link>
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5 text-[13px] leading-relaxed text-ink-dim">
            You&apos;re not signed in.
            <Link href="/login" className="ml-1 text-violet hover:underline">Sign in</Link> to save pipelines,
            connect Google Drive, and own your exports.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-line bg-white/[0.02] p-4">
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Profile</h2>
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet to-pink text-sm font-semibold text-white">
                    {(user.displayName ?? user.email ?? "U").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{user.displayName ?? "Flowmind user"}</div>
                  <div className="truncate text-[12px] text-ink-faint">{user.email}</div>
                </div>
                <SignOutButton />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Connected accounts</h2>
              <ConnectedAccounts />
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
