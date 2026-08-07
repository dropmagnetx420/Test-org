"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpFromLine, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { submitWithdrawal } from "@/lib/actions/wallet";
import { ASSETS_BY_NETWORK, NETWORKS, type NetworkValue } from "@/lib/constants";
import { formatCurrency, isValidEvmAddress, toNumber } from "@/lib/utils";
import type { ActionResult } from "@/types/database";

interface WithdrawFormProps {
  available: string;
  bonus: string;
  turnoverRequired: string;
  turnoverCompleted: string;
  minWithdrawal: string;
  feePercent: string;
  kycRequired: boolean;
  kycStatus: string;
}

export function WithdrawForm({
  available,
  bonus,
  turnoverRequired,
  turnoverCompleted,
  minWithdrawal,
  feePercent,
  kycRequired,
  kycStatus,
}: WithdrawFormProps) {
  const [network, setNetwork] = useState<NetworkValue>("robinhood");
  const [asset, setAsset] = useState("USDG");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    submitWithdrawal,
    null
  );

  const assets = ASSETS_BY_NETWORK[network];

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success(state.message ?? "Withdrawal requested.");
  }, [state]);

  const [seen, setSeen] = useState<ActionResult | null>(null);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) {
      setAmount("");
      setAddress("");
    }
  }

  function onNetworkChange(value: string) {
    const next = value as NetworkValue;
    setNetwork(next);
    const validAssets = ASSETS_BY_NETWORK[next];
    if (!validAssets.includes(asset)) setAsset(validAssets[0]);
  }

  const availableNum = toNumber(available);
  const minNum = toNumber(minWithdrawal);
  const required = toNumber(turnoverRequired);
  const completed = toNumber(turnoverCompleted);
  const value = toNumber(amount);
  const fee = (value * toNumber(feePercent)) / 100;
  const net = Math.max(0, value - fee);

  const kycBlocked = kycRequired && kycStatus !== "approved";
  const turnoverBlocked = required > 0 && completed < required;
  const insufficient = value > availableNum;
  const belowMin = value > 0 && value < minNum;
  const badAddress = address.length > 0 && !isValidEvmAddress(address);
  const canSubmit =
    !kycBlocked && value > 0 && !insufficient && !belowMin && isValidEvmAddress(address);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="glass-strong">
        <CardHeader>
          <CardTitle className="text-lg">Request a withdrawal</CardTitle>
          <CardDescription>
            Funds are held while an admin reviews your request. Double-check the address — on-chain
            transfers cannot be reversed.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {kycBlocked && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Identity verification is required before withdrawing.{" "}
                <Link href="/kyc" className="font-medium underline">
                  Complete KYC
                </Link>{" "}
                to unlock withdrawals.
              </span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Network</Label>
                <Select value={network} onValueChange={onNetworkChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="network" value={network} />
              </div>

              <div className="space-y-2">
                <Label>Asset</Label>
                <Select value={asset} onValueChange={setAsset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="asset" value={asset} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount">Amount (USDG)</Label>
                <button
                  type="button"
                  onClick={() => setAmount(String(availableNum))}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Max {formatCurrency(availableNum)}
                </button>
              </div>
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={minNum}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(minNum)}
                className="font-mono"
                aria-invalid={Boolean(state?.fieldErrors?.amount) || insufficient || belowMin}
              />
              {belowMin && (
                <p className="text-xs text-amber-400">
                  Minimum withdrawal is {formatCurrency(minNum)} USDG.
                </p>
              )}
              {insufficient && (
                <p className="text-xs text-red-400">
                  You only have {formatCurrency(availableNum)} USDG available.
                </p>
              )}
              {state?.fieldErrors?.amount && (
                <p className="text-xs text-red-400">{state.fieldErrors.amount[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">Destination wallet address</Label>
              <Input
                id="walletAddress"
                name="walletAddress"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                placeholder="0x…"
                className="font-mono text-xs"
                aria-invalid={Boolean(state?.fieldErrors?.walletAddress) || badAddress}
              />
              {badAddress && (
                <p className="text-xs text-red-400">
                  That does not look like a valid address. It should start with 0x and be 42
                  characters long.
                </p>
              )}
              {state?.fieldErrors?.walletAddress && (
                <p className="text-xs text-red-400">{state.fieldErrors.walletAddress[0]}</p>
              )}
            </div>

            <SubmitButton
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!canSubmit}
              pendingText="Submitting…"
            >
              <ArrowUpFromLine className="size-4" />
              Request withdrawal
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Available" value={`${formatCurrency(availableNum)} USDG`} />
            <Row label="Withdrawing" value={`${formatCurrency(value)} USDG`} />
            <Row label={`Fee (${toNumber(feePercent)}%)`} value={`-${formatCurrency(fee)} USDG`} />
            <div className="border-t border-border/60 pt-2">
              <Row label="You receive" value={`${formatCurrency(net)} USDG`} strong />
            </div>
          </CardContent>
        </Card>

        {toNumber(bonus) > 0 && (
          <Card className="glass border-cyan-500/30">
            <CardContent className="space-y-1.5 p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Bonus balance</p>
              <p>
                You hold {formatCurrency(bonus)} USDG in bonus funds. Bonus money cannot be
                withdrawn directly.
              </p>
              {turnoverBlocked ? (
                <p className="text-cyan-400">
                  Trade {formatCurrency(required - completed)} USDG more to convert it to cash.
                </p>
              ) : (
                <p className="text-emerald-400">Turnover complete — bonus funds are unlocked.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="glass">
          <CardContent className="flex items-start gap-2 p-4 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Processing time</p>
              <p>
                Requests are usually reviewed within a few hours. Your balance is reduced
                immediately and refunded in full if the request is rejected.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-mono font-semibold tabular-nums text-primary"
            : "font-mono tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
