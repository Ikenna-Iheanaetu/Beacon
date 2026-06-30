"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { reasonSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

/**
 * Reusable reason-gated dialog. Collects a required free-text reason (validated
 * client-side with reasonSchema, min 10 chars) and submits the wrapping form to
 * the provided server action. Hidden inputs supplied via `extraFields` are
 * forwarded with the form (e.g. the patientId).
 */
export function ReasonDialog({
  triggerLabel,
  title,
  description,
  submitLabel = "Open record",
  action,
  extraFields,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  submitLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  extraFields?: Record<string, string>;
  triggerVariant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "critical"
    | "link";
  triggerSize?: "default" | "sm" | "lg" | "icon";
}) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const parsed = reasonSchema.safeParse(reason);
  const showError = reason.length > 0 && !parsed.success;
  const error = showError ? parsed.error.issues[0]?.message : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          {extraFields &&
            Object.entries(extraFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}

          <div className="flex flex-col gap-2">
            <Label htmlFor={reasonId}>Reason for access</Label>
            <Textarea
              id={reasonId}
              name="reason"
              required
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="This is recorded in the audit log and shown to the patient."
              aria-invalid={showError}
            />
            <p className="text-xs text-muted-foreground">
              Logged to the audit trail and surfaced in the patient&apos;s own
              access log.
            </p>
          </div>

          {error && (
            <Alert variant="critical" aria-live="polite">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton label={submitLabel} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
