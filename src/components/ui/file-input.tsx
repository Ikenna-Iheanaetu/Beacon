"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Styled file picker matching the Input control. Shows the selected filename
 * and an optional hint (accepted types / size). Wraps a visually-hidden native
 * <input type="file"> inside a label so it stays keyboard- and SR-accessible.
 */
const FileInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { hint?: string }
>(({ className, hint, onChange, ...props }, ref) => {
  const [fileName, setFileName] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-input bg-card px-3 py-2 text-base text-foreground shadow-sm transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring",
          className,
        )}
      >
        <Upload className="size-4 shrink-0 text-muted-foreground" />
        <span className={fileName ? "truncate text-foreground" : "text-muted-foreground"}>
          {fileName ?? "Choose a file…"}
        </span>
        <input
          ref={ref}
          type="file"
          className="sr-only"
          onChange={(e) => {
            setFileName(e.target.files?.[0]?.name ?? null);
            onChange?.(e);
          }}
          {...props}
        />
      </label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
});
FileInput.displayName = "FileInput";

export { FileInput };
