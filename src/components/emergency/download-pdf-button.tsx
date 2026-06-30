"use client";

import { useState } from "react";
import { Download, FileText, FileType } from "lucide-react";
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

/**
 * Lets an approved doctor download the on-screen record as a PDF. Requires a
 * typed reason (≥10 chars) which is recorded in the patient's access log, then
 * navigates to the audited /e/{token}/pdf route which streams the download.
 */
export function DownloadPdfButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 10;

  function download(format: "pdf" | "docx") {
    if (!valid) return;
    const query = `reason=${encodeURIComponent(reason.trim())}${
      format === "docx" ? "&format=docx" : ""
    }`;
    window.location.href = `/e/${token}/pdf?${query}`;
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Download />
          Download record
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download this record</DialogTitle>
          <DialogDescription>
            Briefly note why you&apos;re taking a copy. This is recorded in the
            patient&apos;s access log.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pdf-reason">Reason</Label>
          <Textarea
            id="pdf-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Transferring patient to ICU; attaching record to handover."
            aria-describedby="pdf-reason-hint"
          />
          <p id="pdf-reason-hint" className="text-sm text-muted-foreground">
            At least 10 characters.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="outline"
            onClick={() => download("docx")}
            disabled={!valid}
          >
            <FileType />
            Word
          </Button>
          <Button onClick={() => download("pdf")} disabled={!valid}>
            <FileText />
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
