"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getUser } from "@/lib/auth";
import { ok, fail, parseOrFail, toActionError, formString, formBool } from "@/lib/action-utils";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  otpSchema,
  updateProfileSchema,
} from "@/lib/validations";
import type { ActionResult } from "@/types/database";

async function siteOrigin() {
  const h = await headers();
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUp(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!(await rateLimit("AUTH"))) {
    return fail("Too many attempts. Please wait a minute and try again.");
  }

  const parsed = parseOrFail(registerSchema, {
    email: formString(fd, "email"),
    password: formString(fd, "password"),
    confirmPassword: formString(fd, "confirmPassword"),
    fullName: formString(fd, "fullName"),
    referralCode: formString(fd, "referralCode"),
    acceptTerms: formBool(fd, "acceptTerms"),
  });
  if (!parsed.ok) return parsed.result;

  const { email, password, fullName, referralCode } = parsed.data;
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("registration_enabled")
    .eq("id", 1)
    .single();

  if (settings && settings.registration_enabled === false) {
    return fail("Registrations are temporarily closed. Please check back soon.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard`,
      data: {
        full_name: fullName,
        referral_code: referralCode || null,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return fail("An account with this email already exists.");
    }
    return fail(error.message);
  }

  return ok(
    { email },
    "Account created. Check your inbox for the verification link to activate your account."
  );
}

export async function signIn(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!(await rateLimit("AUTH"))) {
    return fail("Too many sign-in attempts. Please wait a minute and try again.");
  }

  const parsed = parseOrFail(loginSchema, {
    email: formString(fd, "email"),
    password: formString(fd, "password"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return fail("Please verify your email address first. Check your inbox.");
    }
    return fail("Incorrect email or password.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role, ban_reason")
    .eq("id", data.user.id)
    .single();

  if (profile?.status === "banned") {
    await supabase.auth.signOut();
    return fail(profile.ban_reason || "This account has been suspended. Contact support.");
  }

  await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);

  const next = formString(fd, "next");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  const destination = safeNext ?? (profile?.role === "admin" || profile?.role === "super_admin" ? "/admin" : "/dashboard");

  revalidatePath("/", "layout");
  redirect(destination);
}

export async function signInWithGoogle(fd: FormData) {
  const supabase = await createClient();
  const next = formString(fd, "next");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) redirect("/login?error=oauth_failed");
  redirect(data.url);
}

export async function sendOtp(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!(await rateLimit("AUTH"))) return fail("Too many requests. Please wait a moment.");

  const email = formString(fd, "email").trim().toLowerCase();
  const parsed = parseOrFail(forgotPasswordSchema, { email });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/dashboard` },
  });

  if (error) return fail(error.message);
  return ok({ email: parsed.data.email }, "We sent a 6-digit code to your email.");
}

export async function verifyOtp(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (!(await rateLimit("AUTH"))) return fail("Too many attempts. Please wait a moment.");

  const parsed = parseOrFail(otpSchema, {
    email: formString(fd, "email"),
    token: formString(fd, "token"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) return fail("That code is invalid or has expired.");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function requestPasswordReset(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  if (!(await rateLimit("AUTH"))) return fail("Too many requests. Please wait a moment.");

  const parsed = parseOrFail(forgotPasswordSchema, { email: formString(fd, "email") });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });

  // Always report success so the form cannot be used to enumerate accounts.
  return ok(null, "If an account exists for that email, a reset link is on its way.");
}

export async function updatePassword(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = parseOrFail(resetPasswordSchema, {
    password: formString(fd, "password"),
    confirmPassword: formString(fd, "confirmPassword"),
  });
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message);

  return ok(null, "Password updated. You can now sign in with your new password.");
}

export async function updateProfile(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return fail("Please sign in to continue.");

  const parsed = parseOrFail(updateProfileSchema, {
    fullName: formString(fd, "fullName"),
    username: formString(fd, "username"),
    phone: formString(fd, "phone"),
    country: formString(fd, "country"),
  });
  if (!parsed.ok) return parsed.result;

  const { fullName, username, phone, country } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      username: username || null,
      phone: phone || null,
      country: country || null,
    })
    .eq("id", user.id);

  if (error) return toActionError(error);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return ok(null, "Profile updated.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
