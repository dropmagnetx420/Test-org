import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Markdown } from "@/components/shared/markdown";
import { getLegalPage } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getLegalPage("privacy");
  const title = page?.title ?? "Privacy Policy";
  return { title, alternates: { canonical: "/privacy" } };
}

export default async function PrivacyPage() {
  const page = await getLegalPage("privacy");
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated{" "}
        {new Date(page.updated_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
      <Markdown className="mt-8">{page.content}</Markdown>
    </article>
  );
}
