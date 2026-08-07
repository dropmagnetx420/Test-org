import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = React.ComponentProps<typeof Badge>["variant"];

const STATUS_MAP: Record<string, { label: string; variant: Variant; dot: string }> = {
  pending: { label: "Pending", variant: "warning", dot: "bg-amber-400" },
  approved: { label: "Approved", variant: "success", dot: "bg-emerald-400" },
  rejected: { label: "Rejected", variant: "destructive", dot: "bg-red-400" },
  active: { label: "Active", variant: "success", dot: "bg-emerald-400" },
  suspended: { label: "Suspended", variant: "warning", dot: "bg-amber-400" },
  banned: { label: "Banned", variant: "destructive", dot: "bg-red-400" },
  unverified: { label: "Unverified", variant: "outline", dot: "bg-muted-foreground" },
  draft: { label: "Draft", variant: "outline", dot: "bg-muted-foreground" },
  open: { label: "Open", variant: "success", dot: "bg-emerald-400" },
  closed: { label: "Closed", variant: "warning", dot: "bg-amber-400" },
  resolved: { label: "Resolved", variant: "accent", dot: "bg-cyan-400" },
  cancelled: { label: "Cancelled", variant: "outline", dot: "bg-muted-foreground" },
  won: { label: "Won", variant: "success", dot: "bg-emerald-400" },
  lost: { label: "Lost", variant: "destructive", dot: "bg-red-400" },
  refunded: { label: "Refunded", variant: "accent", dot: "bg-cyan-400" },
  user: { label: "User", variant: "outline", dot: "bg-muted-foreground" },
  admin: { label: "Admin", variant: "accent", dot: "bg-cyan-400" },
  super_admin: { label: "Super Admin", variant: "default", dot: "bg-primary" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    variant: "outline" as Variant,
    dot: "bg-muted-foreground",
  };

  return (
    <Badge variant={config.variant} className={cn("gap-1.5 capitalize", className)}>
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}
