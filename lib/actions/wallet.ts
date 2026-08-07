"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, rateLimit } from "@/lib/auth";
import { ok, fail, parseOrFail, toActionError, formString, formNumber } from "@/lib/action-utils";
import { depositSchema, withdrawSchema } from "@/lib/validations";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { ActionResult, DepositAddress, DepositRequest, WithdrawRequest } from "@/types/database";

const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;
const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Uploads a deposit receipt into the caller's own folder. The storage policy
 * requires the first path segment to equal auth.uid().
 */
export async function uploadReceipt(fd: FormData): Promise<ActionResult<{ path: string }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Select a file to upload.");
  if (file.size > MAX_RECEIPT_BYTES) return fail("File is too large. Maximum size is 6 MB.");
  if (!RECEIPT_TYPES.includes(file.type)) {
    return fail("Unsupported file type. Upload a JPG, PNG, WebP or PDF.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/receipt-${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.RECEIPTS)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) return fail("Upload failed. Please try again.");
  return ok({ path });
}

export async function getDepositAddress(
  network: string,
  asset: string
): Promise<ActionResult<DepositAddress>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_deposit_address", {
    p_network: network,
    p_asset: asset,
  });

  if (error) return toActionError(error);
  return ok(data as DepositAddress);
}

export async function submitDeposit(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<DepositRequest>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!(await rateLimit("DEPOSIT", user.id))) {
    return fail("Too many deposit requests. Please wait a few minutes.");
  }

  const parsed = parseOrFail(depositSchema, {
    amount: formNumber(fd, "amount"),
    network: formString(fd, "network"),
    asset: formString(fd, "asset"),
    txHash: formString(fd, "txHash"),
    depositAddress: formString(fd, "depositAddress"),
    receiptUrl: formString(fd, "receiptUrl"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("min_deposit")
    .eq("id", 1)
    .single();

  const minDeposit = Number(settings?.min_deposit ?? 0);
  if (parsed.data.amount < minDeposit) {
    return fail(`Minimum deposit is ${minDeposit} USDG.`);
  }

  const { data, error } = await supabase
    .from("deposit_requests")
    .insert({
      user_id: user.id,
      amount: parsed.data.amount,
      network: parsed.data.network,
      asset: parsed.data.asset,
      tx_hash: parsed.data.txHash,
      deposit_address: parsed.data.depositAddress,
      receipt_url: parsed.data.receiptUrl || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return toActionError(error);

  revalidatePath("/wallet");
  revalidatePath("/wallet/deposit");
  revalidatePath("/dashboard");

  return ok(
    data as DepositRequest,
    "Deposit submitted. Your balance updates once an admin confirms the transaction."
  );
}

export async function submitWithdrawal(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<WithdrawRequest>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!(await rateLimit("WITHDRAW", user.id))) {
    return fail("Too many withdrawal requests. Please wait a few minutes.");
  }

  const parsed = parseOrFail(withdrawSchema, {
    amount: formNumber(fd, "amount"),
    network: formString(fd, "network"),
    asset: formString(fd, "asset"),
    walletAddress: formString(fd, "walletAddress"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_withdrawal", {
    p_amount: parsed.data.amount,
    p_network: parsed.data.network,
    p_asset: parsed.data.asset,
    p_address: parsed.data.walletAddress,
  });

  if (error) return toActionError(error);

  revalidatePath("/wallet");
  revalidatePath("/wallet/withdraw");
  revalidatePath("/dashboard");

  return ok(
    data as WithdrawRequest,
    "Withdrawal requested. Funds are on hold pending admin approval."
  );
}
