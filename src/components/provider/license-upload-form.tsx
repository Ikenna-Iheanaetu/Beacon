"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  submitLicenseVerification,
  type VerifyState,
} from "@/app/provider/verify/actions";
import { LICENSE_FILE_TYPES, PRACTITIONER_TYPES } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileInput } from "@/components/ui/file-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      <ShieldCheck />
      {pending ? "Submitting…" : "Submit for verification"}
    </Button>
  );
}

export function LicenseUploadForm({
  defaultLicenseNumber = "",
  defaultPractitionerType = "doctor",
}: {
  defaultLicenseNumber?: string;
  defaultPractitionerType?: string;
}) {
  const [state, formAction] = useActionState<VerifyState, FormData>(
    submitLicenseVerification,
    {},
  );
  const lastOk = useRef(false);

  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      toast.success("License submitted. We'll review it shortly.");
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert variant="critical" aria-live="assertive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="practitioner_type">I am a</Label>
        <select
          id="practitioner_type"
          name="practitioner_type"
          required
          defaultValue={defaultPractitionerType}
          className="border-input bg-card focus-visible:ring-ring flex min-h-11 w-full rounded-[var(--radius)] border px-3 py-2 text-base shadow-sm focus:outline-none focus-visible:ring-2"
        >
          {PRACTITIONER_TYPES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label} ({p.council})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="license_number">Council license number</Label>
        <Input
          id="license_number"
          name="license_number"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          className="tabular"
          defaultValue={defaultLicenseNumber}
          placeholder="e.g. MDCN-123456 or NMCN-123456"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="license_document">License document</Label>
        <FileInput
          id="license_document"
          name="license_document"
          accept={LICENSE_FILE_TYPES.join(",")}
          required
          hint="PDF, PNG, or JPEG — up to 5 MB."
        />
      </div>

      <div className="mt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
