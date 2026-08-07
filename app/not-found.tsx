import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15">
        <Compass className="size-8 text-primary" />
      </div>

      <div className="space-y-2">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page moved or never existed. The market you were after may have been resolved.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="gradient">
          <Link href="/markets">Browse markets</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
