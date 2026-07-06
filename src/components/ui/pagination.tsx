import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Builds the href for a given page number, e.g. (p) => `/admin/auth-log?page=${p}`. */
  buildHref: (page: number) => string;
}

/** Prev/next pager for server-rendered list pages. Plain links (no client JS)
 *  since the page itself re-fetches from `?page=` — no state to preserve. */
export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-border px-6 py-4"
    >
      <PagerLink href={hasPrev ? buildHref(page - 1) : undefined} disabled={!hasPrev}>
        <ChevronLeft className="size-4" />
        Previous
      </PagerLink>
      <span className="data-label text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <PagerLink href={hasNext ? buildHref(page + 1) : undefined} disabled={!hasNext}>
        Next
        <ChevronRight className="size-4" />
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href?: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }));
  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href!} className={className}>
      {children}
    </Link>
  );
}
