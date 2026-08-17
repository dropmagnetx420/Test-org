"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser, requireAdmin, rateLimit, logAdminAction } from "@/lib/auth";
import { ok, fail, parseOrFail, toActionError, formString } from "@/lib/action-utils";
import { supportMessageSchema } from "@/lib/validations";
import type { ActionResult, SupportMessage } from "@/types/database";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SentMessage = { conversationId: string; message: SupportMessage };

/**
 * User → support. Lazily opens the caller's single thread, then posts a message.
 * The DB trigger advances the thread and bumps the admin's unread counter; RLS
 * guarantees the row can only land in the caller's own conversation as 'user'.
 */
export async function sendSupportMessage(
  _prev: ActionResult<SentMessage> | null,
  fd: FormData
): Promise<ActionResult<SentMessage>> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  if (!(await rateLimit("CHAT", user.id))) {
    return fail("You're sending messages too quickly. Please wait a moment.");
  }

  const parsed = parseOrFail(supportMessageSchema, { body: formString(fd, "body") });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();

  const existing = await supabase
    .from("support_conversations")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.error) return toActionError(existing.error);

  let conversationId = existing.data?.id as string | undefined;
  if (!conversationId) {
    const created = await supabase
      .from("support_conversations")
      .insert({ user_id: user.id })
      .select("id")
      .maybeSingle();
    if (created.error || !created.data) return toActionError(created.error);
    conversationId = created.data.id;
  }
  if (!conversationId) return fail("Could not open a conversation.");

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: "user",
      body: parsed.data.body,
    })
    .select("*")
    .single();

  if (error) return toActionError(error);
  return ok({ conversationId, message: data as SupportMessage });
}

/** Admin → user reply into an existing thread. */
export async function sendAdminSupportReply(
  _prev: ActionResult<SentMessage> | null,
  fd: FormData
): Promise<ActionResult<SentMessage>> {
  await requireAdmin();
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const conversationId = formString(fd, "conversationId");
  if (!UUID_RE.test(conversationId)) return fail("Invalid conversation.");

  const parsed = parseOrFail(supportMessageSchema, { body: formString(fd, "body") });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: "admin",
      body: parsed.data.body,
    })
    .select("*")
    .single();

  if (error) return toActionError(error);
  return ok({ conversationId, message: data as SupportMessage });
}

/** Clears the caller's unread counter (definer RPC picks the right side by role). */
export async function markSupportRead(conversationId: string): Promise<void> {
  if (!UUID_RE.test(conversationId)) return;
  const user = await getUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase.rpc("mark_support_read", { p_conversation_id: conversationId });
}

/** Admin closes or reopens a thread. */
export async function setConversationStatus(
  conversationId: string,
  status: "open" | "closed"
): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(conversationId)) return fail("Invalid conversation.");
  if (status !== "open" && status !== "closed") return fail("Invalid status.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_conversations")
    .update({ status })
    .eq("id", conversationId);

  if (error) return toActionError(error);

  await logAdminAction({
    action: status === "closed" ? "support.close" : "support.reopen",
    entityType: "support_conversation",
    entityId: conversationId,
  });

  return ok(null, status === "closed" ? "Conversation closed." : "Conversation reopened.");
}
