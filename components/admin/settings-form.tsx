"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { updateSiteSettings } from "@/lib/actions/admin";
import { toNumber } from "@/lib/utils";
import type { ActionResult, SiteSettings } from "@/types/database";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateSiteSettings,
    null
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Settings saved.");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const err = state?.fieldErrors;

  return (
    <form action={formAction} className="space-y-6">
      <Section
        title="Brand"
        description="Shown in the header, footer, and page titles across the site."
      >
        <Text
          name="siteName"
          label="Site name"
          defaultValue={settings.site_name}
          required
          maxLength={60}
          error={err?.siteName?.[0]}
        />
        <Text
          name="siteTagline"
          label="Tagline"
          optional
          defaultValue={settings.site_tagline ?? ""}
          maxLength={120}
          error={err?.siteTagline?.[0]}
        />
        <Text
          name="supportEmail"
          label="Support email"
          type="email"
          optional
          defaultValue={settings.support_email ?? ""}
          error={err?.supportEmail?.[0]}
        />
      </Section>

      <Section title="Social links" description="Rendered in the footer. Leave blank to hide.">
        <Text
          name="twitterUrl"
          label="X / Twitter"
          type="url"
          optional
          placeholder="https://x.com/…"
          defaultValue={settings.twitter_url ?? ""}
          error={err?.twitterUrl?.[0]}
        />
        <Text
          name="telegramUrl"
          label="Telegram"
          type="url"
          optional
          placeholder="https://t.me/…"
          defaultValue={settings.telegram_url ?? ""}
          error={err?.telegramUrl?.[0]}
        />
        <Text
          name="discordUrl"
          label="Discord"
          type="url"
          optional
          placeholder="https://discord.gg/…"
          defaultValue={settings.discord_url ?? ""}
          error={err?.discordUrl?.[0]}
        />
      </Section>

      <Section
        title="Trading fees"
        description="A percentage of every stake, clamped between the minimum and maximum. The same clamp applies when a user cancels a position."
      >
        <Num
          name="tradeFeePercent"
          label="Trade fee (%)"
          step="0.01"
          defaultValue={toNumber(settings.trade_fee_percent)}
          error={err?.tradeFeePercent?.[0]}
        />
        <div className="hidden sm:block" />
        <Num
          name="tradeFeeMin"
          label="Minimum trade fee (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.trade_fee_min)}
          error={err?.tradeFeeMin?.[0]}
        />
        <Num
          name="tradeFeeMax"
          label="Maximum trade fee (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.trade_fee_max)}
          error={err?.tradeFeeMax?.[0]}
        />
        <Num
          name="cancelFeeMin"
          label="Minimum cancel fee (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.cancel_fee_min)}
          error={err?.cancelFeeMin?.[0]}
        />
        <Num
          name="cancelFeeMax"
          label="Maximum cancel fee (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.cancel_fee_max)}
          error={err?.cancelFeeMax?.[0]}
        />
      </Section>

      <Section
        title="Deposits & withdrawals"
        description="Limits enforced on both the client and the server before a request is created."
      >
        <Num
          name="minDeposit"
          label="Minimum deposit (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.min_deposit)}
          error={err?.minDeposit?.[0]}
        />
        <Num
          name="minWithdrawal"
          label="Minimum withdrawal (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.min_withdrawal)}
          error={err?.minWithdrawal?.[0]}
        />
        <Num
          name="withdrawalFeePercent"
          label="Withdrawal fee (%)"
          step="0.01"
          defaultValue={toNumber(settings.withdrawal_fee_percent)}
          error={err?.withdrawalFeePercent?.[0]}
        />
      </Section>

      <Section
        title="Bonuses & referrals"
        description="Bonus funds must be turned over before they can be withdrawn."
      >
        <Num
          name="welcomeBonus"
          label="Welcome bonus (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.welcome_bonus)}
          error={err?.welcomeBonus?.[0]}
        />
        <Num
          name="depositBonusPercent"
          label="Deposit bonus (%)"
          step="0.01"
          hint="Applied to every deposit after the first one."
          defaultValue={toNumber(settings.deposit_bonus_percent)}
          error={err?.depositBonusPercent?.[0]}
        />
        <Num
          name="firstDepositBonusPercent"
          label="First deposit bonus (%)"
          step="0.01"
          hint="Replaces the deposit bonus on a user's first approved deposit. 100 means match it exactly."
          defaultValue={toNumber(settings.first_deposit_bonus_percent)}
          error={err?.firstDepositBonusPercent?.[0]}
        />
        <Num
          name="firstDepositBonusMax"
          label="First deposit bonus cap (USDG)"
          step="0.01"
          hint="Largest first deposit bonus payable. 0 means uncapped."
          defaultValue={toNumber(settings.first_deposit_bonus_max)}
          error={err?.firstDepositBonusMax?.[0]}
        />
        <Num
          name="bonusTurnoverMultiplier"
          label="Turnover multiplier (×)"
          step="0.1"
          hint="A 5× multiplier on a 20 USDG bonus requires 100 USDG of trading volume."
          defaultValue={toNumber(settings.bonus_turnover_multiplier)}
          error={err?.bonusTurnoverMultiplier?.[0]}
        />
        <Num
          name="referralCommissionPercent"
          label="Referral commission (%)"
          step="0.01"
          hint="Paid to the referrer on each referred user's trading fees."
          defaultValue={toNumber(settings.referral_commission_percent)}
          error={err?.referralCommissionPercent?.[0]}
        />
        <Num
          name="referralSignupReward"
          label="Referral signup reward (USDG)"
          step="0.01"
          hint="Flat USDG paid to the referrer on a referred user's first approved deposit. 0 = off."
          defaultValue={toNumber(settings.referral_signup_reward)}
          error={err?.referralSignupReward?.[0]}
        />
      </Section>

      <Section
        title="Earn & rewards"
        description="Task and ad rewards. Configure the ad providers under Ad placements."
      >
        <Toggle
          name="earnTasksEnabled"
          label="Task rewards open"
          hint="Turn off to stop new task submissions without hiding past ones."
          defaultChecked={settings.earn_tasks_enabled}
        />
        <Toggle
          name="taskRewardIsBonus"
          label="Pay task rewards as bonus"
          hint="Bonus funds carry a turnover requirement before they can be withdrawn."
          defaultChecked={settings.task_reward_is_bonus}
        />
        <Toggle
          name="adsEnabled"
          label="Ads enabled"
          hint="Master switch for every ad slot and the watch-to-earn reward."
          defaultChecked={settings.ads_enabled}
        />
        <Num
          name="adReward"
          label="Reward per ad (USDG)"
          step="0.01"
          defaultValue={toNumber(settings.ad_reward)}
          error={err?.adReward?.[0]}
        />
        <Num
          name="adWatchSeconds"
          label="Required watch time (seconds)"
          step="1"
          hint="Users must wait this long before the claim button unlocks. 5–120."
          defaultValue={settings.ad_watch_seconds}
          error={err?.adWatchSeconds?.[0]}
        />
        <Num
          name="adDailyLimit"
          label="Daily ad reward limit"
          step="1"
          hint="Maximum rewarded ads one user can claim per day."
          defaultValue={settings.ad_daily_limit}
          error={err?.adDailyLimit?.[0]}
        />
      </Section>

      <Section title="Access" description="Site-wide switches. Changes take effect immediately.">
        <Toggle
          name="kycRequiredForWithdrawal"
          label="Require KYC for withdrawals"
          hint="Users must be verified before a withdrawal request is accepted."
          defaultChecked={settings.kyc_required_for_withdrawal}
        />
        <Toggle
          name="registrationEnabled"
          label="Registration open"
          hint="Turn off to stop new sign-ups without affecting existing users."
          defaultChecked={settings.registration_enabled}
        />
        <Toggle
          name="maintenanceMode"
          label="Maintenance mode"
          hint="Everyone except admins sees a maintenance notice."
          defaultChecked={settings.maintenance_mode}
          danger
        />
      </Section>

      <div className="flex justify-end">
        <SubmitButton variant="gradient" pendingText="Saving…">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function Text({
  name,
  label,
  optional,
  error,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} {optional && <span className="text-muted-foreground">(optional)</span>}
      </Label>
      <Input id={name} name={name} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Num({
  name,
  label,
  hint,
  error,
  ...props
}: React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        min="0"
        className="font-mono"
        required
        {...props}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
  danger,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
  danger?: boolean;
}) {
  const [on, setOn] = useState(defaultChecked);

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 sm:col-span-2">
      <div className="space-y-0.5">
        <Label htmlFor={name} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input type="hidden" name={name} value={on ? "true" : "false"} />
      <Switch
        id={name}
        checked={on}
        onCheckedChange={setOn}
        className={danger ? "data-[state=checked]:bg-red-500" : undefined}
      />
    </div>
  );
}
