import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProfile, getSettings } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Account suspended" };
export const dynamic = "force-dynamic";

export default async function BannedPage() {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  if (!profile) redirect("/login");
  if (profile.status !== "banned") redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="glass w-full max-w-md">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-500/15">
            <ShieldX className="size-7 text-red-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">Account suspended</h1>
            <p className="text-sm text-muted-foreground">
              Your access to {settings.site_name} has been revoked. Any remaining balance is frozen
              pending review.
            </p>
          </div>

          {profile.ban_reason && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left text-sm text-red-300">
              {profile.ban_reason}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Believe this is a mistake?{" "}
            {settings.support_email ? (
              <a
                href={`mailto:${settings.support_email}?subject=Account%20review%20request`}
                className="text-primary hover:underline"
              >
                Contact {settings.support_email}
              </a>
            ) : (
              "Reach out to support with your account email."
            )}
          </p>

          <div className="flex flex-col gap-2">
            <form action={signOut}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
