import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketForm } from "@/components/admin/market-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "New market · Admin" };

export default async function NewMarketPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/markets">
            <ArrowLeft className="size-4" />
            Markets
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">New market</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save as a draft to review it first — drafts stay hidden until you set the status to open.
        </p>
      </div>

      <MarketForm />
    </div>
  );
}
