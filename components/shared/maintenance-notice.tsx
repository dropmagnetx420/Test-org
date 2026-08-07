import Link from "next/link";
import { Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from "@/types/database";

export function MaintenanceNotice({ settings }: { settings: SiteSettings }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="glass w-full max-w-md">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/15">
            <Wrench className="size-7 text-amber-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">Back shortly</h1>
            <p className="text-sm text-muted-foreground">
              {settings.site_name} is down for scheduled maintenance. Open positions and balances
              are safe — trading resumes as soon as we are done.
            </p>
          </div>

          {settings.support_email && (
            <p className="text-xs text-muted-foreground">
              Need something urgent?{" "}
              <a
                href={`mailto:${settings.support_email}`}
                className="text-primary hover:underline"
              >
                {settings.support_email}
              </a>
            </p>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href="/">Retry</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
