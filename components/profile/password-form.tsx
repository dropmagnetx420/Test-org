"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { updatePassword } from "@/lib/actions/auth";
import type { ActionResult } from "@/types/database";

export function PasswordForm() {
  const [show, setShow] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updatePassword, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success(state.message ?? "Password updated.");
  }, [state]);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Use at least 8 characters with a number and a symbol.</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                className="pr-10"
                aria-invalid={Boolean(state?.fieldErrors?.password)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {state?.fieldErrors?.password && (
              <p className="text-xs text-red-400">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)}
            />
            {state?.fieldErrors?.confirmPassword && (
              <p className="text-xs text-red-400">{state.fieldErrors.confirmPassword[0]}</p>
            )}
          </div>

          <SubmitButton variant="outline" pendingText="Updating…">
            <KeyRound className="size-4" />
            Update password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
