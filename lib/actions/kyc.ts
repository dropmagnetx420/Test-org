"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, rateLimit } from "@/lib/auth";
import { ok, fail, parseOrFail, toActionError, formString } from "@/lib/action-utils";
import { kycSchema } from "@/lib/validations";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { ActionResult, KycRequest } from "@/types/database";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Uploads one KYC file into the caller's own folder. The storage policy
 * enforces that the first path segment matches auth.uid().
 */
export async function uploadKycFile(fd: FormData): Promise<ActionResult<{ path: string }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const file = fd.get("file");
  const kind = formString(fd, "kind");

  if (!(file instanceof File) || file.size === 0) return fail("Select a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) return fail("File is too large. Maximum size is 6 MB.");
  if (!ALLOWED_TYPES.includes(file.type)) {
    return fail("Unsupported file type. Upload a JPG, PNG, WebP or PDF.");
  }
  if (!["front", "back", "selfie"].includes(kind)) return fail("Invalid upload type.");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${kind}-${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.KYC)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) return fail("Upload failed. Please try again.");
  return ok({ path });
}

export async function submitKyc(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult<KycRequest>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!(await rateLimit("KYC", user.id))) {
    return fail("Too many submissions. Please wait before trying again.");
  }

  const parsed = parseOrFail(kycSchema, {
    documentType: formString(fd, "documentType"),
    documentNumber: formString(fd, "documentNumber"),
    fullName: formString(fd, "fullName"),
    dateOfBirth: formString(fd, "dateOfBirth"),
    country: formString(fd, "country"),
    address: formString(fd, "address"),
    documentFrontUrl: formString(fd, "documentFrontUrl"),
    documentBackUrl: formString(fd, "documentBackUrl"),
    selfieUrl: formString(fd, "selfieUrl"),
  });
  if (!parsed.ok) return parsed.result;

  const d = parsed.data;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .single();

  if (profile?.kyc_status === "approved") {
    return fail("Your identity is already verified.");
  }
  if (profile?.kyc_status === "pending") {
    return fail("You already have a verification in review.");
  }

  const { data, error } = await supabase
    .from("kyc_requests")
    .insert({
      user_id: user.id,
      document_type: d.documentType,
      document_number: d.documentNumber,
      full_name: d.fullName,
      date_of_birth: d.dateOfBirth,
      country: d.country,
      address: d.address || null,
      document_front_url: d.documentFrontUrl,
      document_back_url: d.documentBackUrl || null,
      selfie_url: d.selfieUrl,
      status: "pending",
    })
    .select()
    .single();

  if (error) return toActionError(error);

  await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user.id);

  revalidatePath("/kyc");
  revalidatePath("/dashboard");

  return ok(data as KycRequest, "Documents submitted. Verification usually takes up to 24 hours.");
}

/** Signed URL for viewing a private KYC/receipt object. */
export async function getSignedFileUrl(
  bucket: string,
  path: string
): Promise<ActionResult<{ url: string }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const allowed: string[] = [
    STORAGE_BUCKETS.KYC,
    STORAGE_BUCKETS.RECEIPTS,
    STORAGE_BUCKETS.TASK_PROOFS,
  ];
  if (!allowed.includes(bucket)) return fail("Invalid bucket.");

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);

  if (error || !data) return fail("Could not generate a preview link.");
  return ok({ url: data.signedUrl });
}
