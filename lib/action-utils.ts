import type { ActionResult } from "@/types/database";
import { z } from "zod";

/** Maps Postgres/PLpgSQL error identifiers to user-safe messages. */
const DB_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in to continue.",
  FORBIDDEN: "You do not have permission to do that.",
  ACCOUNT_RESTRICTED: "Your account is restricted. Contact support.",
  PROFILE_NOT_FOUND: "Profile not found.",
  WALLET_NOT_FOUND: "Wallet not found.",
  MARKET_NOT_FOUND: "This market no longer exists.",
  MARKET_NOT_OPEN: "This market is not accepting trades.",
  MARKET_CLOSED: "This market has closed.",
  AMOUNT_OUT_OF_RANGE: "Amount is outside the allowed range for this market.",
  INVALID_AMOUNT: "Enter a valid amount.",
  INSUFFICIENT_BALANCE: "Insufficient balance.",
  TRADE_NOT_FOUND: "Trade not found.",
  TRADE_NOT_OPEN: "This trade can no longer be cancelled.",
  ALREADY_RESOLVED: "This market has already been resolved.",
  ALREADY_SETTLED: "This market has already been settled.",
  ALREADY_REVIEWED: "This request has already been reviewed.",
  REQUEST_NOT_FOUND: "Request not found.",
  REQUEST_NOT_PENDING: "This request is no longer pending.",
  USER_NOT_FOUND: "User not found.",
  KYC_REQUIRED: "Complete identity verification before withdrawing.",
  BELOW_MIN_WITHDRAWAL: "Amount is below the minimum withdrawal.",
  TURNOVER_INCOMPLETE: "Complete your bonus turnover requirement before withdrawing.",
  NO_ADDRESS_AVAILABLE: "No deposit address is available. Please try again shortly.",
  PROMO_UNAVAILABLE: "This promotion is no longer available.",
  PROMO_NOT_STARTED: "This promotion has not started yet.",
  PROMO_EXPIRED: "This promotion has expired.",
  PROMO_LIMIT_REACHED: "This promotion has reached its participant limit.",
  ALREADY_CLAIMED: "You have already claimed this promotion.",
  TASKS_DISABLED: "Task rewards are currently unavailable.",
  TASK_UNAVAILABLE: "This task is no longer available.",
  TASK_NOT_STARTED: "This task has not started yet.",
  TASK_EXPIRED: "This task has expired.",
  TASK_LIMIT_REACHED: "This task has reached its participant limit.",
  TASK_COOLDOWN: "You have already completed this task recently. Try again later.",
  PROOF_REQUIRED: "Upload a screenshot as proof before submitting.",
  SUBMISSION_PENDING: "Your submission for this task is already under review.",
  ALREADY_COMPLETED: "You have already completed this task.",
  ADS_DISABLED: "Ad rewards are currently unavailable.",
  WATCH_TOO_SHORT: "Please watch the full ad before claiming.",
  AD_LIMIT_REACHED: "You have reached today's ad reward limit.",
};

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { success: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}

/** Turns any thrown value into a safe, user-facing ActionResult. */
export function toActionError(err: unknown): ActionResult<never> {
  if (err && typeof err === "object" && "message" in err) {
    const raw = String((err as { message: string }).message);

    for (const [code, message] of Object.entries(DB_ERROR_MESSAGES)) {
      if (raw.includes(code)) return fail(message);
    }

    if (raw.includes("duplicate key")) {
      if (raw.includes("tx_hash")) {
        return fail("This transaction hash has already been submitted.");
      }
      if (raw.includes("kyc_requests_one_pending")) {
        return fail("You already have a KYC review in progress.");
      }
      if (raw.includes("username")) return fail("That username is already taken.");
      return fail("This record already exists.");
    }

    if (raw.includes("violates row-level security")) {
      return fail("You do not have permission to do that.");
    }
  }

  return fail("Something went wrong. Please try again.");
}

/** Parses a schema and returns structured field errors on failure. */
export function parseOrFail<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): { ok: true; data: z.infer<T> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const flat = parsed.error.flatten();
  const first =
    Object.values(flat.fieldErrors).flat()[0] ??
    flat.formErrors[0] ??
    "Please check the form and try again.";

  return {
    ok: false,
    result: fail(String(first), flat.fieldErrors as Record<string, string[]>),
  };
}

/** Reads a numeric field from FormData, returning NaN when absent. */
export function formNumber(fd: FormData, key: string): number {
  const raw = fd.get(key);
  if (raw === null || raw === "") return NaN;
  return Number(raw);
}

/** Blank means "not set" rather than zero, so it maps to null instead of NaN. */
export function optionalNumber(fd: FormData, key: string): number | null {
  const raw = fd.get(key);
  if (raw === null || raw === "") return null;
  return Number(raw);
}

export function formString(fd: FormData, key: string): string {
  const raw = fd.get(key);
  return typeof raw === "string" ? raw : "";
}

export function formBool(fd: FormData, key: string): boolean {
  const raw = fd.get(key);
  return raw === "true" || raw === "on" || raw === "1";
}
