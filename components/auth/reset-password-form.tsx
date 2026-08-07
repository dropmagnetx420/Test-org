"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { updatePassword } from "@/lib/actions/auth";
import type { ActionResult } from "@/types/database";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updatePassword, null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success && state.message) toast.success(state.message);
  }, [state]);

  if (state?.success) {
    return (
      <Card className="glass-strong">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="size-7" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Password updated</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-strong">
      <CardHeader>
        <CardTitle className="text-2xl">Set a new password</CardTitle>
        <CardDescription>Choose a strong password you have not used before.</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="••••••••"
                className="pr-10"
                aria-invalid={Boolean(state?.fieldErrors?.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {state?.fieldErrors?.password && (
              <p className="text-xs text-red-400">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder="••••••••"
              aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)}
            />
            {state?.fieldErrors?.confirmPassword && (
              <p className="text-xs text-red-400">{state.fieldErrors.confirmPassword[0]}</p>
            )}
          </div>

          <SubmitButton variant="gradient" size="lg" className="w-full" pendingText="Updating…">
            Update password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
