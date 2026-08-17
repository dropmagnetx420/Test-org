"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Mail, Plus, Wallet, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { linkGoogle, unlinkLoginMethod, syncIdentityToProfile } from "@/lib/actions/identity";
import { truncateAddress } from "@/lib/utils";
import type { UserIdentity } from "@supabase/supabase-js";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

type IconType = React.ComponentType<{ className?: string }>;

const PROVIDER_META: Record<string, { label: string; icon: IconType }> = {
  email: { label: "Email & password", icon: Mail },
  google: { label: "Google", icon: GoogleIcon },
  web3: { label: "Wallet", icon: Wallet },
};

function meta(provider: string): { label: string; icon: IconType } {
  return (
    PROVIDER_META[provider] ?? {
      label: provider.charAt(0).toUpperCase() + provider.slice(1),
      icon: KeyRound,
    }
  );
}

function subtitle(identity: UserIdentity) {
  const data = (identity.identity_data ?? {}) as Record<string, unknown>;
  if (identity.provider === "web3") {
    const addr = [data.address, data.sub, data.wallet_address].find(
      (v): v is string => typeof v === "string" && v.startsWith("0x")
    );
    return addr ? truncateAddress(addr) : "Connected wallet";
  }
  const email = data.email;
  if (typeof email === "string") return email;
  return "Connected";
}

export function LoginMethods({ identities }: { identities: UserIdentity[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [linkPending, startLink] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasGoogle = identities.some((i) => i.provider === "google");
  const canRemove = identities.length > 1;

  // On return from a successful Google link, backfill blank profile fields and
  // clean the marker out of the URL so a refresh doesn't repeat the sync.
  useEffect(() => {
    if (searchParams.get("linked") !== "google") return;
    startLink(async () => {
      await syncIdentityToProfile();
      toast.success("Google connected — you can now sign in with Google.");
      router.replace("/profile");
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connectGoogle() {
    startLink(async () => {
      const res = await linkGoogle();
      if (res.success && res.data) window.location.href = res.data.url;
      else toast.error(res.error ?? "Could not start Google linking.");
    });
  }

  function remove(identity: UserIdentity) {
    if (!canRemove) return;
    setBusyId(identity.identity_id);
    startLink(async () => {
      const res = await unlinkLoginMethod(identity.identity_id);
      if (res.success) {
        toast.success(res.message ?? "Login method removed.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not remove that login method.");
      }
      setBusyId(null);
    });
  }

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="size-4" />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-base">Login methods</CardTitle>
          <CardDescription>
            Connect more than one so you can always get in. A wallet and a Google account both open
            the same account.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {identities.map((identity) => {
            const { label, icon: Icon } = meta(identity.provider);
            const removing = busyId === identity.identity_id;
            return (
              <li
                key={identity.identity_id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {subtitle(identity)}
                  </p>
                </div>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => remove(identity)}
                    disabled={linkPending}
                    aria-label={`Remove ${label}`}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    {removing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {!hasGoogle && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={connectGoogle}
            disabled={linkPending}
          >
            {linkPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Connect Gmail
          </Button>
        )}

        {!canRemove && (
          <p className="text-xs text-muted-foreground">
            Add a second method to be able to remove one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
