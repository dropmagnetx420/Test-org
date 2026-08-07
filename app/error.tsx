"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/15">
        <AlertTriangle className="size-8 text-amber-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page failed to load. Your balance and open positions are unaffected.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="gradient" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
