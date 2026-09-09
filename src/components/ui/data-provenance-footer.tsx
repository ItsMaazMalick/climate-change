"use client";

import { Download } from "lucide-react";

/**
 * Attached to every chart. Says exactly what the numbers are and where they
 * came from, and offers the raw rows as CSV.
 */
export function DataProvenanceFooter({
  variable,
  aggregation,
  epoch,
  ensembleSize = 30,
  source = "World Bank CCKP · CMIP6 · 0.25°",
  csv,
}: {
  variable: string;
  aggregation: string;
  epoch: string;
  ensembleSize?: number;
  source?: string;
  /** () => { filename, rows } — a CSV string. Omit to hide the button. */
  csv?: () => { filename: string; content: string };
}) {
  const download = () => {
    if (!csv) return;
    const { filename, content } = csv();
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-2xs text-ink-faint">
      <span data-numeric>
        {source} · {variable} · {aggregation} · {epoch} · n&nbsp;=&nbsp;{ensembleSize}
      </span>
      {csv && (
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1 rounded-(--radius-control) border border-border px-2 py-1 font-medium text-ink-muted transition-colors hover:bg-surface-hover"
        >
          <Download className="h-3 w-3" /> Download CSV
        </button>
      )}
    </div>
  );
}

/** Build a CSV string from a header row and data rows. */
export function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}
