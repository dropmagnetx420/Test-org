"use client";

import { useActionState, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { FileDrop } from "@/components/kyc/file-drop";
import { SelfieCapture } from "@/components/kyc/selfie-capture";
import { submitKyc } from "@/lib/actions/kyc";
import type { ActionResult, IdDocumentType } from "@/types/database";

const DOCUMENT_TYPES: { value: IdDocumentType; label: string; needsBack: boolean }[] = [
  { value: "national_id", label: "National ID card", needsBack: true },
  { value: "passport", label: "Passport", needsBack: false },
  { value: "driving_license", label: "Driving license", needsBack: true },
];

export function KycForm({ defaultName }: { defaultName: string }) {
  const [documentType, setDocumentType] = useState<IdDocumentType>("national_id");
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  const [state, formAction] = useActionState<ActionResult | null, FormData>(submitKyc, null);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success(state.message ?? "Documents submitted.");
  }, [state]);

  const config = DOCUMENT_TYPES.find((item) => item.value === documentType)!;
  const ready = Boolean(frontUrl && selfieUrl && (!config.needsBack || backUrl));

  return (
    <form action={formAction}>
      <input type="hidden" name="documentType" value={documentType} />
      <input type="hidden" name="documentFrontUrl" value={frontUrl} />
      <input type="hidden" name="documentBackUrl" value={backUrl} />
      <input type="hidden" name="selfieUrl" value={selfieUrl} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle className="text-lg">1. Personal details</CardTitle>
            <CardDescription>
              Enter your details exactly as they appear on your document.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full legal name</Label>
              <Input
                id="fullName"
                name="fullName"
                required
                defaultValue={defaultName}
                placeholder="Jane Doe"
                aria-invalid={Boolean(state?.fieldErrors?.fullName)}
              />
              {state?.fieldErrors?.fullName && (
                <p className="text-xs text-red-400">{state.fieldErrors.fullName[0]}</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  required
                  aria-invalid={Boolean(state?.fieldErrors?.dateOfBirth)}
                />
                {state?.fieldErrors?.dateOfBirth && (
                  <p className="text-xs text-red-400">{state.fieldErrors.dateOfBirth[0]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  required
                  placeholder="United States"
                  aria-invalid={Boolean(state?.fieldErrors?.country)}
                />
                {state?.fieldErrors?.country && (
                  <p className="text-xs text-red-400">{state.fieldErrors.country[0]}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">
                Residential address <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input id="address" name="address" placeholder="Street, city, postal code" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Document type</Label>
                <Select
                  value={documentType}
                  onValueChange={(value) => {
                    setDocumentType(value as IdDocumentType);
                    setBackUrl("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentNumber">Document number</Label>
                <Input
                  id="documentNumber"
                  name="documentNumber"
                  required
                  placeholder="AB1234567"
                  className="font-mono"
                  aria-invalid={Boolean(state?.fieldErrors?.documentNumber)}
                />
                {state?.fieldErrors?.documentNumber && (
                  <p className="text-xs text-red-400">{state.fieldErrors.documentNumber[0]}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-strong">
          <CardHeader>
            <CardTitle className="text-lg">2. Documents & selfie</CardTitle>
            <CardDescription>
              All four corners must be visible and the text readable. Files are stored privately and
              only visible to our compliance team.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <FileDrop
              id="front"
              kind="front"
              label={config.needsBack ? "Document front" : "Passport photo page"}
              value={frontUrl}
              onUploaded={setFrontUrl}
            />

            {config.needsBack && (
              <FileDrop
                id="back"
                kind="back"
                label="Document back"
                value={backUrl}
                onUploaded={setBackUrl}
              />
            )}

            <SelfieCapture value={selfieUrl} onUploaded={setSelfieUrl} />

            <SubmitButton
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!ready}
              pendingText="Submitting…"
            >
              <ShieldCheck className="size-4" />
              Submit for verification
            </SubmitButton>

            {!ready && (
              <p className="text-center text-xs text-muted-foreground">
                Upload your document{config.needsBack ? " (both sides)" : ""} and capture a selfie to
                continue.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
