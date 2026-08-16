"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Eye,
  Loader2,
  RefreshCw,
  ScanFace,
  VideoOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { uploadKycFile } from "@/lib/actions/kyc";
import { cn } from "@/lib/utils";

type Phase = "idle" | "align" | "scanning" | "capturing" | "done" | "denied";

interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
}

const STEP_POOL: Step[] = [
  { id: "right", label: "Slowly turn your head right", icon: ArrowRight },
  { id: "left", label: "Slowly turn your head left", icon: ArrowLeft },
  { id: "up", label: "Lift your chin up a little", icon: ArrowUp },
  { id: "down", label: "Tilt your head down a little", icon: ArrowDown },
  { id: "blink", label: "Blink your eyes slowly", icon: Eye },
];

const ALIGN_MS = 1500;
const STEP_MS = 2400;

/** Two random guided actions, then an automatic snapshot — quick but convincing. */
function pickSteps(): Step[] {
  return [...STEP_POOL].sort(() => Math.random() - 0.5).slice(0, 2);
}

export function SelfieCapture({
  value,
  onUploaded,
}: {
  value: string;
  onUploaded: (path: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      stop();
    };
  }, [clearTimer, stop]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      stop();
      setPhase("idle");
      return;
    }

    setPhase("capturing");

    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      stop();
      setPhase("idle");
      return;
    }
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

    stop();
    if (!blob) {
      setPhase("idle");
      return;
    }

    setPreview(URL.createObjectURL(blob));

    const fd = new FormData();
    fd.set("file", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
    fd.set("kind", "selfie");

    const result = await uploadKycFile(fd);

    if (result.success && result.data) {
      onUploaded(result.data.path);
      setPhase("done");
      toast.success("Selfie captured.");
    } else {
      toast.error(result.error ?? "Upload failed.");
      setPreview(null);
      setPhase("idle");
    }
  }, [onUploaded, stop]);

  // Drives the guided sequence: brief align, then one prompt per step, then snap.
  useEffect(() => {
    if (phase === "align") {
      timerRef.current = setTimeout(() => {
        setStepIndex(0);
        setPhase("scanning");
      }, ALIGN_MS);
      return clearTimer;
    }

    if (phase === "scanning") {
      if (stepIndex >= steps.length) {
        timerRef.current = setTimeout(() => void capture(), 500);
        return clearTimer;
      }
      timerRef.current = setTimeout(() => setStepIndex((i) => i + 1), STEP_MS);
      return clearTimer;
    }
  }, [phase, stepIndex, steps.length, capture, clearTimer]);

  const start = useCallback(async () => {
    setPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setSteps(pickSteps());
      setStepIndex(0);
      setPhase("align");
    } catch {
      setPhase("denied");
      toast.error("Camera access was blocked. Allow it in your browser settings and try again.");
    }
  }, []);

  function retake() {
    clearTimer();
    stop();
    onUploaded("");
    setPreview(null);
    setPhase("idle");
    void start();
  }

  const active = phase === "align" || phase === "scanning";
  const current = steps[stepIndex];

  return (
    <div className="space-y-2">
      <Label>Liveness selfie</Label>

      <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-xl border border-border/60 bg-secondary/40">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Captured selfie" className="size-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
        )}

        {active && (
          <>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <m.div
                className="h-[78%] w-[62%] rounded-[50%] border-2 border-dashed border-primary/80"
                animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
                transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {!reduce && (
              <m.div
                className="pointer-events-none absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                initial={{ top: "10%" }}
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <div className="absolute inset-x-0 top-3 flex justify-center px-3">
              <AnimatePresence mode="wait">
                {phase === "align" ? (
                  <m.div
                    key="align"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur"
                  >
                    <ScanFace className="size-3.5 text-primary" />
                    Center your face in the circle
                  </m.div>
                ) : current ? (
                  <m.div
                    key={current.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur"
                  >
                    <current.icon className="size-3.5 text-primary" />
                    {current.label}
                  </m.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {steps.map((step, i) => (
                <span
                  key={step.id}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    i < stepIndex ? "bg-primary" : "bg-foreground/25"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {phase === "idle" && !preview && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="space-y-2 px-4">
              <ScanFace className="mx-auto size-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                We&apos;ll guide you through a quick liveness check.
              </p>
            </div>
          </div>
        )}

        {phase === "denied" && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="space-y-2 px-4">
              <VideoOff className="mx-auto size-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Camera blocked. Check browser permissions.
              </p>
            </div>
          </div>
        )}

        {phase === "capturing" && (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex min-h-9 items-center gap-2">
        {(phase === "idle" || phase === "denied") && !value && (
          <Button type="button" variant="outline" size="sm" onClick={() => void start()}>
            <ScanFace className="size-4" />
            {phase === "denied" ? "Retry camera" : "Start face scan"}
          </Button>
        )}
        {active && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            Hold steady — capturing automatically…
          </p>
        )}
        {value && phase === "done" && (
          <Button type="button" variant="outline" size="sm" onClick={retake}>
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
