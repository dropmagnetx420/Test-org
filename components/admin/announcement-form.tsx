"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { sendAnnouncement } from "@/lib/actions/admin";
import type { ActionResult } from "@/types/database";

export function AnnouncementForm({ recipients }: { recipients: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(sendAnnouncement, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Announcement sent.");
      formRef.current?.reset();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const err = state?.fieldErrors;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Compose</CardTitle>
        <CardDescription>
          Delivered to the notification inbox of all {recipients.toLocaleString()} active user
          {recipients === 1 ? "" : "s"}. There is no undo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              maxLength={120}
              required
              placeholder="Scheduled maintenance on Sunday"
            />
            {err?.title && <p className="text-xs text-red-400">{err.title[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              rows={5}
              maxLength={1000}
              required
              placeholder="Trading will pause between 02:00 and 04:00 UTC while we upgrade settlement."
            />
            {err?.message && <p className="text-xs text-red-400">{err.message[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">
              Link <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="link" name="link" maxLength={300} placeholder="/markets" />
            <p className="text-xs text-muted-foreground">
              Where the notification takes the user when tapped.
            </p>
            {err?.link && <p className="text-xs text-red-400">{err.link[0]}</p>}
          </div>

          <div className="flex justify-end">
            <SubmitButton variant="gradient" pendingText="Sending…">
              Send to everyone
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
