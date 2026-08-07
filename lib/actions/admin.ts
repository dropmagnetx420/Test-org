"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, logAdminAction } from "@/lib/auth";
import {
  ok,
  fail,
  parseOrFail,
  toActionError,
  formString,
  formNumber,
  formBool,
} from "@/lib/action-utils";
import {
  marketSchema,
  resolveMarketSchema,
  seedVolumeSchema,
  reviewSchema,
  approveWithdrawalSchema,
  userStatusSchema,
  balanceAdjustSchema,
  siteSettingsSchema,
  depositAddressSchema,
  bannerSchema,
  partnerSchema,
  announcementSchema,
  earnTaskSchema,
  reviewTaskSchema,
  adPlacementSchema,
} from "@/lib/validations";
import type { ActionResult, Market } from "@/types/database";

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 70);
}

interface OutcomeInput {
  label: string;
  odds?: number;
  seedVolume?: number;
}

/** Reads the repeated `outcomeLabel` / `outcomeOdds` / `outcomeSeed` form fields. */
function parseOutcomes(fd: FormData): OutcomeInput[] {
  const labels = fd.getAll("outcomeLabel").map((v) => String(v).trim());
  const oddsRaw = fd.getAll("outcomeOdds").map((v) => String(v).trim());
  const seedRaw = fd.getAll("outcomeSeed").map((v) => String(v).trim());

  return labels
    .map((label, index) => ({
      label,
      odds: oddsRaw[index] ? Number(oddsRaw[index]) : undefined,
      seedVolume: seedRaw[index] ? Number(seedRaw[index]) : undefined,
    }))
    .filter((outcome) => outcome.label.length > 0);
}

/**
 * The odds check constraint rejects 0 and 1, and recalc_market_odds expects the
 * set to sum to 1. Fall back to an even split when an admin leaves prices blank.
 */
function normalizeOdds(outcomes: OutcomeInput[]): number[] {
  const provided = outcomes.every((o) => typeof o.odds === "number" && Number.isFinite(o.odds));
  if (!provided) {
    return outcomes.map(() => Number((1 / outcomes.length).toFixed(4)));
  }
  return outcomes.map((o) => Math.min(Math.max(o.odds as number, 0.01), 0.99));
}

