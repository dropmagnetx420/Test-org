"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, MoreHorizontal, ShieldCheck, Undo2, Wallet2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { adjustBalance, setUserRole, setUserStatus } from "@/lib/actions/admin";
import type { ActionResult, UserRole, UserStatus } from "@/types/database";

type Panel = "status" | "balance" | "role" | null;

interface UserActionsProps {
  userId: string;
  name: string;
  status: UserStatus;
  role: UserRole;
  isSuperAdmin: boolean;
  isSelf: boolean;
  availableBalance: number;
  bonusBalance: number;
}

export function UserActions({
  userId,
  name,
  status,
  role,
  isSuperAdmin,
  isSelf,
  availableBalance,
  bonusBalance,
}: UserActionsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [statusValue, setStatusValue] = useState<UserStatus>(status);

  function openStatus(next: UserStatus) {
    setStatusValue(next);
    setPanel("status");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setPanel("balance")}>
            <Wallet2 className="size-4" />
            Adjust balance
          </DropdownMenuItem>

          {status !== "active" && (
            <DropdownMenuItem onSelect={() => openStatus("active")}>
              <Undo2 className="size-4" />
              Reinstate account
            </DropdownMenuItem>
          )}
          {status !== "suspended" && (
            <DropdownMenuItem onSelect={() => openStatus("suspended")}>
              <ShieldCheck className="size-4" />
              Suspend temporarily
            </DropdownMenuItem>
          )}
          {status !== "banned" && (
            <DropdownMenuItem
              className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
              onSelect={() => openStatus("banned")}
            >
              <Ban className="size-4" />
              Ban permanently
            </DropdownMenuItem>
          )}

          {isSuperAdmin && !isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setPanel("role")}>
                <ShieldCheck className="size-4" />
                Change role
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <StatusDialog
        open={panel === "status"}
        onDone={() => setPanel(null)}
        userId={userId}
        name={name}
        status={statusValue}
      />
      <BalanceDialog
        open={panel === "balance"}
        onDone={() => setPanel(null)}
        userId={userId}
        name={name}
        availableBalance={availableBalance}
        bonusBalance={bonusBalance}
      />
      <RoleDialog
        open={panel === "role"}
        onDone={() => setPanel(null)}
        userId={userId}
        name={name}
        role={role}
      />
    </>
  );
}

function useReviewAction(
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>,
  onDone: () => void
) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Done.");
      onDone();
      router.refresh();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  return { state, formAction };
}

const STATUS_COPY: Record<UserStatus, { title: string; description: string; confirm: string }> = {
  active: {
    title: "Reinstate account",
    description: "The user regains full access to trading, deposits, and withdrawals.",
    confirm: "Reinstate user",
  },
  suspended: {
    title: "Suspend account",
    description: "Access is paused until the date you choose. Balances are untouched.",
    confirm: "Suspend user",
  },
  banned: {
    title: "Ban account",
    description: "The user is locked out permanently and sees your reason on sign-in.",
    confirm: "Ban user",
  },
};

