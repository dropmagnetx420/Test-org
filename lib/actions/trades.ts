"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, rateLimit } from "@/lib/auth";
import { ok, fail, parseOrFail, toActionError, formString, formNumber } from "@/lib/action-utils";
import { placeTradeSchema, cancelTradeSchema } from "@/lib/validations";
import type { ActionResult, Trade } from "@/types/database";

export async function placeTrade(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<Trade>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to place a trade.");

  if (!(await rateLimit("TRADE", user.id))) {
    return fail("You are trading too quickly. Please slow down.");
  }

  const parsed = parseOrFail(placeTradeSchema, {
    marketId: formString(fd, "marketId"),
    optionId: formString(fd, "optionId"),
    amount: formNumber(fd, "amount"),
  });
  if (!parsed.ok) return parsed.result;

  const { marketId, optionId, amount } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("place_trade", {
    p_market_id: marketId,
    p_option_id: optionId,
    p_amount: amount,
  });

  if (error) return toActionError(error);

  revalidatePath("/markets");
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/predictions");
  revalidatePath("/wallet");

  return ok(data as Trade, `Position opened for ${amount} USDG.`);
}

export async function cancelTrade(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<Trade>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!(await rateLimit("TRADE", user.id))) {
    return fail("Too many requests. Please slow down.");
  }

  const parsed = parseOrFail(cancelTradeSchema, { tradeId: formString(fd, "tradeId") });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_trade", { p_trade_id: parsed.data.tradeId });

  if (error) return toActionError(error);

  const trade = data as Trade;
  revalidatePath("/markets");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/predictions");
  revalidatePath("/wallet");

  return ok(trade, `Trade cancelled. ${trade.payout} USDG returned to your balance.`);
}
