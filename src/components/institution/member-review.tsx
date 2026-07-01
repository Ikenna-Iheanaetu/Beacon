"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  approveMember,
  rejectMember,
  type MemberReviewState,
} from "@/app/institution/members/actions";
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

function useToastOnError(state: MemberReviewState) {
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
      {pending ? "Rejecting…" : "Reject"}
    </Button>
  );
}

export function MemberReview({
  memberRowId,
  name,
}: {
  memberRowId: string;
  name: string;
}) {
  const [approveState, approveAction] = useActionState<
    MemberReviewState,
    FormData
  >(approveMember, {});
  const [rejectState, rejectAction] = useActionState<
    MemberReviewState,
    FormData
  >(rejectMember, {});
  const [open, setOpen] = useState(false);

  useToastOnError(approveState);
  useToastOnError(rejectState);

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
        <input type="hidden" name="member_row_id" value={memberRowId} />
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
            <DialogTitle>Reject {name}&apos;s request</DialogTitle>
            <DialogDescription>
              Add a brief reason. The practitioner can see this.
            </DialogDescription>
          </DialogHeader>
          <form
            action={rejectAction}
            onSubmit={() => {
              submitted.current = true;
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="member_row_id" value={memberRowId} />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`reason-${memberRowId}`}>Reason</Label>
              <Textarea
                id={`reason-${memberRowId}`}
                name="reason"
                placeholder="e.g. Not currently on staff."
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
