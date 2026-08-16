"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { GoogleButton } from "@/components/auth/google-button";
import { WalletButton } from "@/components/auth/wallet-button";
import { signIn } from "@/lib/actions/auth";
import type { ActionResult } from "@/types/database";

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: "That sign-in link is invalid or has expired. Please try again.",
  oauth_failed: "Google sign-in could not be started. Please try again.",
};

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const urlError = params.get("error");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signIn, null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (urlError) toast.error(ERROR_MESSAGES[urlError] ?? "Something went wrong. Please try again.");
  }, [urlError]);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <Card className="glass-strong">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to place predictions and manage your wallet.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <GoogleButton next={next} />
        <WalletButton next={next} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="pl-9"
                aria-invalid={Boolean(state?.fieldErrors?.email)}
              />
            </div>
            {state?.fieldErrors?.email && (
              <p className="text-xs text-red-400">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-primary transition-colors hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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

          <SubmitButton variant="gradient" size="lg" className="w-full" pendingText="Signing in…">
            Sign in
          </SubmitButton>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New to NextGen Predict?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
