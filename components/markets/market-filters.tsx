"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPORTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "trending", label: "Trending" },
  { value: "volume", label: "Highest volume" },
  { value: "ending", label: "Ending soon" },
  { value: "newest", label: "Newest" },
];

const STATUSES = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Awaiting result" },
  { value: "resolved", label: "Resolved" },
];

export function MarketFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("search") ?? "");

  const sport = params.get("sport") ?? "";
  const status = params.get("status") ?? "all";
  const sort = params.get("sort") ?? "trending";

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    next.delete("page");

    startTransition(() => {
      router.push(next.toString() ? `/markets?${next}` : "/markets");
    });
  }

  return (
    <div className={cn("space-y-4", pending && "opacity-70")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update("search", search.trim());
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams, leagues or questions…"
          className="pl-9"
          aria-label="Search markets"
        />
      </form>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => update("sport", "")}
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            !sport
              ? "border-primary bg-primary/15 text-primary"
              : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          All sports
        </button>
        {SPORTS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => update("sport", item.value)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              sport === item.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            <span className="mr-1.5">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={(v) => update("status", v)}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] min-w-0 sm:w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => update("sort", v)}>
          <SelectTrigger className="w-[calc(50%-0.25rem)] min-w-0 sm:w-[170px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
