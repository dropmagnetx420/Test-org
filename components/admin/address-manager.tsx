"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, Wallet2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { deleteDepositAddress, saveDepositAddress } from "@/lib/actions/admin";
import { ASSETS_BY_NETWORK, NETWORKS, type NetworkValue } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActionResult, DepositAddress } from "@/types/database";

export function AddressManager({ addresses }: { addresses: DepositAddress[] }) {
  const [editing, setEditing] = useState<DepositAddress | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {addresses.length} address{addresses.length === 1 ? "" : "es"} ·{" "}
          {addresses.filter((a) => a.is_active).length} active. One is picked at random for each
          deposit, so keep 10–15 live per asset to spread the load.
        </p>
        <Button variant="gradient" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={Wallet2}
          title="No deposit addresses"
          description="Users cannot deposit until at least one active address exists for each asset."
        />
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <AddressRow key={address.id} address={address} onEdit={() => setEditing(address)} />
          ))}
        </div>
      )}

      <AddressDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        open={editing !== null}
        address={editing === "new" ? undefined : (editing ?? undefined)}
        onDone={() => setEditing(null)}
      />
    </div>
  );
}

function AddressRow({ address, onEdit }: { address: DepositAddress; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function remove() {
    start(async () => {
      const result = await deleteDepositAddress(address.id);
      if (result.success) {
        toast.success(result.message ?? "Address removed.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not remove this address.");
      }
    });
  }

  const network = NETWORKS.find((n) => n.value === address.network);

  return (
    <Card className={cn("glass", !address.is_active && "opacity-60")}>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {address.asset}
            </span>
            <span className="text-xs text-muted-foreground">
              {network?.label ?? address.network}
            </span>
            {address.label && <span className="text-xs font-medium">{address.label}</span>}
            {!address.is_active && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 break-all font-mono text-xs">{address.address}</p>
            <CopyButton value={address.address} label="Address" />
          </div>
          <p className="text-xs text-muted-foreground">
            Served {address.usage_count.toLocaleString()} time
            {address.usage_count === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit address">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            aria-label="Remove address"
            className="text-red-400 hover:text-red-300"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddressDialog({
  open,
  address,
  onDone,
}: {
  open: boolean;
  address?: DepositAddress;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    saveDepositAddress,
    null
  );
  const [network, setNetwork] = useState<NetworkValue>(
    (address?.network as NetworkValue) ?? "robinhood"
  );
  const [asset, setAsset] = useState(address?.asset ?? ASSETS_BY_NETWORK.robinhood[0]);
  const [active, setActive] = useState(address?.is_active ?? true);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Saved.");
      onDone();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  function changeNetwork(next: NetworkValue) {
    setNetwork(next);
    if (!ASSETS_BY_NETWORK[next].includes(asset)) setAsset(ASSETS_BY_NETWORK[next][0]);
  }

  const err = state?.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{address ? "Edit address" : "Add deposit address"}</DialogTitle>
          <DialogDescription>
            Double-check the address — deposits sent to a wrong address cannot be recovered.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {address && <input type="hidden" name="id" value={address.id} />}
          <input type="hidden" name="network" value={network} />
          <input type="hidden" name="asset" value={asset} />
          <input type="hidden" name="isActive" value={active ? "true" : "false"} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="network-select">Network</Label>
              <Select value={network} onValueChange={(v) => changeNetwork(v as NetworkValue)}>
                <SelectTrigger id="network-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-select">Asset</Label>
              <Select value={asset} onValueChange={setAsset}>
                <SelectTrigger id="asset-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSETS_BY_NETWORK[network].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Wallet address</Label>
            <Input
              id="address"
              name="address"
              defaultValue={address?.address ?? ""}
              placeholder="0x…"
              className="font-mono text-xs"
              required
            />
            {err?.address && <p className="text-xs text-red-400">{err.address[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">
              Label <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="label"
              name="label"
              defaultValue={address?.label ?? ""}
              maxLength={60}
              placeholder="e.g. Treasury 3"
            />
            {err?.label && <p className="text-xs text-red-400">{err.label[0]}</p>}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Only active addresses are handed out to users.
              </p>
            </div>
            <Switch id="isActive" checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton variant="gradient" size="sm" pendingText="Saving…">
              {address ? "Save changes" : "Add address"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