function StatusDialog({
  open,
  onDone,
  userId,
  name,
  status,
}: {
  open: boolean;
  onDone: () => void;
  userId: string;
  name: string;
  status: UserStatus;
}) {
  const { state, formAction } = useReviewAction(setUserStatus, onDone);
  const copy = STATUS_COPY[status];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="status" value={status} />

          <p className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
            <span className="text-muted-foreground">Account</span>{" "}
            <span className="font-medium">{name}</span>
          </p>

          {status === "suspended" && (
            <div className="space-y-2">
              <Label htmlFor={`until-${userId}`}>
                Suspended until <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id={`until-${userId}`} name="until" type="datetime-local" />
              <p className="text-xs text-muted-foreground">
                Leave empty to suspend indefinitely until you reinstate manually.
              </p>
              {state?.fieldErrors?.until && (
                <p className="text-xs text-red-400">{state.fieldErrors.until[0]}</p>
              )}
            </div>
          )}

          {status !== "active" && (
            <div className="space-y-2">
              <Label htmlFor={`reason-${userId}`}>Reason</Label>
              <Textarea
                id={`reason-${userId}`}
                name="reason"
                rows={3}
                maxLength={300}
                required
                placeholder="Shown to the user. Be specific — e.g. multiple accounts detected."
              />
              {state?.fieldErrors?.reason && (
                <p className="text-xs text-red-400">{state.fieldErrors.reason[0]}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton
              variant={status === "banned" ? "destructive" : "gradient"}
              size="sm"
              pendingText="Working…"
            >
              {copy.confirm}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type BalanceMode = "add" | "remove" | "set";

const BALANCE_MODES: { value: BalanceMode; label: string; hint: string }[] = [
  { value: "add", label: "Add", hint: "Credit this amount on top of the current balance." },
  { value: "remove", label: "Remove", hint: "Debit this amount, stopping at zero." },
  { value: "set", label: "Set", hint: "Replace the balance with this exact amount." },
];

function BalanceDialog({
  open,
  onDone,
  userId,
  name,
  availableBalance,
  bonusBalance,
}: {
  open: boolean;
  onDone: () => void;
  userId: string;
  name: string;
  availableBalance: number;
  bonusBalance: number;
}) {
  const { state, formAction } = useReviewAction(adjustBalance, onDone);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<BalanceMode>("add");
  const [isBonus, setIsBonus] = useState(false);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= 0 && (mode === "set" || value > 0);

  const current = isBonus ? bonusBalance : availableBalance;
  const next =
    mode === "set" ? value : mode === "remove" ? Math.max(current - value, 0) : current + value;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription>
            Every change is written to the ledger. Removing more than the balance leaves it at zero.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="mode" value={mode} />

          <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
            <p>
              <span className="text-muted-foreground">Account</span>{" "}
              <span className="font-medium">{name}</span>
            </p>
            <p className="mt-1 font-mono text-muted-foreground">
              cash {availableBalance.toFixed(2)} · bonus {bonusBalance.toFixed(2)} USDG
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`mode-${userId}`}>Action</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as BalanceMode)}>
              <SelectTrigger id={`mode-${userId}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BALANCE_MODES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {BALANCE_MODES.find((o) => o.value === mode)?.hint}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`amount-${userId}`}>Amount (USDG)</Label>
            <Input
              id={`amount-${userId}`}
              name="amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="e.g. 25"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
              required
            />
            {valid && (
              <p className="text-xs text-muted-foreground">
                {isBonus ? "Bonus" : "Cash"} balance goes from{" "}
                <span className="font-mono font-medium text-foreground">
                  {current.toFixed(2)}
                </span>{" "}
                to{" "}
                <span className="font-mono font-medium text-foreground">{next.toFixed(2)}</span>{" "}
                USDG.
              </p>
            )}
            {state?.fieldErrors?.amount && (
              <p className="text-xs text-red-400">{state.fieldErrors.amount[0]}</p>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <Checkbox
              id={`bonus-${userId}`}
              name="isBonus"
              value="true"
              checked={isBonus}
              onCheckedChange={(c) => setIsBonus(c === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor={`bonus-${userId}`} className="cursor-pointer">
                Apply to bonus balance
              </Label>
              <p className="text-xs text-muted-foreground">
                Bonus funds carry a turnover requirement before they can be withdrawn.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`note-${userId}`}>
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id={`note-${userId}`}
              name="note"
              rows={2}
              maxLength={300}
              placeholder="Why this adjustment was made."
            />
            {state?.fieldErrors?.note && (
              <p className="text-xs text-red-400">{state.fieldErrors.note[0]}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton variant="gradient" size="sm" pendingText="Working…" disabled={!valid}>
              {mode === "set" ? "Set balance" : mode === "remove" ? "Remove funds" : "Add funds"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: "user", label: "User", hint: "Standard trading account." },
  { value: "admin", label: "Admin", hint: "Reviews queues, manages markets and users." },
  { value: "super_admin", label: "Super admin", hint: "Everything, including role changes." },
];

function RoleDialog({
  open,
  onDone,
  userId,
  name,
  role,
}: {
  open: boolean;
  onDone: () => void;
  userId: string;
  name: string;
  role: UserRole;
}) {
  const { formAction } = useReviewAction(setUserRole, onDone);
  const [next, setNext] = useState<UserRole>(role);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            Admin roles grant access to the console and every review queue. Grant sparingly.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="role" value={next} />

          <p className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
            <span className="text-muted-foreground">Account</span>{" "}
            <span className="font-medium">{name}</span>
          </p>

          <div className="space-y-2">
            <Label htmlFor={`role-${userId}`}>Role</Label>
            <Select value={next} onValueChange={(v) => setNext(v as UserRole)}>
              <SelectTrigger id={`role-${userId}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ROLES.find((r) => r.value === next)?.hint}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton
              variant="gradient"
              size="sm"
              pendingText="Working…"
              disabled={next === role}
            >
              Update role
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
