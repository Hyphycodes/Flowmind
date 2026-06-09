"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { OutputTable } from "@/lib/pipeline/schema";
import { formatCell } from "@/lib/ui/format";

type Row = Record<string, unknown>;

export function TableView({ table }: { table: OutputTable }) {
  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      table.columns.map((c) => ({
        accessorKey: c.key,
        header: c.label,
        cell: (info) => <Cell value={info.getValue()} type={c.type} />,
      })),
    [table],
  );

  const t = useReactTable({ data: table.rows as Row[], columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          {t.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-line bg-white/[0.02]">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium text-ink-faint"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {t.getRowModel().rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60 last:border-0">
              {r.getVisibleCells().map((c) => (
                <td key={c.id} className="whitespace-nowrap px-2.5 py-1.5 text-ink-dim">
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ value, type }: { value: unknown; type?: string }) {
  if (type === "badge")
    return (
      <span className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-ink">
        {String(value ?? "—")}
      </span>
    );
  return <span>{formatCell(value, type)}</span>;
}
