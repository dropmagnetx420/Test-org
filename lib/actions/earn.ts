"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, rateLimit } from "@/lib/auth";
import { ok, fail, parseOrFail, toActionError, formString } from "@/lib/action-utils";
import { taskSubmissionSchema } from "@/lib/validations";
import { AD_PLACEMENTS, AD_PROVIDERS, STORAGE_BUCKETS } from "@/lib/constants";
import type {
  ActionResult,
  AdPlacementSlot,
  AdProvider,
  TaskSubmission,
} from "@/types/database";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Uploads a proof screenshot into the caller's own folder. The storage policy
 * enforces that the first path segment matches auth.uid().
 */
export async function uploadTaskProof(fd: FormData): Promise<ActionResult<{ path: string }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Select a screenshot to upload.");
  if (file.size > MAX_PROOF_BYTES) return fail("Screenshot is too large. Maximum size is 5 MB.");
  if (!PROOF_TYPES.includes(file.type)) {
    return fail("Unsupported file type. Upload a JPG, PNG or WebP screenshot.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/proof-${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.TASK_PROOFS)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) return fail("Upload failed. Please try again.");
  return ok({ path });
}

export async function submitTaskProof(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<TaskSubmission>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!(await rateLimit("TASK", user.id))) {
    return fail("Too many submissions. Please wait before trying again.");
  }

  const parsed = parseOrFail(taskSubmissionSchema, {
    taskId: formString(fd, "taskId"),
    proofUrl: formString(fd, "proofUrl"),
    proofNote: formString(fd, "proofNote"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("submit_task_proof", {
    p_task_id: d.taskId,
    p_proof_url: d.proofUrl || null,
    p_proof_note: d.proofNote || null,
  });

  if (error) return toActionError(error);

  revalidatePath("/earn");

  return ok(data as TaskSubmission, "Submitted for review. You will be notified once approved.");
}

const PLACEMENT_VALUES = AD_PLACEMENTS.map((p) => p.value) as readonly string[];
const PROVIDER_VALUES = AD_PROVIDERS.map((p) => p.value) as readonly string[];

/**
 * Credits the ad reward once the watch requirement is met. The minimum watch
 * time is enforced again in the database, so a tampered client gains nothing.
 */
export async function claimAdReward(input: {
  placement: AdPlacementSlot;
  provider?: AdProvider | null;
  watchMs: number;
}): Promise<ActionResult<{ reward: number }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!PLACEMENT_VALUES.includes(input.placement)) return fail("Invalid ad placement.");
  if (input.provider && !PROVIDER_VALUES.includes(input.provider)) {
    return fail("Invalid ad provider.");
  }

  const watchMs = Number(input.watchMs);
  if (!Number.isFinite(watchMs) || watchMs < 0) return fail("Invalid watch time.");

  if (!(await rateLimit("AD_CLAIM", user.id))) {
    return fail("Too many claims. Please wait before trying again.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_ad_reward", {
    p_placement: input.placement,
    p_provider: input.provider ?? null,
    p_watch_ms: Math.min(Math.round(watchMs), 3_600_000),
  });

  if (error) return toActionError(error);

  revalidatePath("/earn");
  revalidatePath("/wallet");

  return ok({ reward: Number(data ?? 0) }, "Reward credited to your wallet.");
}
