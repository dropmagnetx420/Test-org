"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Headset,
  Loader2,
  MessagesSquare,
  RotateCcw,
  Send,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import {
  sendAdminSupportReply,
  markSupportRead,
  setConversationStatus,
} from "@/lib/actions/support";
import { cn } from "@/lib/utils";
import type {
  SupportConversationWithUser,
  SupportMessage,
} from "@/types/database";

type Filter = "open" | "closed" | "all";

/** Conversation-list scalars that the realtime UPDATE payload carries. The join
 *  to `profiles` is not in the payload, so we merge these onto the row we hold. */
type ConvoScalars = Omit<SupportConversationWithUser, "user">;

function mergeMessage(list: SupportMessage[], msg: SupportMessage) {
  if (list.some((m) => m.id === msg.id)) return list;
  const next = [...list, msg];
  next.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return next;
}

function sortConversations(list: SupportConversationWithUser[]) {
  return [...list].sort((a, b) => {
    const at = a.last_message_at ?? a.created_at;
    const bt = b.last_message_at ?? b.created_at;
    return bt.localeCompare(at);
  });
}

function displayName(c: SupportConversationWithUser) {
  return (
    c.user?.full_name || c.user?.username || c.user?.email || `Member ${c.user_id.slice(0, 6)}`
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same
    ? timeLabel(iso)
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function SupportInbox({
  initialConversations,
}: {
  initialConversations: SupportConversationWithUser[];
}) {
  const [conversations, setConversations] = useState(() =>
    sortConversations(initialConversations)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [reply, setReply] = useState("");
  const [statusPending, startStatusTransition] = useTransition();
  const [sending, startSending] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<string | null>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return conversations;
    return conversations.filter((c) => c.status === filter);
  }, [conversations, filter]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const patchConversation = useCallback(
    (id: string, patch: Partial<SupportConversationWithUser>) => {
      setConversations((prev) =>
        sortConversations(prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
      );
    },
    []
  );

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  // Keep the conversation list live: reorder on new activity, refresh unread
  // counts, surface brand-new threads. UPDATE payloads lack the joined profile,
  // so we merge scalars; INSERTs fetch the one row with its user attached.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-support-conversations")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations" },
        (payload) => {
          const row = payload.new as ConvoScalars;
          setConversations((prev) =>
            sortConversations(
              prev.map((c) => (c.id === row.id ? { ...c, ...row } : c))
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_conversations" },
        async (payload) => {
          const row = payload.new as ConvoScalars;
          const { data } = await supabase
            .from("support_conversations")
            .select(
              "*, user:profiles!support_conversations_user_id_fkey(id,email,username,full_name,avatar_url)"
            )
            .eq("id", row.id)
            .maybeSingle();
          if (!data) return;
          setConversations((prev) =>
            sortConversations([
              data as SupportConversationWithUser,
              ...prev.filter((c) => c.id !== row.id),
            ])
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Load the selected thread and stream its new messages. Clearing admin_unread
  // on open (and on each inbound user message) keeps the badge honest.
  useEffect(() => {
    if (!selectedId) return;
    const supabase = createClient();
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      if (!active) return;
      setMessages((data as SupportMessage[]) ?? []);
      setLoadingThread(false);
      void markSupportRead(selectedId);
      patchConversation(selectedId, { admin_unread: 0 });
    })();

    const channel = supabase
      .channel(`admin-support:${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const msg = payload.new as SupportMessage;
          setMessages((prev) => mergeMessage(prev, msg));
          if (msg.sender_role === "user" && selectedRef.current === selectedId) {
            void markSupportRead(selectedId);
            patchConversation(selectedId, { admin_unread: 0 });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedId, patchConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function openConversation(id: string) {
    setSelectedId(id);
    setLoadingThread(true);
  }

  function submitReply(formData: FormData) {
    startSending(async () => {
      const res = await sendAdminSupportReply(null, formData);
      if (res.success && res.data) {
        setMessages((prev) => mergeMessage(prev, res.data!.message));
        setReply("");
      } else {
        toast.error(res.error ?? "Could not send your reply.");
      }
    });
  }

  function toggleStatus() {
    if (!selected) return;
    const next = selected.status === "open" ? "closed" : "open";
    startStatusTransition(async () => {
      const res = await setConversationStatus(selected.id, next);
      if (res.success) {
        patchConversation(selected.id, { status: next });
        toast.success(next === "closed" ? "Conversation closed." : "Conversation reopened.");
      } else {
        toast.error(res.error ?? "Could not update the conversation.");
      }
    });
  }

  const totalUnread = conversations.reduce((n, c) => n + (c.admin_unread || 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Conversation list */}
      <aside
        className={cn(
          "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
          selected && "hidden lg:flex"
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/60 p-2">
          {(["open", "closed", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {f}
              {f === "open" && totalUnread > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="max-h-[32rem] flex-1 overflow-y-auto lg:max-h-[36rem]">
          {filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <MessagesSquare className="size-7 opacity-40" />
              <p className="mt-2">No {filter === "all" ? "" : filter} conversations.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {filtered.map((c) => {
                const name = displayName(c);
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                        active ? "bg-primary/10" : "hover:bg-secondary/50"
                      )}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarImage src={c.user?.avatar_url ?? undefined} alt="" />
                        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{name}</p>
                          {c.last_message_at && (
                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                              {dayLabel(c.last_message_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs text-muted-foreground">
                            {c.last_sender_role === "admin"
                              ? "You replied"
                              : c.last_sender_role === "user"
                                ? "New from member"
                                : "—"}
                          </p>
                          {c.status === "closed" && (
                            <span className="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              Closed
                            </span>
                          )}
                          {c.admin_unread > 0 && (
                            <span className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              {c.admin_unread > 9 ? "9+" : c.admin_unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={cn(
          "flex h-[36rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
          !selected && "hidden lg:flex"
        )}
      >
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
            <Headset className="size-9 opacity-40" />
            <p className="mt-3 text-sm">Select a conversation to reply.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Back to list"
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground lg:hidden"
              >
                <ArrowLeft className="size-4" />
              </button>
              <Avatar className="size-9 shrink-0">
                <AvatarImage src={selected.user?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="text-xs">
                  {initials(displayName(selected))}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName(selected)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.user?.email ?? selected.user_id}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleStatus}
                disabled={statusPending}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                  selected.status === "open"
                    ? "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                )}
              >
                {statusPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : selected.status === "open" ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                {selected.status === "open" ? "Close" : "Reopen"}
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {loadingThread ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_role === "admin";
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : m.sender_role === "system"
                              ? "rounded-bl-sm bg-secondary/60 text-muted-foreground"
                              : "rounded-bl-sm bg-secondary text-foreground"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {timeLabel(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              action={submitReply}
              className="flex items-end gap-2 border-t border-border/60 p-3"
            >
              <input type="hidden" name="conversationId" value={selected.id} />
              <textarea
                name="body"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (reply.trim()) e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Type your reply…"
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                aria-label="Send reply"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
