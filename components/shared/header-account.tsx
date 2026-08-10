import Link from "next/link";
import { getProfile, getWallet } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/shared/user-menu";

/**
 * Streamed separately from the header shell. `getUser()` round-trips to the
 * Supabase auth API, so awaiting it in the layout delayed the first byte of
 * every public page. Both exports share one request-cached fetch.
 */
export async function HeaderAccount() {
  const [profile, wallet] = await Promise.all([getProfile(), getWallet()]);

  if (profile) return <UserMenu profile={profile} wallet={wallet} />;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild variant="gradient" size="sm">
        <Link href="/register">Get started</Link>
      </Button>
    </>
  );
}

/** Reserves the resolved control's footprint so the header never shifts. */
export function HeaderAccountFallback() {
  return <div className="shimmer h-8 w-[6.5rem] rounded-full bg-secondary/50" aria-hidden="true" />;
}

export async function HeaderMobileAuth() {
  const profile = await getProfile();
  if (profile) return null;

  return (
    <Link
      href="/login"
      className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary/60"
    >
      Sign in
    </Link>
  );
}
