"use client";

import { LayoutDashboard } from "lucide-react";
import type { OutputTable, TableColumn, UIBinding } from "@/lib/pipeline/schema";
import { formatCell } from "@/lib/ui/format";
import { TableView } from "./TableView";

export function UIPreview({
  tables,
  bindings,
}: {
  tables: OutputTable[];
  bindings: UIBinding[];
}) {
  const byId = new Map(tables.map((t) => [t.id, t]));
  const renderable = [...bindings]
    .sort((a, b) => a.position - b.position)
    .filter((b) => byId.get(b.tableId));

  if (renderable.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center">
        <LayoutDashboard size={20} className="text-ink-faint" />
        <p className="text-xs text-ink-faint">
          {tables.length ? "No UI bindings for this pipeline." : "Run the pipeline to generate a live UI."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="text-[11px] text-ink-faint">Generated from output tables · updates on every run</div>
      {renderable.map((b) => (
        <Binding key={b.id} binding={b} table={byId.get(b.tableId)!} />
      ))}
    </div>
  );
}

function meta(table: OutputTable, key: string): TableColumn {
  return (
    table.columns.find((c) => c.key === key) ?? { key, label: key, type: "text" as const }
  );
}

function fieldsFor(b: UIBinding, table: OutputTable): string[] {
  if (b.fields.length) return b.fields;
  return table.columns.map((c) => c.key);
}

function Binding({ binding, table }: { binding: UIBinding; table: OutputTable }) {
  const fields = fieldsFor(binding, table);
  const title = binding.title || table.name;

  if (binding.componentType === "metricCards") {
    const row = table.rows[0] ?? {};
    return (
      <section>
        <Title>{title}</Title>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => {
            const c = meta(table, f);
            return (
              <div key={f} className="rounded-xl border border-line bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wide text-ink-faint">{c.label}</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">
                  {formatCell(row[f], c.type)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (binding.componentType === "recordList") {
    return (
      <section>
        <Title>{title}</Title>
        <div className="space-y-1.5">
          {table.rows.slice(0, 6).map((row, i) => {
            const [first, ...rest] = fields;
            return (
              <div key={i} className="rounded-xl border border-line bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-medium text-ink">
                    {formatCell(row[first], meta(table, first).type)}
                  </span>
                  {rest[0] && (
                    <span className="shrink-0 text-[12px] text-ink-dim">
                      {formatCell(row[rest[0]], meta(table, rest[0]).type)}
                    </span>
                  )}
                </div>
                {rest.length > 1 && (
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-ink-faint">
                    {rest.slice(1).map((f) => (
                      <span key={f}>
                        {meta(table, f).label}: {formatCell(row[f], meta(table, f).type)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (binding.componentType === "cardGrid") {
    const [head, ...rest] = fields;
    return (
      <section>
        <Title>{title}</Title>
        <div className="grid grid-cols-2 gap-2">
          {table.rows.slice(0, 8).map((row, i) => (
            <div key={i} className="rounded-xl border border-line bg-white/[0.03] p-3">
              <div className="truncate text-[12.5px] font-medium text-ink">
                {formatCell(row[head], meta(table, head).type)}
              </div>
              {rest.slice(0, 3).map((f) => (
                <div key={f} className="mt-0.5 truncate text-[11px] text-ink-faint">
                  {formatCell(row[f], meta(table, f).type)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (binding.componentType === "checklist") {
    const [first, ...rest] = fields;
    return (
      <section>
        <Title>{title}</Title>
        <div className="space-y-1">
          {table.rows.slice(0, 12).map((row, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-white/[0.03] px-3 py-1.5">
              <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-line-strong" />
              <span className="flex-1 truncate text-[12px] text-ink">
                {formatCell(row[first], meta(table, first).type)}
              </span>
              {rest.map((f) => (
                <span key={f} className="shrink-0 text-[11px] text-ink-faint">
                  {formatCell(row[f], meta(table, f).type)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (binding.componentType === "calendar" || binding.componentType === "timeline") {
    const [first, ...rest] = fields;
    return (
      <section>
        <Title>{title}</Title>
        <div className="space-y-1.5">
          {table.rows.slice(0, 8).map((row, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.03] px-3 py-2">
              <div className="w-12 shrink-0 text-[11px] font-medium text-ink">
                {formatCell(row[first], meta(table, first).type)}
              </div>
              <div className="min-w-0 flex-1">
                {rest.map((f) => (
                  <div key={f} className="truncate text-[12px] text-ink-dim">
                    {formatCell(row[f], meta(table, f).type)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (binding.componentType === "dataTable" || binding.componentType === "comparisonTable") {
    return (
      <section>
        <Title>{title}</Title>
        <TableView table={table} />
      </section>
    );
  }

  // summaryCard / detailPanel / jsonViewer
  const row = table.rows[0] ?? {};
  if (binding.componentType === "jsonViewer") {
    return (
      <section>
        <Title>{title}</Title>
        <pre className="max-h-48 overflow-auto rounded-xl border border-line bg-black/40 p-3 font-mono text-[10.5px] text-ink-dim">
          {JSON.stringify(table.rows, null, 2)}
        </pre>
      </section>
    );
  }

  const [head, ...rest] = fields;
  return (
    <section>
      <Title>{title}</Title>
      <div className="rounded-xl border border-line bg-white/[0.03] p-3.5">
        <div className="text-[13px] font-semibold text-ink">{formatCell(row[head], meta(table, head).type)}</div>
        {rest.map((f) => (
          <div key={f} className="mt-1.5 text-[12px] leading-relaxed text-ink-dim">
            {formatCell(row[f], meta(table, f).type)}
          </div>
        ))}
      </div>
    </section>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">{children}</h4>;
}
