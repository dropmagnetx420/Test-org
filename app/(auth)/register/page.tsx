import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a NextGen Predict account and start trading sports predictions.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[720px] w-full rounded-xl" />}>
      <RegisterForm />
    </Suspense>
  );
}
