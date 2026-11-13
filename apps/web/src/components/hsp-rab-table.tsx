import type { ReactNode } from 'react';

export const RAB_COLUMNS = [
  'Uraian',
  'Satuan',
  'Koefisien',
  'Harga Satuan',
  'Jumlah',
] as const;

export function formatIdr(value: number): string {
  return value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 });
}

export function formatIdrNullable(value: number | null): string {
  if (value == null) return '—';
  return formatIdr(value);
}

export function formatKoefisien(value: number): string {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 5 });
}

export function formatKoefisienNullable(value: number | null): string {
  if (value == null) return '—';
  return formatKoefisien(value);
}

export function uraianKomponen(ref: string, nama: string): string {
  if (!nama || nama === ref) return ref;
  return `${ref} — ${nama}`;
}

interface RabTableShellProps {
  readonly caption: string;
  readonly children: ReactNode;
}

/** Shared PUPR-style RAB table wrapper (scroll + min width). */
export function RabTableShell({ caption, children }: RabTableShellProps) {
  return (
    <div className="table-scroll-root table-scroll">
      <p className="px-5 py-3 text-xs text-muted-foreground lg:sr-only">
        Geser tabel ke samping untuk melihat semua kolom.
      </p>
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function RabSectionTitle({ label }: { readonly label: string }) {
  return (
    <tr className="border-b border-border/80 bg-muted/55">
      <th
        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-foreground"
        colSpan={5}
        scope="colgroup"
      >
        {label}
      </th>
    </tr>
  );
}

export function RabColumnHeaders() {
  return (
    <tr className="border-b border-border/70 text-xs uppercase tracking-[0.1em] text-muted-foreground">
      {RAB_COLUMNS.map((label) => (
        <th
          className={`px-5 py-2.5 font-medium ${label === 'Uraian' || label === 'Satuan' ? 'text-left' : 'text-right'}`}
          key={label}
          scope="col"
        >
          {label}
        </th>
      ))}
    </tr>
  );
}

interface RabComponentRowProps {
  readonly uraian: string;
  readonly satuan: string;
  readonly koefisien: number | null;
  readonly hargaSatuan: number | null;
  readonly jumlah: number | null;
}

export function RabComponentRow({
  uraian,
  satuan,
  koefisien,
  hargaSatuan,
  jumlah,
}: RabComponentRowProps) {
  return (
    <tr className="border-b border-border/50">
      <td className="px-5 py-3 font-medium">{uraian}</td>
      <td className="px-5 py-3 text-muted-foreground">{satuan || '—'}</td>
      <td className="px-5 py-3 text-right font-mono tabular-nums">{formatKoefisienNullable(koefisien)}</td>
      <td className="px-5 py-3 text-right font-mono tabular-nums">{formatIdrNullable(hargaSatuan)}</td>
      <td className="px-5 py-3 text-right font-mono tabular-nums">{formatIdrNullable(jumlah)}</td>
    </tr>
  );
}

export function RabSubtotalRow({
  sectionLabel,
  total,
}: {
  readonly sectionLabel: string;
  readonly total: number;
}) {
  return (
    <tr className="border-b border-border/80 bg-muted/30 font-semibold">
      <td className="px-5 py-3" colSpan={3}>
        Subtotal {sectionLabel}
      </td>
      <td className="px-5 py-3 text-right text-muted-foreground">Subtotal</td>
      <td className="px-5 py-3 text-right font-mono tabular-nums">{formatIdr(total)}</td>
    </tr>
  );
}

export interface RabRecapLine {
  readonly label: string;
  readonly amount: number | null;
  readonly bold?: boolean;
}

export function RabRecapSection({ lines }: { readonly lines: readonly RabRecapLine[] }) {
  const visible = lines.filter((line) => line.amount != null);
  if (visible.length === 0) return null;
  return (
    <>
      <RabSectionTitle label="Rekapitulasi" />
      {visible.map((line) => (
        <tr
          className={`border-b border-border/50 ${line.bold ? 'bg-primary/5 font-semibold' : ''}`}
          key={line.label}
        >
          <td className="px-5 py-3" colSpan={4}>
            {line.label}
          </td>
          <td className="px-5 py-3 text-right font-mono tabular-nums">{formatIdr(line.amount as number)}</td>
        </tr>
      ))}
    </>
  );
}
