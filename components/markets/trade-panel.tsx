"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { placeTrade } from "@/lib/actions/trades";
import { cn, formatCurrency, toNumber, clamp } from "@/lib/utils";
import type {
  ActionResult,
  Market,
  MarketOption,
  SiteSettings,
  Wallet,
} from "@/types/database";

const QUICK_AMOUNTS = [5, 10, 25, 50, 100];

function buildQuote({
  amount,
  price,
  feePercent,
  feeMin,
  feeMax,
}: {
  amount: string;
  price: number;
  feePercent: number;
  feeMin: number;
  feeMax: number;
}) {
  const value = toNumber(amount);
  if (!value || value <= 0) return null;

  const fee = clamp((value * feePercent) / 100, feeMin, feeMax);
  const shares = value / price;

  return { value, fee, shares, payout: shares, total: value + fee, profit: shares - value - fee };
}

export function TradePanel({
  market,
  options,
  wallet,
  settings,
  isAuthenticated,
}: {
  market: Market;
  options: MarketOption[];
  wallet: Wallet | null;
  settings: SiteSettings;
  isAuthenticated: boolean;
}) {
  const choices = options.filter((option) => option.is_active);
  const [optionId, setOptionId] = useState(choices[0]?.id ?? "");
  const [amount, setAmount] = useState("10");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(placeTrade, null);

  const [seen, setSeen] = useState<ActionResult | null>(null);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) setAmount("10");
  }

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success(state.message ?? "Trade placed.");
  }, [state]);

  const selected = choices.find((option) => option.id === optionId) ?? choices[0];
  const minTrade = toNumber(market.min_trade, 1);
  const maxTrade = toNumber(market.max_trade, 100000);
  const price = toNumber(selected?.odds, 0.5);
  const feePercent = toNumber(settings.trade_fee_percent, 1);
  const feeMin = toNumber(settings.trade_fee_min, 0.3);
  const feeMax = toNumber(settings.trade_fee_max, 1);

  const quote = buildQuote({ amount, price, feePercent, feeMin, feeMax });

  const spendable = toNumber(wallet?.available_balance) + toNumber(wallet?.bonus_balance);
  const insufficient = quote ? quote.total > spendable : false;
  const outOfRange = quote ? quote.value < minTrade || quote.value > maxTrade : false;
  const isOpen =
    market.status === "open" && new Date(market.end_time) > new Date() && choices.length > 0;

  if (!isOpen) {
    return (
      <Card className="glass-strong">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="size-8 text-muted-foreground" />
          <p className="font-medium">
            {market.status === "resolved"
              ? `Resolved: ${options.find((option) => option.is_winner)?.label ?? "settled"}`
              : "This market is closed"}
          </p>
          <p className="text-sm text-muted-foreground">
            {market.status === "resolved"
              ? (market.resolution_note ?? "Winning positions have been paid out.")
              : "Trading has ended for this event."}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/markets">Browse open markets</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-strong sticky top-20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Place a prediction</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(choices.length, 3)}, 1fr)`,
          }}
        >
          {choices.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setOptionId(option.id)}
              className={cn(
                "rounded-lg border-2 px-3 py-3 text-left transition-all",
                optionId === option.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/60 bg-secondary/40 hover:border-border"
              )}
            >
              <span className="block truncate text-xs font-medium">{option.label}</span>
              <span className="mt-1 block font-mono text-xl font-semibold tabular-nums">
                {Math.round(toNumber(option.odds) * 100)}¢
              </span>
            </button>
          ))}
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="marketId" value={market.id} />
          <input type="hidden" name="optionId" value={optionId} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount (USDG)</Label>
              {wallet && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <WalletIcon className="size-3" />
                  {formatCurrency(spendable)} available
                </span>
              )}
            </div>
            <Input
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={minTrade}
              max={maxTrade}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-lg"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className="rounded-md border border-border/60 bg-secondary/50 px-2.5 py-1 font-mono text-xs transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {value}
                </button>
              ))}
              {spendable > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.floor(spendable * 100) / 100))}
                  className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  Max
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Range {formatCurrency(minTrade)} – {formatCurrency(maxTrade)} USDG
            </p>
          </div>

          {quote && (
            <dl className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shares</dt>
                <dd className="font-mono tabular-nums">{quote.shares.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Trading fee</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(quote.fee)}</dd>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1.5">
                <dt className="font-medium">Total cost</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {formatCurrency(quote.total)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payout if correct</dt>
                <dd className="font-mono font-semibold tabular-nums text-emerald-400">
                  {formatCurrency(quote.payout)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Net profit</dt>
                <dd
                  className={cn(
                    "font-mono tabular-nums",
                    quote.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {quote.profit >= 0 ? "+" : ""}
                  {formatCurrency(quote.profit)}
                </dd>
              </div>
            </dl>
          )}

          {isAuthenticated ? (
            <>
              {insufficient && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertCircle className="size-3.5" />
                  Not enough balance.{" "}
                  <Link href="/wallet/deposit" className="underline">
                    Deposit funds
                  </Link>
                </p>
              )}
              {outOfRange && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertCircle className="size-3.5" />
                  Amount must be between {formatCurrency(minTrade)} and {formatCurrency(maxTrade)}.
                </p>
              )}
              <SubmitButton
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={!quote || insufficient || outOfRange}
                pendingText="Placing trade…"
              >
                Buy {selected?.label ?? "outcome"}
              </SubmitButton>
            </>
          ) : (
            <Button asChild variant="gradient" size="lg" className="w-full">
              <Link href={`/login?next=/markets/${market.slug}`}>Sign in to trade</Link>
            </Button>
          )}
        </form>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          You can cancel any open position before the market resolves. A cancellation fee of{" "}
          {formatCurrency(settings.cancel_fee_min)}–{formatCurrency(settings.cancel_fee_max)} USDG
          applies.
        </p>
      </CardContent>
    </Card>
  );
}
