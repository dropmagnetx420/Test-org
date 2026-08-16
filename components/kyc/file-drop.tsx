"use client";

import { useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { uploadKycFile } from "@/lib/actions/kyc";
import { cn } from "@/lib/utils";

interface FileDropProps {
  id: string;
  kind: "front" | "back";
  label: string;
  hint?: string;
  optional?: boolean;
  value: string;
  onUploaded: (path: string) => void;
}

export function FileDrop({
  id,
  kind,
  label,
  hint,
  optional,
  value,
  onUploaded,
}: FileDropProps) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);

    const result = await uploadKycFile(fd);
    setBusy(false);

    if (result.success && result.data) {
      onUploaded(result.data.path);
      setName(file.name);
      toast.success(`${label} uploaded.`);
    } else {
      toast.error(result.error ?? "Upload failed.");
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}{" "}
        {optional && <span className="text-muted-foreground">(optional)</span>}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="file"
          accept="image/*,application/pdf"
          onChange={onChange}
          disabled={busy}
          className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
        />
        {busy && <Loader2 className="size-4 shrink-0 animate-spin text-primary" />}
      </div>
      {hint && !value && <p className="text-xs text-muted-foreground">{hint}</p>}
      {value && (
        <p className={cn("flex items-center gap-1 text-xs text-emerald-400")}>
          <Check className="size-3" />
          {name || "File attached"}
        </p>
      )}
      {!value && !hint && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Upload className="size-3" />
          Any photo, scan, or PDF up to 10 MB
        </p>
      )}
    </div>
  );
}
