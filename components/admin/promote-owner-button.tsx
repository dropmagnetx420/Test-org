"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { promoteOwner } from "@/lib/actions/auth";

export function PromoteOwnerButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    start(async () => {
      const result = await promoteOwner();
      if (result.success) {
        toast.success(result.message ?? "Admin access granted.");
        router.replace("/admin");
      } else {
        toast.error(result.error ?? "Could not grant admin access.");
      }
    });
  }

  return (
    <Button type="button" onClick={run} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
      Grant admin access
    </Button>
  );
}
