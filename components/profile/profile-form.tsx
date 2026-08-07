"use client";

import { useActionState, useEffect } from "react";
import { Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { updateProfile } from "@/lib/actions/auth";
import type { ActionResult, Profile } from "@/types/database";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateProfile, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success(state.message ?? "Profile updated.");
  }, [state]);

  return (
    <Card className="glass-strong">
      <CardHeader>
        <CardTitle className="text-lg">Account details</CardTitle>
        <CardDescription>
          Your display name and contact information. Legal name changes require re-verification.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile.email} readOnly disabled className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              Contact support if you need to change your email address.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                required
                defaultValue={profile.full_name ?? ""}
                placeholder="Jane Doe"
                aria-invalid={Boolean(state?.fieldErrors?.fullName)}
              />
              {state?.fieldErrors?.fullName && (
                <p className="text-xs text-red-400">{state.fieldErrors.fullName[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                defaultValue={profile.username ?? ""}
                placeholder="janedoe"
                aria-invalid={Boolean(state?.fieldErrors?.username)}
              />
              {state?.fieldErrors?.username && (
                <p className="text-xs text-red-400">{state.fieldErrors.username[0]}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ""}
                placeholder="+1 555 0100"
                aria-invalid={Boolean(state?.fieldErrors?.phone)}
              />
              {state?.fieldErrors?.phone && (
                <p className="text-xs text-red-400">{state.fieldErrors.phone[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                defaultValue={profile.country ?? ""}
                placeholder="United States"
                aria-invalid={Boolean(state?.fieldErrors?.country)}
              />
              {state?.fieldErrors?.country && (
                <p className="text-xs text-red-400">{state.fieldErrors.country[0]}</p>
              )}
            </div>
          </div>

          <SubmitButton variant="gradient" pendingText="Saving…">
            <Save className="size-4" />
            Save changes
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
