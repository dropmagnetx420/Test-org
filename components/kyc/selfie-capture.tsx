"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RefreshCw, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { uploadKycFile } from "@/lib/actions/kyc";

export function SelfieCapture({
  value,
  onUploaded,
}: {
  value: string;
  onUploaded: (path: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function start() {
    setDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setDenied(true);
      toast.error("Camera access was blocked. Allow it in your browser settings and try again.");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (!blob) return;

    stop();
    setPreview(URL.createObjectURL(blob));
    setBusy(true);

    const fd = new FormData();
    fd.set("file", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
    fd.set("kind", "selfie");

    const result = await uploadKycFile(fd);
    setBusy(false);

    if (result.success && result.data) {
      onUploaded(result.data.path);
      toast.success("Selfie captured.");
    } else {
      toast.error(result.error ?? "Upload failed.");
      setPreview(null);
    }
  }

  function retake() {
    onUploaded("");
    setPreview(null);
    start();
  }

  return (
    <div className="space-y-2">
      <Label>Live selfie</Label>

      <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-xl border border-border/60 bg-secondary/40">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captured selfie" className="size-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full -scale-x-100 object-cover"
          />
        )}

        {!live && !preview && (
          <div className="absolute inset-0 grid place-items-center gap-2 text-center">
            <div className="space-y-2 px-4">
              {denied ? (
                <VideoOff className="mx-auto size-8 text-muted-foreground" />
              ) : (
                <Camera className="mx-auto size-8 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground">
                {denied
                  ? "Camera blocked. Check browser permissions."
                  : "Take a photo of your face in good lighting."}
              </p>
            </div>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!live && !value && (
          <Button type="button" variant="outline" size="sm" onClick={start} disabled={busy}>
            <Camera className="size-4" />
            {denied ? "Retry camera" : "Open camera"}
          </Button>
        )}
        {live && (
          <Button type="button" variant="gradient" size="sm" onClick={capture} disabled={busy}>
            <Camera className="size-4" />
            Capture
          </Button>
        )}
        {value && (
          <Button type="button" variant="outline" size="sm" onClick={retake} disabled={busy}>
            <RefreshCw className="size-4" />
            Retake
          </Button>
        )}
      </div>

      {value && (
        <p className="flex items-center gap-1 text-xs text-emerald-400">
          <Check className="size-3" />
          Selfie attached
        </p>
      )}
    </div>
  );
}
