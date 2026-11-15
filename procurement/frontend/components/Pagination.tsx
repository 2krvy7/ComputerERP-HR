"use client";

// Prev / page numbers / Next. Shows nothing when everything fits on one page.
export default function Pagination({
  total,
  page,
  pageSize,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (total <= pageSize) return null;

  const pages = Math.ceil(total / pageSize);
  const start = Math.max(1, Math.min(page - 2, pages - 4)); // show up to 5 numbers around the current page
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn = (active: boolean, disabled = false) => ({
    border: "none",
    cursor: disabled ? "default" : "pointer",
    minWidth: "1.8vw",
    padding: "0.3vw 0.7vw",
    borderRadius: "99vw",
    fontSize: "0.78vw",
    fontWeight: 600,
    backgroundColor: active ? "#365f68" : "#e4e9ec",
    color: active ? "#ffffff" : "#55656b",
    opacity: disabled ? 0.45 : 1,
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.7vw 1.4vw",
        borderTop: "1px solid #eee",
        fontSize: "0.8vw",
        color: "#668d98",
      }}
    >
      <span>
        {from}–{to} of {total}
      </span>
      <div style={{ display: "flex", gap: "0.3vw" }}>
        <button disabled={page === 1} onClick={() => onPage(page - 1)} style={btn(false, page === 1)}>
          Prev
        </button>
        {nums.map((n) => (
          <button key={n} onClick={() => onPage(n)} style={btn(n === page)}>
            {n}
          </button>
        ))}
        <button disabled={page === pages} onClick={() => onPage(page + 1)} style={btn(false, page === pages)}>
          Next
        </button>
      </div>
    </div>
  );
}