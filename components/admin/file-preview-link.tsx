"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { getSignedFileUrl } from "@/lib/actions/kyc";

export function FilePreviewLink({
  bucket,
  path,
  label = "View file",
}: {
  bucket: string;
  path: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);

  function open() {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    start(async () => {
      const result = await getSignedFileUrl(bucket, path);
      if (result.success && result.data) {
        setUrl(result.data.url);
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.error ?? "Could not open the file.");
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={open} disabled={pending}>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : url ? (
        <ExternalLink className="size-3.5" />
      ) : (
        <FileText className="size-3.5" />
      )}
      {label}
    </Button>
  );
}
