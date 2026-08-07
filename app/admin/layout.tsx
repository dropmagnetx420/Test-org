import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAdmin, getWallet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/shared/site-header";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  const wallet = await getWallet();

  const supabase = await createClient();
  const [deposits, withdrawals, kyc, tasks] = await Promise.all([
    supabase
      .from("deposit_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("withdraw_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("kyc_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("task_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    <>
      <SiteHeader profile={profile} wallet={wallet} />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-primary" />
            <span className="font-medium">Admin console</span>
            <span className="text-muted-foreground">· {profile.role.replace("_", " ")}</span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            Back to app
          </Link>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <AdminNav
            badges={{
              deposits: deposits.count ?? 0,
              withdrawals: withdrawals.count ?? 0,
              kyc: kyc.count ?? 0,
              tasks: tasks.count ?? 0,
            }}
          />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}
