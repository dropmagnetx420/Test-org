"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { Markdown } from "@/components/shared/markdown";
import { updateLegalPage } from "@/lib/actions/admin";
import { LEGAL_PAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActionResult, LegalPage } from "@/types/database";

type PageMeta = (typeof LEGAL_PAGES)[number];

export function LegalPagesForm({ pages }: { pages: LegalPage[] }) {
  return (
    <Tabs defaultValue={LEGAL_PAGES[0].slug} className="space-y-6">
      <TabsList>
        {LEGAL_PAGES.map((meta) => (
          <TabsTrigger key={meta.slug} value={meta.slug}>
            {meta.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {LEGAL_PAGES.map((meta) => (
        <TabsContent key={meta.slug} value={meta.slug}>
          <PageEditor meta={meta} page={pages.find((p) => p.slug === meta.slug)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PageEditor({ meta, page }: { meta: PageMeta; page?: LegalPage }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateLegalPage, null);
  const [content, setContent] = useState(page?.content ?? "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Page saved.");
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const err = state?.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={meta.slug} />

      <Card className="glass">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{meta.label}</CardTitle>
            <CardDescription>
              Written in Markdown. Published to{" "}
              <a
                href={meta.route}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {meta.route}
              </a>{" "}
              the moment you save.
            </CardDescription>
          </div>

          <div className="flex shrink-0 rounded-lg border border-border/60 bg-secondary/40 p-0.5 text-xs font-medium">
            {(["edit", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-3 py-1 capitalize transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${meta.slug}-title`}>Title</Label>
            <Input
              id={`${meta.slug}-title`}
              name="title"
              defaultValue={page?.title ?? meta.label}
              maxLength={120}
              required
            />
            {err?.title?.[0] && <p className="text-xs text-red-400">{err.title[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${meta.slug}-content`}>Content</Label>
            {mode === "edit" ? (
              <Textarea
                id={`${meta.slug}-content`}
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                placeholder={"## Section heading\n\nWrite the policy here. Use **bold**, lists, and links."}
                className="font-mono text-sm"
              />
            ) : (
              <>
                <input type="hidden" name="content" value={content} />
                <div className="min-h-[26rem] rounded-lg border border-border/60 bg-secondary/20 p-4">
                  {content.trim() ? (
                    <Markdown>{content}</Markdown>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                  )}
                </div>
              </>
            )}
            {err?.content?.[0] && <p className="text-xs text-red-400">{err.content[0]}</p>}
          </div>

          <div className="flex justify-end">
            <SubmitButton variant="gradient" pendingText="Saving…">
              Save {meta.label}
            </SubmitButton>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
