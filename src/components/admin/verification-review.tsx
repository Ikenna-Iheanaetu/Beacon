"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  approveVerification,
  rejectVerification,
  type ReviewState,
} from "@/app/admin/verifications/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

function useToastOnError(state: ReviewState) {
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.error && state.error !== last.current) {
      last.current = state.error;
      toast.error(state.error);
    }
  }, [state]);
}

function ApproveInner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <CheckCircle2 />
      {pending ? "Approving…" : "Approve"}
    </Button>
  );
}

function RejectInner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="critical" size="sm" disabled={pending}>
      <XCircle />
      {pending ? "Rejecting…" : "Reject license"}
    </Button>
  );
}

export function VerificationReview({
  providerId,
  name,
}: {
  providerId: string;
  name: string;
}) {
  const [approveState, approveAction] = useActionState<ReviewState, FormData>(
    approveVerification,
    {},
  );
  const [rejectState, rejectAction] = useActionState<ReviewState, FormData>(
    rejectVerification,
    {},
  );
  const [open, setOpen] = useState(false);

  useToastOnError(approveState);
  useToastOnError(rejectState);

  // Close the dialog once a reject succeeds (no error returned).
  const submitted = useRef(false);
  useEffect(() => {
    if (submitted.current && !rejectState.error) {
      submitted.current = false;
      setOpen(false);
    }
  }, [rejectState]);

  return (
    <div className="flex justify-end gap-2">
      <form action={approveAction}>
        <input type="hidden" name="provider_id" value={providerId} />
        <ApproveInner />
        <span className="sr-only">Approve {name}</span>
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <XCircle />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {name}&apos;s license</DialogTitle>
            <DialogDescription>
              Add a brief reason. The doctor sees this and can submit again.
            </DialogDescription>
          </DialogHeader>
          <form
            action={rejectAction}
            onSubmit={() => {
              submitted.current = true;
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="provider_id" value={providerId} />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`reason-${providerId}`}>Reason</Label>
              <Textarea
                id={`reason-${providerId}`}
                name="reason"
                placeholder="e.g. License number doesn't match the uploaded document."
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <RejectInner />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
