import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  baseHref: string;
  className?: string;
}

/** Builds `?page=N` while preserving any query already present in baseHref. */
function pageHref(baseHref: string, page: number) {
  const [path, query] = baseHref.split("?");
  const params = new URLSearchParams(query);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function Pagination({ page, totalPages, baseHref, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const window = 2;
  const pages: (number | "gap")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= window) pages.push(i);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)} aria-label="Pagination">
      <Button
        asChild={page > 1}
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        aria-label="Previous page"
      >
        {page > 1 ? (
          <Link href={pageHref(baseHref, page - 1)}>
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <ChevronLeft className="size-4" />
        )}
      </Button>

      {pages.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            asChild
            variant={p === page ? "gradient" : "ghost"}
            size="icon-sm"
            aria-current={p === page ? "page" : undefined}
          >
            <Link href={pageHref(baseHref, p)}>{p}</Link>
          </Button>
        )
      )}

      <Button
        asChild={page < totalPages}
        variant="outline"
        size="icon-sm"
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        {page < totalPages ? (
          <Link href={pageHref(baseHref, page + 1)}>
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <ChevronRight className="size-4" />
        )}
      </Button>
    </nav>
  );
}
