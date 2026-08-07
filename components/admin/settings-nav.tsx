import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/addresses", label: "Deposit addresses" },
  { href: "/admin/settings/banners", label: "Promo banners" },
  { href: "/admin/settings/partners", label: "Partners" },
  { href: "/admin/settings/ads", label: "Ad placements" },
];

export function SettingsNav({ active }: { active: string }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            active === tab.href
              ? "border-primary bg-primary/15 text-primary"
              : "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
