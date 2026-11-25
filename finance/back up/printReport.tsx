type Table = { heading?: string; headers: string[]; rows: string[][] };

export function printReport(opts: {
  title: string;
  subtitle?: string;
  summary?: [string, string][]; // small boxes at the top: [label, value]
  headers: string[];
  rows: string[][];
  heading?: string; // title above the main table
  extra?: Table; // optional second table below the first
}) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank", "width=1000,height=750");
  if (!w) {
    alert("Please allow pop-ups to print the report.");
    return;
  }

  const table = (t: Table) =>
    `${t.heading ? `<h2>${esc(t.heading)}</h2>` : ""}` +
    (t.rows.length === 0
      ? `<p class="sub">No records.</p>`
      : `<table><thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`);

  const summary = (opts.summary ?? [])
    .map(([l, v]) => `<div class="box"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`)
    .join("");
  const tables = [{ heading: opts.heading, headers: opts.headers, rows: opts.rows }, ...(opts.extra ? [opts.extra] : [])]
    .map(table)
    .join("");

  w.document.write(`<!doctype html><html><head><title>${esc(opts.title)}</title><style>
    body{font-family:Inter,Arial,sans-serif;color:#24363b;margin:32px}
    h1{margin:0;font-size:22px;color:#365f68}
    h2{font-size:14px;color:#365f68;margin:22px 0 8px}
    .sub{color:#668d98;font-size:13px;margin:4px 0 18px}
    .boxes{display:flex;gap:12px;margin-bottom:18px}
    .box{border:1px solid #c9d6d9;border-radius:8px;padding:8px 14px}
    .l{font-size:11px;color:#668d98}.v{font-size:16px;font-weight:600}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;color:#668d98;border-bottom:2px solid #365f68;padding:6px 8px}
    td{border-bottom:1px solid #e5e5e5;padding:6px 8px}
    tr{page-break-inside:avoid}
    thead{display:table-header-group}
    .foot{margin-top:18px;font-size:11px;color:#888}
  </style></head><body>
    <h1>${esc(opts.title)}</h1>
    <div class="sub">${esc(opts.subtitle ?? "")}</div>
    <div class="boxes">${summary}</div>
    ${tables}
    <div class="foot">Generated ${new Date().toLocaleString()} · Procurement</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}