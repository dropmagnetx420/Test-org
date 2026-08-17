"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle, X, Send, Headset } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendSupportMessage, markSupportRead } from "@/lib/actions/support";
import { cn } from "@/lib/utils";
import type { SupportMessage } from "@/types/database";

function mergeMessage(list: SupportMessage[], msg: SupportMessage) {
  if (list.some((m) => m.id === msg.id)) return list;
  const next = [...list, msg];
  next.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return next;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);

  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Load the caller's thread once (RLS returns only their own row).
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    (async () => {
      const { data: conv } = await supabase
        .from("support_conversations")
        .select("id, user_unread")
        .maybeSingle();
      if (!active || !conv) return;

      setConversationId(conv.id);
      setUnread(conv.user_unread ?? 0);

      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      if (active && msgs) setMessages(msgs as SupportMessage[]);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Stream new messages for the thread.
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`support:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as SupportMessage;
          setMessages((prev) => mergeMessage(prev, msg));
          if (msg.sender_role !== "user") {
            if (openRef.current) void markSupportRead(conversationId);
            else setUnread((n) => n + 1);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, open, scrollToBottom]);

  function submitMessage(formData: FormData) {
    startSending(async () => {
      setError(null);
      const res = await sendSupportMessage(null, formData);
      if (res.success && res.data) {
        setConversationId(res.data.conversationId);
        setMessages((prev) => mergeMessage(prev, res.data!.message));
        setText("");
      } else {
        setError(res.error ?? "Could not send your message. Please try again.");
      }
    });
  }

  function openPanel() {
    setOpen(true);
    setUnread(0);
    if (conversationId) void markSupportRead(conversationId);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label="Open support chat"
          className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="size-6" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[32rem] max-h-[calc(100dvh-2.5rem)] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <header className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-primary/15 to-accent/10 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Headset className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Support</p>
              <p className="text-xs text-muted-foreground">We usually reply within a few hours.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageCircle className="size-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">How can we help?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send us a message about any issue and our team will get back to you here.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_role === "user";
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
                      <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {timeLabel(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error && (
            <p className="px-4 pb-1 text-xs text-red-400">{error}</p>
          )}

          <form
            action={submitMessage}
            className="flex items-end gap-2 border-t border-border/60 p-3"
          >
            <textarea
              name="body"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (text.trim()) e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Type your message…"
              className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send message"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
