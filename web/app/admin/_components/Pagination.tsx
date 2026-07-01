interface Props {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

export function Pagination({ page, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="font-mono text-[11px] text-ink-faint">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <a
            href={buildHref(page - 1)}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted hover:text-ink border hairline px-3 py-1.5 transition-colors"
          >
            ← Prev
          </a>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint border hairline px-3 py-1.5 opacity-40">
            ← Prev
          </span>
        )}
        {page < totalPages ? (
          <a
            href={buildHref(page + 1)}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted hover:text-ink border hairline px-3 py-1.5 transition-colors"
          >
            Next →
          </a>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint border hairline px-3 py-1.5 opacity-40">
            Next →
          </span>
        )}
      </div>
    </div>
  );
}
