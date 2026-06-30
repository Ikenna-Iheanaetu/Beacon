"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Download, FileText, Mail } from "lucide-react";
import { toast } from "sonner";
import { emailOwnRecord } from "@/app/(patient)/qr/actions";
import type { RegenerateState } from "@/app/(patient)/qr/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Mail />
      {pending ? "Sending…" : "Send record"}
    </Button>
  );
}

export function RecordExport() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<RegenerateState, FormData>(
    emailOwnRecord,
    {},
  );
  const lastState = useRef(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success("Record sent. Tell the recipient to check their inbox.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-primary-400">
          <FileText className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            Share your full record
          </p>
          <p className="text-sm text-muted-foreground">
            Download a PDF of your medical record, or email it to a doctor or
            family member.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="default">
          <a href="/qr/export" download="beacon-record.pdf">
            <Download />
            Download record (PDF)
          </a>
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Mail />
              Email my record
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form action={formAction} className="flex flex-col gap-4" noValidate>
              <DialogHeader>
                <DialogTitle>Email your record</DialogTitle>
                <DialogDescription>
                  We&apos;ll send a PDF of your emergency medical record to the
                  address below. Only share it with people you trust.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-2">
                <Label htmlFor="recipient">
                  Recipient email
                  <span aria-hidden className="text-critical"> *</span>
                  <span className="sr-only"> (required)</span>
                </Label>
                <Input
                  id="recipient"
                  name="recipient"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  placeholder="doctor@example.com"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  name="note"
                  type="text"
                  maxLength={500}
                  placeholder="A short message for the recipient"
                />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <SubmitButton />
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
