import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import type { UserIdentity } from "@supabase/supabase-js";
import { BadgeCheck, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordForm } from "@/components/profile/password-form";
import { LoginMethods } from "@/components/profile/login-methods";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const initials = (profile.full_name || profile.username || profile.email || "?")
    .slice(0, 2)
    .toUpperCase();
  const supabase = await createClient();
  const { data: identityData } = await supabase.auth.getUserIdentities();
  const identities = (identityData?.identities ?? []) as UserIdentity[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account details, security and verification status.
        </p>
      </header>

      <Card className="glass">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-cyan-500/20 font-mono text-lg font-semibold text-primary">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-semibold">
                {profile.full_name || profile.username || "Unnamed trader"}
              </p>
              {profile.kyc_status === "approved" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <BadgeCheck className="size-3" />
                  Verified
                </span>
              )}
              <StatusBadge status={profile.status} />
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">{profile.email}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Member since{" "}
              {new Date(profile.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center sm:gap-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Trades</dt>
              <dd className="font-mono text-base font-semibold tabular-nums sm:text-lg">
                {profile.total_trades.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Volume</dt>
              <dd className="font-mono text-base font-semibold tabular-nums sm:text-lg">
                {formatCurrency(profile.total_volume)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Won</dt>
              <dd className="font-mono text-base font-semibold tabular-nums text-emerald-400 sm:text-lg">
                {formatCurrency(profile.total_won)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ProfileForm profile={profile} />

        <div className="space-y-6">
          <PasswordForm />

          <Suspense fallback={null}>
            <LoginMethods identities={identities} />
          </Suspense>

          <Card className="glass">
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Verification</CardTitle>
                <CardDescription>
                  {profile.kyc_status === "approved"
                    ? "Your identity is verified. Withdrawals are unlocked."
                    : profile.kyc_status === "pending"
                      ? "Your documents are being reviewed."
                      : "Verify your identity to unlock withdrawals."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <StatusBadge status={profile.kyc_status} />
              {profile.kyc_status !== "approved" && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/kyc">
                    {profile.kyc_status === "pending" ? "View status" : "Start verification"}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-red-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sign out</CardTitle>
              <CardDescription>End your session on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={signOut}>
                <Button type="submit" variant="outline" className="w-full">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
