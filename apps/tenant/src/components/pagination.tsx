import Link from "next/link";

function makePages(current: number, total: number): (number | "…")[] {
  const pages: (number | "…")[] = [];
  const window = 1; // pages either side of current
  const push = (v: number | "…") => {
    if (pages[pages.length - 1] !== v) pages.push(v);
  };
  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - window && i <= current + window)
    ) {
      push(i);
    } else if (i < current - window && pages[pages.length - 1] !== "…") {
      push("…");
    } else if (i > current + window && pages[pages.length - 1] !== "…") {
      push("…");
    }
  }
  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
}: {
  currentPage: number;
  totalPages: number;
  basePath: string; // e.g. "/all" — will append ?page=N
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) =>
    p === 1 ? basePath : `${basePath}?page=${p}`;

  const items = makePages(currentPage, totalPages);

  return (
    <nav
      aria-label="pagination"
      className="mt-12 flex flex-wrap items-center justify-center gap-1.5"
    >
      {currentPage > 1 && (
        <Link
          href={hrefFor(currentPage - 1)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:border-white/30 hover:bg-white/10 hover:text-white"
        >
          ← ก่อนหน้า
        </Link>
      )}

      {items.map((p, i) =>
        p === "…" ? (
          <span
            key={`e${i}`}
            className="px-2 py-2 text-sm text-white/40"
            aria-hidden
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            aria-current={p === currentPage ? "page" : undefined}
            className={
              p === currentPage
                ? "rounded-lg px-4 py-2 text-sm font-bold text-black shadow-sm"
                : "rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:border-white/30 hover:bg-white/10 hover:text-white"
            }
            style={
              p === currentPage
                ? { background: "var(--tenant-primary)" }
                : undefined
            }
          >
            {p}
          </Link>
        )
      )}

      {currentPage < totalPages && (
        <Link
          href={hrefFor(currentPage + 1)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:border-white/30 hover:bg-white/10 hover:text-white"
        >
          ถัดไป →
        </Link>
      )}
    </nav>
  );
}
