"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { GoogleButton } from "@/components/auth/google-button";
import { signUp } from "@/lib/actions/auth";
import type { ActionResult } from "@/types/database";

const RULES = [
  { test: (v: string) => v.length >= 8, label: "At least 8 characters" },
  { test: (v: string) => /[a-z]/.test(v), label: "One lowercase letter" },
  { test: (v: string) => /[A-Z]/.test(v), label: "One uppercase letter" },
  { test: (v: string) => /[0-9]/.test(v), label: "One number" },
];

export function RegisterForm() {
  const params = useSearchParams();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signUp, null);
  const [password, setPassword] = useState("");
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
            <Mail className="size-7" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              {state.message ?? "We sent you a verification link to activate your account."}
            </p>
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
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start trading sports predictions in under a minute.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <GoogleButton />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or sign up with email</span>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              placeholder="Ada Lovelace"
              aria-invalid={Boolean(state?.fieldErrors?.fullName)}
            />
            {state?.fieldErrors?.fullName && (
              <p className="text-xs text-red-400">{state.fieldErrors.fullName[0]}</p>
            )}
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            {password.length > 0 && (
              <ul className="grid grid-cols-2 gap-1 pt-1">
                {RULES.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className={`flex items-center gap-1 text-[11px] ${
                        passed ? "text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      <CheckCircle2 className="size-3" />
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}
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

          <div className="space-y-2">
            <Label htmlFor="referralCode">
              Referral code <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="referralCode"
              name="referralCode"
              defaultValue={params.get("ref") ?? ""}
              placeholder="ABC12345"
              className="font-mono uppercase"
              aria-invalid={Boolean(state?.fieldErrors?.referralCode)}
            />
            {state?.fieldErrors?.referralCode && (
              <p className="text-xs text-red-400">{state.fieldErrors.referralCode[0]}</p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="acceptTerms" name="acceptTerms" className="mt-0.5" />
            <Label htmlFor="acceptTerms" className="text-xs font-normal leading-relaxed text-muted-foreground">
              I am at least 18 years old and accept the terms of service and risk disclosure.
              Prediction markets can result in loss of funds.
            </Label>
          </div>
          {state?.fieldErrors?.acceptTerms && (
            <p className="text-xs text-red-400">{state.fieldErrors.acceptTerms[0]}</p>
          )}

          <SubmitButton variant="gradient" size="lg" className="w-full" pendingText="Creating account…">
            Create account
          </SubmitButton>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
