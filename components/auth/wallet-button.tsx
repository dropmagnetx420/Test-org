"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EthereumWallet } from "@supabase/auth-js";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import { SITE_NAME } from "@/lib/constants";
import { discoverWallets, type DiscoveredWallet } from "@/lib/web3/wallets";

export function WalletButton({ next = "" }: { next?: string }) {
  const router = useRouter();
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    discoverWallets().then((found) => {
      if (active) setWallets(found);
    });
    return () => {
      active = false;
    };
  }, []);

  const connect = async (w: DiscoveredWallet) => {
    setPending(w.info.rdns);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        statement: `Sign in to ${SITE_NAME}`,
        wallet: w.provider as unknown as EthereumWallet,
      });
      if (error) throw error;

      // Wallet-only accounts land with no name; give them a readable one once.
      const accounts = (await w.provider
        .request({ method: "eth_accounts" })
        .catch(() => [])) as string[];
      const address = accounts?.[0];
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && address) {
        const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
        await supabase
          .from("profiles")
          .update({ full_name: short })
          .eq("id", user.id)
          .is("full_name", null);
      }

      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.refresh();
      router.push(safeNext);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet sign-in failed.";
      if (/reject|denied|4001/i.test(message)) toast.error("Signature request was cancelled.");
      else toast.error(message);
      setPending(null);
    }
  };

  const onClick = () => {
    if (wallets.length === 0) {
      toast.error(
        "No Web3 wallet detected. Install one like MetaMask, or open this page inside your wallet's browser."
      );
      return;
    }
    if (wallets.length === 1) {
      void connect(wallets[0]);
      return;
    }
    setPicking((v) => !v);
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={onClick}
        disabled={pending !== null}
      >
        <Wallet className="size-4" />
        {pending ? "Check your wallet…" : "Continue with a Web3 wallet"}
      </Button>

      {picking && wallets.length > 1 && (
        <ul className="space-y-1.5 rounded-lg border border-border/60 bg-card/60 p-1.5">
          {wallets.map((w) => (
            <li key={w.info.rdns}>
              <button
                type="button"
                onClick={() => void connect(w)}
                disabled={pending !== null}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-secondary/60 disabled:opacity-60"
              >
                <Wallet className="size-4 text-primary" />
                <span className="font-medium">{w.info.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
