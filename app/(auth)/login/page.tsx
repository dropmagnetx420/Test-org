import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your NextGen Predict account.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-xl" />}>
      <LoginForm />
    </Suspense>
  );
}
