"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AlertCircle, Loader2, RefreshCw, Upload, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CopyButton } from "@/components/shared/copy-button";
import { getDepositAddress, submitDeposit, uploadReceipt } from "@/lib/actions/wallet";
import { ASSETS_BY_NETWORK, NETWORKS, type NetworkValue } from "@/lib/constants";
import { formatCurrency, truncateAddress } from "@/lib/utils";
import type { ActionResult, DepositAddress } from "@/types/database";

export function DepositForm({ minDeposit, bonusPercent }: { minDeposit: string; bonusPercent: string }) {
  const [network, setNetwork] = useState<NetworkValue>("robinhood");
  const [asset, setAsset] = useState("USDG");
  const [address, setAddress] = useState<DepositAddress | null>(null);
  const [loadingAddress, startLoading] = useTransition();
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [amount, setAmount] = useState("");

  const [state, formAction] = useActionState<ActionResult | null, FormData>(submitDeposit, null);

  const assets = ASSETS_BY_NETWORK[network];

  function loadAddress(net: NetworkValue, ast: string) {
    startLoading(async () => {
      const result = await getDepositAddress(net, ast);
      if (result.success && result.data) setAddress(result.data);
      else {
        setAddress(null);
        toast.error(result.error ?? "No deposit address available right now.");
      }
    });
  }

  useEffect(() => {
    loadAddress(network, asset);
  }, [network, asset]);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success(state.message ?? "Deposit submitted.");
  }, [state]);

  const [seen, setSeen] = useState<ActionResult | null>(null);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) {
      setAmount("");
      setReceiptUrl("");
    }
  }

  function onNetworkChange(value: string) {
    const next = value as NetworkValue;
    setNetwork(next);
    const validAssets = ASSETS_BY_NETWORK[next];
    if (!validAssets.includes(asset)) setAsset(validAssets[0]);
  }

  async function onReceiptChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);

    const result = await uploadReceipt(fd);
    setUploading(false);

    if (result.success && result.data) {
      setReceiptUrl(result.data.path);
      toast.success("Receipt attached.");
    } else {
      toast.error(result.error ?? "Upload failed.");
      event.target.value = "";
    }
  }

  const bonus = (Number(amount || 0) * Number(bonusPercent || 0)) / 100;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="glass-strong">
        <CardHeader>
          <CardTitle className="text-lg">1. Send your funds</CardTitle>
          <CardDescription>
            Pick a network and asset, then transfer to the address shown. Each request uses a
            randomly assigned address from our pool.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
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
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Deposit address</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => loadAddress(network, asset)}
                disabled={loadingAddress}
              >
                {loadingAddress ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                New address
              </Button>
            </div>

            {loadingAddress ? (
              <div className="flex h-16 items-center justify-center rounded-lg border border-border/60 bg-secondary/40">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : address ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-xs">{address.address}</p>
                  {address.label && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{address.label}</p>
                  )}
                </div>
                <CopyButton value={address.address} label="Address" />
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                No address is configured for {asset} on this network yet. Try another asset or
                contact support.
              </div>
            )}
          </div>

          <div className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Before you send</p>
            <p>• Send only {asset} on {NETWORKS.find((n) => n.value === network)?.label}. Other assets are unrecoverable.</p>
            <p>• Minimum deposit is {formatCurrency(minDeposit)} USDG equivalent.</p>
            <p>• Your balance updates after an admin confirms the transaction on-chain.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-strong">
        <CardHeader>
          <CardTitle className="text-lg">2. Confirm your transfer</CardTitle>
          <CardDescription>
            Submit the transaction hash so we can match your payment.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="network" value={network} />
            <input type="hidden" name="asset" value={asset} />
            <input type="hidden" name="depositAddress" value={address?.address ?? ""} />
            <input type="hidden" name="receiptUrl" value={receiptUrl} />

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USDG)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={Number(minDeposit)}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={minDeposit}
                className="font-mono"
                aria-invalid={Boolean(state?.fieldErrors?.amount)}
              />
              {state?.fieldErrors?.amount && (
                <p className="text-xs text-red-400">{state.fieldErrors.amount[0]}</p>
              )}
              {bonus > 0 && (
                <p className="text-xs text-cyan-400">
                  Eligible for a {bonusPercent}% deposit bonus — about {formatCurrency(bonus)} USDG
                  extra.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="txHash">Transaction hash</Label>
              <Input
                id="txHash"
                name="txHash"
                required
                placeholder="0x…"
                className="font-mono text-xs"
                aria-invalid={Boolean(state?.fieldErrors?.txHash)}
              />
              {state?.fieldErrors?.txHash && (
                <p className="text-xs text-red-400">{state.fieldErrors.txHash[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt">
                Receipt screenshot <span className="text-muted-foreground">(optional)</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={onReceiptChange}
                  disabled={uploading}
                  className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
                />
                {uploading && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
              </div>
              {receiptUrl && (
                <p className="flex items-center gap-1 text-xs text-emerald-400">
                  <Upload className="size-3" />
                  Attached: {truncateAddress(receiptUrl, 18, 8)}
                </p>
              )}
            </div>

            <SubmitButton
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!address || uploading}
              pendingText="Submitting…"
            >
              <WalletIcon className="size-4" />
              Submit deposit
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
