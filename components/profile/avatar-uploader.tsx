"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { uploadAvatar, removeAvatar } from "@/lib/actions/profile";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export function AvatarUploader({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [pending, startTransition] = useTransition();

  const initials = (name || "?").slice(0, 2).toUpperCase();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a failure
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toast.error("Upload a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image is too large. Maximum size is 4 MB.");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    const previous = preview;
    setPreview(localUrl);

    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadAvatar(fd);
      if (res.success && res.data) {
        setPreview(res.data.url);
        toast.success(res.message ?? "Profile picture updated.");
        router.refresh();
      } else {
        setPreview(previous);
        toast.error(res.error ?? "Upload failed. Please try again.");
      }
      URL.revokeObjectURL(localUrl);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeAvatar();
      if (res.success) {
        setPreview(null);
        toast.success(res.message ?? "Profile picture removed.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not remove your picture.");
      }
    });
  }

  return (
    <div className="relative shrink-0">
      <Avatar className="size-14">
        <AvatarImage src={preview ?? undefined} alt={name} />
        <AvatarFallback className="bg-gradient-to-br from-primary/30 to-cyan-500/20 font-mono text-lg font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label="Change profile picture"
        className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card transition-transform hover:scale-105 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
      </button>

      {preview && !pending && (
        <button
          type="button"
          onClick={remove}
          aria-label="Remove profile picture"
          className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-secondary text-muted-foreground ring-2 ring-card transition-colors hover:text-red-400"
        >
          <Trash2 className="size-3" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
