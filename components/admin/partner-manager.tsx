"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Handshake, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { StaggerGrid, StaggerItem } from "@/components/shared/motion";
import { SubmitButton } from "@/components/shared/submit-button";
import { deletePartner, savePartner } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import type { ActionResult, Partner } from "@/types/database";

export function PartnerManager({ partners }: { partners: Partner[] }) {
  const [editing, setEditing] = useState<Partner | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Logos shown in the landing page partner strip, ordered by position.
        </p>
        <Button variant="gradient" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Add partner
        </Button>
      </div>

      {partners.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No partners yet"
          description="Add partner logos to build credibility on the landing page."
        />
      ) : (
        <StaggerGrid className="grid gap-3 sm:grid-cols-2">
          {partners.map((partner) => (
            <StaggerItem key={partner.id}>
              <PartnerRow partner={partner} onEdit={() => setEditing(partner)} />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}

      <PartnerDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        open={editing !== null}
        partner={editing === "new" ? undefined : (editing ?? undefined)}
        onDone={() => setEditing(null)}
      />
    </div>
  );
}

function PartnerRow({ partner, onEdit }: { partner: Partner; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function remove() {
    start(async () => {
      const result = await deletePartner(partner.id);
      if (result.success) {
        toast.success(result.message ?? "Partner removed.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not remove this partner.");
      }
    });
  }

  return (
    <Card className={cn("glass lift", !partner.is_active && "opacity-60")}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-secondary/60">
          <Image
            src={partner.logo_url}
            alt={partner.name}
            fill
            sizes="48px"
            className="object-contain p-1.5"
            unoptimized
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{partner.name}</p>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              #{partner.position}
            </span>
            {!partner.is_active && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Hidden
              </span>
            )}
          </div>
          {partner.website_url && (
            <p className="truncate text-xs text-muted-foreground">{partner.website_url}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit partner">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            aria-label="Remove partner"
            className="text-red-400 hover:text-red-300"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PartnerDialog({
  open,
  partner,
  onDone,
}: {
  open: boolean;
  partner?: Partner;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(savePartner, null);
  const [active, setActive] = useState(partner?.is_active ?? true);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved.");
      onDone();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  const err = state?.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{partner ? "Edit partner" : "Add partner"}</DialogTitle>
          <DialogDescription>
            Use a transparent PNG or SVG so the logo sits well on the dark background.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {partner && <input type="hidden" name="id" value={partner.id} />}
          <input type="hidden" name="isActive" value={active ? "true" : "false"} />

          <div className="space-y-2">
            <Label htmlFor="partner-name">Name</Label>
            <Input
              id="partner-name"
              name="name"
              defaultValue={partner?.name ?? ""}
              maxLength={80}
              required
            />
            {err?.name && <p className="text-xs text-red-400">{err.name[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-logo">Logo URL</Label>
            <Input
              id="partner-logo"
              name="logoUrl"
              defaultValue={partner?.logo_url ?? ""}
              maxLength={500}
              placeholder="https://…/logo.svg"
              required
            />
            {err?.logoUrl && <p className="text-xs text-red-400">{err.logoUrl[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-site">
              Website <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="partner-site"
              name="websiteUrl"
              type="url"
              defaultValue={partner?.website_url ?? ""}
              maxLength={300}
              placeholder="https://…"
            />
            {err?.websiteUrl && <p className="text-xs text-red-400">{err.websiteUrl[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-position">Position</Label>
            <Input
              id="partner-position"
              name="position"
              type="number"
              min="0"
              step="1"
              className="font-mono"
              defaultValue={partner?.position ?? 0}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="partner-active" className="cursor-pointer">
                Visible
              </Label>
              <p className="text-xs text-muted-foreground">Hide without removing the record.</p>
            </div>
            <Switch id="partner-active" checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton variant="gradient" size="sm" pendingText="Saving…">
              {partner ? "Save changes" : "Add partner"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
