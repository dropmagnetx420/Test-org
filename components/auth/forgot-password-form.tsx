"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { requestPasswordReset } from "@/lib/actions/auth";
import type { ActionResult } from "@/types/database";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    requestPasswordReset,
    null
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  if (state?.success) {
    return (
      <Card className="glass-strong">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
            <MailCheck className="size-7" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Reset link sent</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-strong">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          Enter the email on your account and we&apos;ll send a secure link to set a new password.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-invalid={Boolean(state?.fieldErrors?.email)}
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-red-400">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          <SubmitButton variant="gradient" size="lg" className="w-full" pendingText="Sending link…">
            Send reset link
          </SubmitButton>
        </form>

        <Link
          href="/login"
          className="flex items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