// ============================================================== MARKETS
export async function createMarket(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<Market>> {
  await requireAdmin();

  const parsed = parseOrFail(marketSchema, {
    sport: formString(fd, "sport"),
    league: formString(fd, "league"),
    title: formString(fd, "title"),
    description: formString(fd, "description"),
    rules: formString(fd, "rules"),
    teamA: formString(fd, "teamA"),
    teamB: formString(fd, "teamB"),
    outcomes: parseOutcomes(fd),
    imageUrl: formString(fd, "imageUrl"),
    minTrade: formNumber(fd, "minTrade"),
    maxTrade: formNumber(fd, "maxTrade"),
    startTime: formString(fd, "startTime"),
    endTime: formString(fd, "endTime"),
    status: formString(fd, "status") || "draft",
    isFeatured: formBool(fd, "isFeatured"),
    isTrending: formBool(fd, "isTrending"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const supabase = await createClient();
  const slug = `${slugify(d.title)}-${Date.now().toString(36)}`;
  const odds = normalizeOdds(d.outcomes);

  const { data, error } = await supabase
    .from("markets")
    .insert({
      slug,
      sport: d.sport,
      league: d.league || null,
      title: d.title,
      description: d.description || null,
      rules: d.rules || null,
      image_url: d.imageUrl || null,
      team_a: d.teamA || null,
      team_b: d.teamB || null,
      outcome_count: d.outcomes.length,
      yes_label: d.outcomes[0].label,
      no_label: d.outcomes[1].label,
      yes_odds: odds[0],
      no_odds: odds[1],
      min_trade: d.minTrade,
      max_trade: d.maxTrade,
      start_time: new Date(d.startTime).toISOString(),
      end_time: new Date(d.endTime).toISOString(),
      status: d.status,
      is_featured: d.isFeatured,
      is_trending: d.isTrending,
    })
    .select()
    .single();

  if (error) return toActionError(error);

  // Outcomes live in market_options — place_trade resolves through it, so a
  // market without these rows cannot be traded at all.
  const { error: optionsError } = await supabase.from("market_options").insert(
    d.outcomes.map((outcome, index) => ({
      market_id: data.id,
      label: outcome.label,
      odds: odds[index],
      seed_volume: outcome.seedVolume ?? 0,
      position: index,
    }))
  );

  if (optionsError) {
    await supabase.from("markets").delete().eq("id", data.id);
    return toActionError(optionsError);
  }

  await supabase.rpc("recalc_market_odds", { p_market_id: data.id });

  await logAdminAction({
    action: "create_market",
    entityType: "market",
    entityId: data.id,
    afterData: { title: d.title, sport: d.sport, status: d.status, outcomes: d.outcomes.length },
  });

  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  revalidatePath("/");

  return ok(data as Market, "Market created.");
}

export async function updateMarket(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<Market>> {
  await requireAdmin();

  const marketId = formString(fd, "marketId");
  if (!marketId) return fail("Missing market id.");

  const parsed = parseOrFail(marketSchema, {
    sport: formString(fd, "sport"),
    league: formString(fd, "league"),
    title: formString(fd, "title"),
    description: formString(fd, "description"),
    rules: formString(fd, "rules"),
    teamA: formString(fd, "teamA"),
    teamB: formString(fd, "teamB"),
    outcomes: parseOutcomes(fd),
    imageUrl: formString(fd, "imageUrl"),
    minTrade: formNumber(fd, "minTrade"),
    maxTrade: formNumber(fd, "maxTrade"),
    startTime: formString(fd, "startTime"),
    endTime: formString(fd, "endTime"),
    status: formString(fd, "status") || "draft",
    isFeatured: formBool(fd, "isFeatured"),
    isTrending: formBool(fd, "isTrending"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const supabase = await createClient();

  const { data: before } = await supabase.from("markets").select("*").eq("id", marketId).single();

  const { data, error } = await supabase
    .from("markets")
    .update({
      sport: d.sport,
      league: d.league || null,
      title: d.title,
      description: d.description || null,
      rules: d.rules || null,
      image_url: d.imageUrl || null,
      team_a: d.teamA || null,
      team_b: d.teamB || null,
      yes_label: d.outcomes[0].label,
      no_label: d.outcomes[1].label,
      min_trade: d.minTrade,
      max_trade: d.maxTrade,
      start_time: new Date(d.startTime).toISOString(),
      end_time: new Date(d.endTime).toISOString(),
      status: d.status,
      is_featured: d.isFeatured,
      is_trending: d.isTrending,
    })
    .eq("id", marketId)
    .select()
    .single();

  if (error) return toActionError(error);

  // Only labels are editable after creation — prices move with trading volume
  // and the outcome set is fixed once positions exist.
  const { data: existing } = await supabase
    .from("market_options")
    .select("id,position")
    .eq("market_id", marketId)
    .order("position", { ascending: true });

  for (const option of (existing as { id: string; position: number }[]) ?? []) {
    const next = d.outcomes[option.position];
    if (next) {
      await supabase.from("market_options").update({ label: next.label }).eq("id", option.id);
    }
  }

  await logAdminAction({
    action: "update_market",
    entityType: "market",
    entityId: marketId,
    beforeData: before ? { title: before.title, status: before.status } : null,
    afterData: { title: d.title, status: d.status },
  });

  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  revalidatePath(`/markets/${data.slug}`);

  return ok(data as Market, "Market updated.");
}

export async function resolveMarket(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<{ settled: number }>> {
  await requireAdmin();

  const parsed = parseOrFail(resolveMarketSchema, {
    marketId: formString(fd, "marketId"),
    optionId: formString(fd, "optionId"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_market", {
    p_market_id: parsed.data.marketId,
    p_option_id: parsed.data.optionId,
    p_note: parsed.data.note || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  revalidatePath("/dashboard/predictions");

  const settled = Number(data ?? 0);
  return ok({ settled }, `${settled} position(s) settled.`);
}

export async function cancelMarket(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<{ refunded: number }>> {
  await requireAdmin();

  const marketId = formString(fd, "marketId");
  if (!marketId) return fail("Missing market id.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_market", {
    p_market_id: marketId,
    p_note: formString(fd, "note") || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/markets");
  revalidatePath("/markets");

  const refunded = Number(data ?? 0);
  return ok({ refunded }, `Market cancelled. ${refunded} positions refunded in full.`);
}

export async function deleteMarket(marketId: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { count } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("market_id", marketId);

  if ((count ?? 0) > 0) {
    return fail("This market has trades and cannot be deleted. Cancel it instead to refund users.");
  }

  const { error } = await supabase.from("markets").delete().eq("id", marketId);
  if (error) return toActionError(error);

  await logAdminAction({ action: "delete_market", entityType: "market", entityId: marketId });

  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  return ok(null, "Market deleted.");
}

// ============================================================= DEPOSITS
export async function approveDeposit(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(reviewSchema, {
    requestId: formString(fd, "requestId"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_deposit", {
    p_request_id: parsed.data.requestId,
    p_note: parsed.data.note || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/deposits");
  revalidatePath("/admin");
  return ok(null, "Deposit approved and balance credited.");
}

export async function rejectDeposit(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(reviewSchema, {
    requestId: formString(fd, "requestId"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_deposit", {
    p_request_id: parsed.data.requestId,
    p_note: parsed.data.note || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/deposits");
  revalidatePath("/admin");
  return ok(null, "Deposit rejected.");
}

// ========================================================== WITHDRAWALS
export async function approveWithdrawal(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(approveWithdrawalSchema, {
    requestId: formString(fd, "requestId"),
    txHash: formString(fd, "txHash"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_withdrawal", {
    p_request_id: parsed.data.requestId,
    p_tx_hash: parsed.data.txHash || null,
    p_note: parsed.data.note || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/withdrawals");
  revalidatePath("/admin");
  return ok(null, "Withdrawal approved.");
}

export async function rejectWithdrawal(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(reviewSchema, {
    requestId: formString(fd, "requestId"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_withdrawal", {
    p_request_id: parsed.data.requestId,
    p_note: parsed.data.note || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/withdrawals");
  revalidatePath("/admin");
  return ok(null, "Withdrawal rejected and funds returned.");
}

// ================================================================== KYC
export async function reviewKyc(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(reviewSchema, {
    requestId: formString(fd, "requestId"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const approve = formBool(fd, "approve");
  const supabase = await createClient();

  const { error } = await supabase.rpc("review_kyc", {
    p_request_id: parsed.data.requestId,
    p_approve: approve,
    p_note: parsed.data.note || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/kyc");
  revalidatePath("/admin");
  return ok(null, approve ? "KYC approved." : "KYC rejected.");
}

// ================================================================ USERS
export async function setUserStatus(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(userStatusSchema, {
    userId: formString(fd, "userId"),
    status: formString(fd, "status"),
    reason: formString(fd, "reason"),
    until: formString(fd, "until"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_status", {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason || null,
    p_until: parsed.data.until ? new Date(parsed.data.until).toISOString() : null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/users");
  return ok(null, `User marked as ${parsed.data.status}.`);
}

export async function adjustBalance(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(balanceAdjustSchema, {
    userId: formString(fd, "userId"),
    amount: formNumber(fd, "amount"),
    isBonus: formBool(fd, "isBonus"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_user_balance", {
    p_user_id: parsed.data.userId,
    p_amount: parsed.data.amount,
    p_is_bonus: parsed.data.isBonus,
    p_note: parsed.data.note || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/users");
  return ok(null, "Balance adjusted.");
}

export async function setUserRole(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "super_admin") {
    return fail("Only a super admin can change roles.");
  }

  const userId = formString(fd, "userId");
  const role = formString(fd, "role");
  if (!["user", "admin", "super_admin"].includes(role)) return fail("Invalid role.");
  if (userId === admin.id) return fail("You cannot change your own role.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return toActionError(error);

  await logAdminAction({
    action: "set_user_role",
    entityType: "profile",
    entityId: userId,
    afterData: { role },
  });

  revalidatePath("/admin/users");
  return ok(null, `Role updated to ${role}.`);
}

// ======================================================== SITE SETTINGS
export async function updateSiteSettings(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(siteSettingsSchema, {
    siteName: formString(fd, "siteName"),
    siteTagline: formString(fd, "siteTagline"),
    supportEmail: formString(fd, "supportEmail"),
    twitterUrl: formString(fd, "twitterUrl"),
    telegramUrl: formString(fd, "telegramUrl"),
    discordUrl: formString(fd, "discordUrl"),
    tradeFeePercent: formNumber(fd, "tradeFeePercent"),
    tradeFeeMin: formNumber(fd, "tradeFeeMin"),
    tradeFeeMax: formNumber(fd, "tradeFeeMax"),
    cancelFeeMin: formNumber(fd, "cancelFeeMin"),
    cancelFeeMax: formNumber(fd, "cancelFeeMax"),
    minDeposit: formNumber(fd, "minDeposit"),
    minWithdrawal: formNumber(fd, "minWithdrawal"),
    withdrawalFeePercent: formNumber(fd, "withdrawalFeePercent"),
    welcomeBonus: formNumber(fd, "welcomeBonus"),
    depositBonusPercent: formNumber(fd, "depositBonusPercent"),
    bonusTurnoverMultiplier: formNumber(fd, "bonusTurnoverMultiplier"),
    referralCommissionPercent: formNumber(fd, "referralCommissionPercent"),
    kycRequiredForWithdrawal: formBool(fd, "kycRequiredForWithdrawal"),
    maintenanceMode: formBool(fd, "maintenanceMode"),
    registrationEnabled: formBool(fd, "registrationEnabled"),
    adsEnabled: formBool(fd, "adsEnabled"),
    adReward: formNumber(fd, "adReward"),
    adWatchSeconds: formNumber(fd, "adWatchSeconds"),
    adDailyLimit: formNumber(fd, "adDailyLimit"),
    earnTasksEnabled: formBool(fd, "earnTasksEnabled"),
    taskRewardIsBonus: formBool(fd, "taskRewardIsBonus"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  if (d.tradeFeeMax < d.tradeFeeMin) return fail("Maximum trade fee must be at least the minimum.");
  if (d.cancelFeeMax < d.cancelFeeMin) return fail("Maximum cancel fee must be at least the minimum.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      site_name: d.siteName,
      site_tagline: d.siteTagline || null,
      support_email: d.supportEmail || null,
      twitter_url: d.twitterUrl || null,
      telegram_url: d.telegramUrl || null,
      discord_url: d.discordUrl || null,
      trade_fee_percent: d.tradeFeePercent,
      trade_fee_min: d.tradeFeeMin,
      trade_fee_max: d.tradeFeeMax,
      cancel_fee_min: d.cancelFeeMin,
      cancel_fee_max: d.cancelFeeMax,
      min_deposit: d.minDeposit,
      min_withdrawal: d.minWithdrawal,
      withdrawal_fee_percent: d.withdrawalFeePercent,
      welcome_bonus: d.welcomeBonus,
      deposit_bonus_percent: d.depositBonusPercent,
      bonus_turnover_multiplier: d.bonusTurnoverMultiplier,
      referral_commission_percent: d.referralCommissionPercent,
      kyc_required_for_withdrawal: d.kycRequiredForWithdrawal,
      maintenance_mode: d.maintenanceMode,
      registration_enabled: d.registrationEnabled,
      ads_enabled: d.adsEnabled,
      ad_reward: d.adReward,
      ad_watch_seconds: d.adWatchSeconds,
      ad_daily_limit: d.adDailyLimit,
      earn_tasks_enabled: d.earnTasksEnabled,
      task_reward_is_bonus: d.taskRewardIsBonus,
    })
    .eq("id", 1);

  if (error) return toActionError(error);

  await logAdminAction({ action: "update_settings", entityType: "site_settings", entityId: null });

  revalidatePath("/", "layout");
  return ok(null, "Settings saved.");
}

// ===================================================== DEPOSIT ADDRESSES
export async function saveDepositAddress(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(depositAddressSchema, {
    network: formString(fd, "network"),
    asset: formString(fd, "asset"),
    address: formString(fd, "address"),
    label: formString(fd, "label"),
    isActive: fd.get("isActive") === null ? true : formBool(fd, "isActive"),
  });
  if (!parsed.ok) return parsed.result;

  const id = formString(fd, "id");
  const supabase = await createClient();
  const payload = {
    network: parsed.data.network,
    asset: parsed.data.asset,
    address: parsed.data.address,
    label: parsed.data.label || null,
    is_active: parsed.data.isActive,
  };

  const { error } = id
    ? await supabase.from("deposit_addresses").update(payload).eq("id", id)
    : await supabase.from("deposit_addresses").insert(payload);

  if (error) return toActionError(error);

  revalidatePath("/admin/settings/addresses");
  return ok(null, id ? "Address updated." : "Address added.");
}

export async function deleteDepositAddress(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("deposit_addresses").delete().eq("id", id);
  if (error) return toActionError(error);

  revalidatePath("/admin/settings/addresses");
  return ok(null, "Address removed.");
}

// ======================================================= PROMO BANNERS
export async function saveBanner(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();

  const rawLimit = formString(fd, "userLimit");
  const parsed = parseOrFail(bannerSchema, {
    title: formString(fd, "title"),
    subtitle: formString(fd, "subtitle"),
    imageUrl: formString(fd, "imageUrl"),
    linkUrl: formString(fd, "linkUrl"),
    ctaText: formString(fd, "ctaText"),
    bgGradient: formString(fd, "bgGradient"),
    position: formNumber(fd, "position") || 0,
    bonusAmount: formNumber(fd, "bonusAmount") || 0,
    userLimit: rawLimit ? Number(rawLimit) : null,
    isActive: fd.get("isActive") === null ? true : formBool(fd, "isActive"),
    startsAt: formString(fd, "startsAt"),
    endsAt: formString(fd, "endsAt"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const id = formString(fd, "id");
  const supabase = await createClient();

  const payload = {
    title: d.title,
    subtitle: d.subtitle || null,
    image_url: d.imageUrl || null,
    link_url: d.linkUrl || null,
    cta_text: d.ctaText || null,
    bg_gradient: d.bgGradient || "from-violet-600 to-fuchsia-600",
    position: d.position,
    bonus_amount: d.bonusAmount,
    user_limit: d.userLimit ?? null,
    is_active: d.isActive,
    starts_at: d.startsAt ? new Date(d.startsAt).toISOString() : null,
    ends_at: d.endsAt ? new Date(d.endsAt).toISOString() : null,
  };

  const { error } = id
    ? await supabase.from("promo_banners").update(payload).eq("id", id)
    : await supabase.from("promo_banners").insert(payload);

  if (error) return toActionError(error);

  revalidatePath("/admin/settings/banners");
  revalidatePath("/");
  return ok(null, id ? "Banner updated." : "Banner created.");
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("promo_banners").delete().eq("id", id);
  if (error) return toActionError(error);

  revalidatePath("/admin/settings/banners");
  revalidatePath("/");
  return ok(null, "Banner deleted.");
}

// ============================================================= PARTNERS
export async function savePartner(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(partnerSchema, {
    name: formString(fd, "name"),
    logoUrl: formString(fd, "logoUrl"),
    websiteUrl: formString(fd, "websiteUrl"),
    position: formNumber(fd, "position") || 0,
    isActive: fd.get("isActive") === null ? true : formBool(fd, "isActive"),
  });
  if (!parsed.ok) return parsed.result;

  const id = formString(fd, "id");
  const supabase = await createClient();
  const payload = {
    name: parsed.data.name,
    logo_url: parsed.data.logoUrl,
    website_url: parsed.data.websiteUrl || null,
    position: parsed.data.position,
    is_active: parsed.data.isActive,
  };

  const { error } = id
    ? await supabase.from("partners").update(payload).eq("id", id)
    : await supabase.from("partners").insert(payload);

  if (error) return toActionError(error);

  revalidatePath("/admin/settings/partners");
  revalidatePath("/");
  return ok(null, id ? "Partner updated." : "Partner added.");
}

export async function deletePartner(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) return toActionError(error);

  revalidatePath("/admin/settings/partners");
  revalidatePath("/");
  return ok(null, "Partner removed.");
}

// ========================================================= ANNOUNCEMENTS
export async function sendAnnouncement(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(announcementSchema, {
    title: formString(fd, "title"),
    message: formString(fd, "message"),
    link: formString(fd, "link"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: null,
    is_broadcast: true,
    type: "announcement",
    title: parsed.data.title,
    message: parsed.data.message,
    link: parsed.data.link || null,
  });

  if (error) return toActionError(error);

  await logAdminAction({
    action: "send_announcement",
    entityType: "notification",
    afterData: { title: parsed.data.title },
  });

  revalidatePath("/admin/notifications");
  return ok(null, "Announcement broadcast to all users.");
}

export async function closeExpiredMarkets(): Promise<ActionResult<{ closed: number }>> {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_expired_markets");
  if (error) return toActionError(error);

  revalidatePath("/admin/markets");
  revalidatePath("/markets");

  const closed = Number(data ?? 0);
  return ok({ closed }, `${closed} expired market(s) closed.`);
}

export async function setMarketVolume(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(seedVolumeSchema, {
    marketId: formString(fd, "marketId"),
    seeds: parseSeeds(fd),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_market_volume", {
    p_market_id: parsed.data.marketId,
    p_seeds: parsed.data.seeds.map((seed) => ({
      option_id: seed.optionId,
      seed_volume: seed.seedVolume,
    })),
  });

  if (error) return toActionError(error);

  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  return ok(null, "Seeded volume updated.");
}

function parseSeeds(fd: FormData): { optionId: string; seedVolume: number }[] {
  return fd.getAll("seedOptionId").map((id, index) => ({
    optionId: String(id),
    seedVolume: Number(fd.getAll("seedVolume")[index] ?? 0),
  }));
}

// ------------------------------------------------------------- earn tasks
export async function saveEarnTask(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const rawLimit = formString(fd, "userLimit");
  const parsed = parseOrFail(earnTaskSchema, {
    type: formString(fd, "type"),
    title: formString(fd, "title"),
    description: formString(fd, "description"),
    instructions: formString(fd, "instructions"),
    targetUrl: formString(fd, "targetUrl"),
    reward: formNumber(fd, "reward") || 0,
    requiresProof: fd.get("requiresProof") === null ? true : formBool(fd, "requiresProof"),
    isRepeatable: formBool(fd, "isRepeatable"),
    cooldownHours: formNumber(fd, "cooldownHours") || 0,
    userLimit: rawLimit ? Number(rawLimit) : null,
    isActive: fd.get("isActive") === null ? true : formBool(fd, "isActive"),
    position: formNumber(fd, "position") || 0,
    startsAt: formString(fd, "startsAt"),
    endsAt: formString(fd, "endsAt"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const id = formString(fd, "id");
  const supabase = await createClient();

  const payload = {
    type: d.type,
    title: d.title,
    description: d.description || null,
    instructions: d.instructions || null,
    target_url: d.targetUrl || null,
    reward: d.reward,
    requires_proof: d.requiresProof,
    is_repeatable: d.isRepeatable,
    cooldown_hours: d.cooldownHours,
    user_limit: d.userLimit ?? null,
    is_active: d.isActive,
    position: d.position,
    starts_at: d.startsAt ? new Date(d.startsAt).toISOString() : null,
    ends_at: d.endsAt ? new Date(d.endsAt).toISOString() : null,
  };

  const { error } = id
    ? await supabase.from("earn_tasks").update(payload).eq("id", id)
    : await supabase.from("earn_tasks").insert(payload);

  if (error) return toActionError(error);

  await logAdminAction({
    action: id ? "task.update" : "task.create",
    entityType: "earn_task",
    entityId: id || null,
    afterData: payload,
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/earn");
  return ok(null, id ? "Task updated." : "Task created.");
}

export async function deleteEarnTask(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("earn_tasks").delete().eq("id", id);
  if (error) return toActionError(error);

  await logAdminAction({ action: "task.delete", entityType: "earn_task", entityId: id });

  revalidatePath("/admin/tasks");
  revalidatePath("/earn");
  return ok(null, "Task deleted.");
}

export async function reviewTaskSubmission(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(reviewTaskSchema, {
    submissionId: formString(fd, "submissionId"),
    approve: formBool(fd, "approve"),
    note: formString(fd, "note"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("review_task_submission", {
    p_submission_id: d.submissionId,
    p_approve: d.approve,
    p_note: d.note || null,
  });

  if (error) return toActionError(error);

  await logAdminAction({
    action: d.approve ? "task.approve" : "task.reject",
    entityType: "task_submission",
    entityId: d.submissionId,
  });

  revalidatePath("/admin/tasks/submissions");
  revalidatePath("/earn");
  return ok(null, d.approve ? "Approved and reward credited." : "Submission rejected.");
}

// ------------------------------------------------------------------- ads
export async function saveAdPlacement(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseOrFail(adPlacementSchema, {
    placement: formString(fd, "placement"),
    provider: formString(fd, "provider"),
    format: formString(fd, "format") || "banner",
    unitId: formString(fd, "unitId"),
    scriptUrl: formString(fd, "scriptUrl"),
    scriptKey: formString(fd, "scriptKey"),
    isActive: formBool(fd, "isActive"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_ad_placement", {
    p_placement: d.placement,
    p_provider: d.provider,
    p_format: d.format,
    p_unit_id: d.unitId || null,
    p_script_url: d.scriptUrl || null,
    p_script_key: d.scriptKey || null,
    p_is_active: d.isActive,
  });

  if (error) return toActionError(error);

  await logAdminAction({
    action: "ads.configure",
    entityType: "ad_placement",
    entityId: d.placement,
    afterData: { provider: d.provider, format: d.format, is_active: d.isActive },
  });

  revalidatePath("/admin/settings/ads");
  revalidatePath("/", "layout");
  return ok(null, "Ad placement saved.");
}
