import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a password reset link for your NextGen Predict account.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
