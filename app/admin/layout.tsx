import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAdmin, getSettings } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/shared/site-header";
import { HeaderAccount } from "@/components/shared/header-account";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageTransition } from "@/components/shared/page-transition";
import { cn } from "@/lib/utils";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const [settings, deposits, withdrawals, kyc, tasks, support] = await Promise.all([
    getSettings(),
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
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .gt("admin_unread", 0),
  ]);

  const badges = {
    deposits: deposits.count ?? 0,
    withdrawals: withdrawals.count ?? 0,
    kyc: kyc.count ?? 0,
    tasks: tasks.count ?? 0,
    support: support.count ?? 0,
  };
  const queued = badges.deposits + badges.withdrawals + badges.kyc + badges.tasks;

  return (
    <>
      <SiteHeader siteName={settings.site_name} account={<HeaderAccount />} />

      <div className="border-b border-border/50 bg-gradient-to-r from-primary/[0.07] via-transparent to-accent/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25">
            <ShieldCheck className="size-5" />
          </span>

          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight tracking-tight">Admin console</p>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {profile.role.replace("_", " ")} · {profile.full_name ?? profile.email}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                queued > 0
                  ? "bg-amber-500/12 text-amber-400 ring-amber-500/25"
                  : "bg-emerald-500/12 text-emerald-400 ring-emerald-500/25"
              )}
            >
              {queued > 0 ? `${queued} awaiting review` : "Queue clear"}
            </span>
            <Link
              href="/dashboard"
              className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Back to app
            </Link>
          </div>
        </div>
      </div>

      {/* Sticks under the 4rem site header so the menu bar is always reachable. */}
      <div className="sticky top-16 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <AdminNav badges={badges} />
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"><PageTransition>{children}</PageTransition></main>
    </>
  );
}
