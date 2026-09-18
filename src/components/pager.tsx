import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Server-safe pager (plain links, no functions crossing the boundary). */
export function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <span className="text-xs" style={{ color: "var(--faint)" }}>Page {page} of {pages}</span>
      <div className="flex gap-1.5">
        <Link aria-label="Previous page" className={`btn-outline btn-sm ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={hrefFor(page - 1)}><ChevronLeft size={14} /></Link>
        <Link aria-label="Next page" className={`btn-outline btn-sm ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={hrefFor(page + 1)}><ChevronRight size={14} /></Link>
      </div>
    </div>
  );
}
