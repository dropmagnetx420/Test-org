import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { getSettings } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Logo
          size="lg"
          logoUrl={settings.logo_url}
          siteName={settings.site_name}
        />
      </Link>

      <div className="w-full max-w-md">{children}</div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Protected by rate limiting and row-level security.{" "}
        <Link href="/" className="text-primary hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
