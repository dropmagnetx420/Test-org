import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { KycForm } from "@/components/kyc/kyc-form";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { KycRequest } from "@/types/database";

export const metadata: Metadata = { title: "Verification" };

const DOC_LABELS: Record<string, string> = {
  national_id: "National ID card",
  passport: "Passport",
  driving_license: "Driving license",
};

export default async function KycPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("kyc_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const request = data as KycRequest | null;
  const status = profile.kyc_status;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Identity verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify once to unlock withdrawals and higher limits.
        </p>
      </header>

      {status === "approved" ? (
        <Card className="glass border-emerald-500/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">
              <BadgeCheck className="size-7" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">You&apos;re verified</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Your identity has been confirmed. Withdrawals are unlocked and your account carries
                a verified badge.
              </p>
            </div>
            <div className="mt-2 flex gap-2">
              <Button asChild variant="gradient" size="sm">
                <Link href="/wallet/withdraw">Withdraw funds</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/markets">Browse markets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : status === "pending" ? (
        <Card className="glass border-amber-500/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-amber-500/10 text-amber-400">
              <Clock className="size-7" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Verification in review</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                We received your documents
                {request &&
                  ` on ${new Date(request.created_at).toLocaleDateString("en-US", {
                    dateStyle: "medium",
                  })}`}
                . Reviews usually finish within 24 hours and you&apos;ll get a notification when
                it&apos;s done.
              </p>
            </div>
            {request && (
              <dl className="mt-2 grid gap-x-8 gap-y-1 text-left text-xs sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Document</dt>
                  <dd>{DOC_LABELS[request.document_type] ?? request.document_type}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{request.full_name}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {status === "rejected" && request && (
            <Card className="glass border-red-500/30">
              <CardHeader className="flex-row items-start gap-3 space-y-0">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-400">
                  <ShieldAlert className="size-4" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    Previous submission rejected
                    <StatusBadge status="rejected" />
                  </CardTitle>
                  <CardDescription>
                    {request.admin_note ??
                      "Your documents could not be verified. Please resubmit with clearer images."}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          )}

          <Card className="glass">
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">What you&apos;ll need</CardTitle>
                <CardDescription>
                  A government-issued ID (national ID, passport or driving license) and a live
                  selfie. Make sure the images are sharp, uncropped and glare-free.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <KycForm defaultName={profile.full_name ?? ""} />
        </>
      )}
    </div>
  );
}
