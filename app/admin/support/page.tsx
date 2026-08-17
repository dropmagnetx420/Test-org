import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SupportInbox } from "@/components/admin/support-inbox";
import type { SupportConversationWithUser } from "@/types/database";

export const metadata: Metadata = { title: "Support · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("support_conversations")
    .select(
      "*, user:profiles!support_conversations_user_id_fkey(id,email,username,full_name,avatar_url)"
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const conversations = (data as SupportConversationWithUser[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Support inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reply to member questions in real time. New messages bump a conversation to the top and
          light up its unread badge.
        </p>
      </header>

      <SupportInbox initialConversations={conversations} />
    </div>
  );
}
