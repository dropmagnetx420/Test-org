"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { deleteEarnTask, saveEarnTask } from "@/lib/actions/admin";
import { EARN_TASK_TYPES } from "@/lib/constants";
import { cn, formatCurrency, toNumber } from "@/lib/utils";
import type { ActionResult, EarnTask } from "@/types/database";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function typeLabel(value: string) {
  return EARN_TASK_TYPES.find((t) => t.value === value)?.label ?? value;
}

function typeIcon(value: string) {
  return EARN_TASK_TYPES.find((t) => t.value === value)?.icon ?? "⭐";
}

export function TaskManager({ tasks }: { tasks: EarnTask[] }) {
  const [editing, setEditing] = useState<EarnTask | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Users complete a task, upload a screenshot as proof, and you approve or reject it. The
          reward lands in their wallet on approval.
        </p>
        <Button variant="gradient" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No earn tasks yet"
          description="Create a task like “Follow us on X” or “Join our Telegram” to reward users."
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onEdit={() => setEditing(task)} />
          ))}
        </div>
      )}

      <TaskDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        open={editing !== null}
        task={editing === "new" ? undefined : (editing ?? undefined)}
        onDone={() => setEditing(null)}
      />
    </div>
  );
}

function TaskRow({ task, onEdit }: { task: EarnTask; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function remove() {
    start(async () => {
      const result = await deleteEarnTask(task.id);
      if (result.success) {
        toast.success(result.message ?? "Task deleted.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Could not delete this task.");
      }
    });
  }

  const limit = task.user_limit;
  const exhausted = limit !== null && task.claimed_count >= limit;

  return (
    <Card className={cn("glass", !task.is_active && "opacity-60")}>
      <CardContent className="flex flex-wrap items-start gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-lg">
          {typeIcon(task.type)}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">{task.title}</p>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {typeLabel(task.type)}
            </span>
            {!task.is_active && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Hidden
              </span>
            )}
            {exhausted && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                Limit reached
              </span>
            )}
          </div>

          {task.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              Reward{" "}
              <span className="font-mono text-foreground">
                {formatCurrency(task.reward)} USDG
              </span>
            </span>
            <span>{task.requires_proof ? "Screenshot required" : "No proof needed"}</span>
            {task.is_repeatable && <span>Repeatable every {task.cooldown_hours}h</span>}
            {task.target_url && <span className="truncate">{task.target_url}</span>}
          </div>

          {limit !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-mono">
                  {task.claimed_count.toLocaleString()} / {limit.toLocaleString()}
                </span>
              </div>
              <Progress value={Math.min(100, (task.claimed_count / limit) * 100)} className="h-1.5" />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit task">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            aria-label="Delete task"
            className="text-red-400 hover:text-red-300"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskDialog({
  open,
  task,
  onDone,
}: {
  open: boolean;
  task?: EarnTask;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveEarnTask, null);
  const [type, setType] = useState(task?.type ?? EARN_TASK_TYPES[0].value);
  const [active, setActive] = useState(task?.is_active ?? true);
  const [requiresProof, setRequiresProof] = useState(task?.requires_proof ?? true);
  const [repeatable, setRepeatable] = useState(task?.is_repeatable ?? false);

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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New earn task"}</DialogTitle>
          <DialogDescription>
            Set the reward users receive once you approve their proof.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {task && <input type="hidden" name="id" value={task.id} />}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="isActive" value={active ? "true" : "false"} />
          <input type="hidden" name="requiresProof" value={requiresProof ? "true" : "false"} />
          <input type="hidden" name="isRepeatable" value={repeatable ? "true" : "false"} />

          <div className="space-y-2">
            <Label htmlFor="task-type">Task type</Label>
            <Select value={type} onValueChange={(v) => setType(v as EarnTask["type"])}>
              <SelectTrigger id="task-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EARN_TASK_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              name="title"
              defaultValue={task?.title ?? ""}
              maxLength={120}
              required
              placeholder="Follow us on X"
            />
            {err?.title && <p className="text-xs text-red-400">{err.title[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="task-description"
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={task?.description ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-instructions">
              Instructions <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="task-instructions"
              name="instructions"
              rows={3}
              maxLength={1000}
              defaultValue={task?.instructions ?? ""}
              placeholder="1. Open the link&#10;2. Follow the account&#10;3. Screenshot your profile showing Following"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="task-url">
                Target link <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="task-url"
                name="targetUrl"
                type="url"
                defaultValue={task?.target_url ?? ""}
                maxLength={500}
                placeholder="https://x.com/yourhandle"
              />
              {err?.targetUrl && <p className="text-xs text-red-400">{err.targetUrl[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-reward">Reward (USDG)</Label>
              <Input
                id="task-reward"
                name="reward"
                type="number"
                step="0.01"
                min="0"
                className="font-mono"
                defaultValue={task ? toNumber(task.reward) : 0.5}
                required
              />
              {err?.reward && <p className="text-xs text-red-400">{err.reward[0]}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-limit">
                Completion limit <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="task-limit"
                name="userLimit"
                type="number"
                min="1"
                step="1"
                className="font-mono"
                defaultValue={task?.user_limit ?? ""}
                placeholder="Unlimited"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-cooldown">Cooldown (hours)</Label>
              <Input
                id="task-cooldown"
                name="cooldownHours"
                type="number"
                min="0"
                step="1"
                className="font-mono"
                defaultValue={task?.cooldown_hours ?? 24}
                disabled={!repeatable}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-position">Position</Label>
              <Input
                id="task-position"
                name="position"
                type="number"
                min="0"
                step="1"
                className="font-mono"
                defaultValue={task?.position ?? 0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-starts">
                Starts <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="task-starts"
                name="startsAt"
                type="datetime-local"
                defaultValue={toLocalInput(task?.starts_at ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-ends">
                Ends <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="task-ends"
                name="endsAt"
                type="datetime-local"
                defaultValue={toLocalInput(task?.ends_at ?? null)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <ToggleRow
              id="task-proof"
              label="Require screenshot proof"
              hint="Off means the reward is credited as soon as the user submits."
              checked={requiresProof}
              onChange={setRequiresProof}
            />
            <ToggleRow
              id="task-repeat"
              label="Repeatable"
              hint="Users can complete this again after the cooldown."
              checked={repeatable}
              onChange={setRepeatable}
            />
            <ToggleRow
              id="task-active"
              label="Visible"
              hint="Turn off to pull the task without deleting it."
              checked={active}
              onChange={setActive}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <SubmitButton variant="gradient" size="sm" pendingText="Saving…">
              {task ? "Save changes" : "Create task"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
