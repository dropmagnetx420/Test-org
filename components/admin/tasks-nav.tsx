import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/tasks/submissions", label: "Submissions" },
];

export function TasksNav({ active, pending = 0 }: { active: string; pending?: number }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            active === tab.href
              ? "border-primary bg-primary/15 text-primary"
              : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {tab.href === "/admin/tasks/submissions" && pending > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-400">
              {pending}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
