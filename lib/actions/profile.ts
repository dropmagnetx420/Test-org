"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, rateLimit } from "@/lib/auth";
import { ok, fail, toActionError } from "@/lib/action-utils";
import { STORAGE_BUCKETS } from "@/lib/constants";
import type { ActionResult } from "@/types/database";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

/** A real raster image — no vectors (SVG can carry script) and no PDFs. */
function isAllowedImage(type: string) {
  return type.startsWith("image/") && type !== "image/svg+xml";
}

/**
 * Stores a new avatar in the caller's own folder and points the profile at its
 * public URL. The storage policy pins the first path segment to auth.uid(), and
 * `avatar_url` is a self-updatable column, so the ordinary client is enough.
 */
export async function uploadAvatar(fd: FormData): Promise<ActionResult<{ url: string }>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!(await rateLimit("DEFAULT", user.id))) {
    return fail("Too many uploads. Please wait a moment.");
  }

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image to upload.");
  if (file.size > MAX_AVATAR_BYTES) return fail("Image is too large. Maximum size is 4 MB.");
  if (!isAllowedImage(file.type)) return fail("Unsupported file type. Upload a JPG, PNG or WebP.");

  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) return fail("Upload failed. Please try again.");

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKETS.AVATARS).getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);
  if (error) return toActionError(error);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return ok({ url: publicUrl }, "Profile picture updated.");
}

/** Clears the avatar. The old object is left in storage; a later upload simply
 *  supersedes the URL, and public objects here carry no private data. */
export async function removeAvatar(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) return toActionError(error);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return ok(null, "Profile picture removed.");
}
