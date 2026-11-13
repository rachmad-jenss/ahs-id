import type { PortalComponentRow, PortalHspResult } from '@/lib/portal-hsp';
import {
  formatIdr,
  RabColumnHeaders,
  RabComponentRow,
  RabRecapSection,
  RabSectionTitle,
  RabSubtotalRow,
  RabTableShell,
} from '@/components/hsp-rab-table';

interface PortalHspBreakdownProps {
  readonly result: PortalHspResult;
}

function sectionTotal(rows: readonly PortalComponentRow[]): number {
  return rows.reduce((sum, row) => sum + (row.jumlah_rp ?? 0), 0);
}

/** Portal DCKTRP price — same RAB column layout as engine {@link HspRabBreakdown}. */
export function PortalHspBreakdown({ result }: PortalHspBreakdownProps) {
  const sections = (
    [
      { label: 'A. Tenaga Kerja', rows: result.tenaga_kerja },
      { label: 'B. Bahan', rows: result.bahan },
      { label: 'C. Peralatan', rows: result.peralatan },
    ] as const
  ).filter((group) => group.rows.length > 0);

  const baseTotal = sections.reduce((sum, group) => sum + sectionTotal(group.rows), 0);
  const grandTotal = result.harga_satuan_rp ?? baseTotal;

  const recapLines = [
    { label: 'Biaya Langsung (A+B+C)', amount: baseTotal > 0 ? baseTotal : null },
    result.profit_rp != null
      ? {
          label: `Profit${result.profit_pct != null ? ` (${result.profit_pct}%)` : ''} (portal)`,
          amount: result.profit_rp,
        }
      : null,
    { label: 'Harga Satuan Pekerjaan', amount: grandTotal, bold: true },
  ].filter((line): line is NonNullable<typeof line> => line != null);

  return (
    <div className="min-w-0 max-w-full overflow-x-clip rounded-2xl border border-border/80 bg-card/50">
      <div className="grid gap-4 border-b border-border/80 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Kode</p>
          <p className="mt-1 font-mono font-semibold text-primary">{result.kode}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Nama</p>
          <p className="mt-1 font-medium">{result.nama}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Satuan pekerjaan</p>
          <p className="mt-1 font-mono font-semibold tabular-nums">{result.satuan_bayar ?? '—'}</p>
        </div>
      </div>

      <div className="border-b border-border/80 bg-muted/20 px-5 py-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber data</p>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Harga satuan (portal)</dt>
            <dd className="mt-1 font-medium">Portal Bangun Jakarta (DCKTRP)</dd>
            <dd className="mt-1 text-xs leading-5 text-muted-foreground">
              Publikasi DKI — bukan hasil hitung koefisien nasional + HSD regional.
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Kategori / dasar hukum</dt>
            {result.kategori ? <dd className="mt-1 font-medium">{result.kategori}</dd> : null}
            {result.dasar_hukum ? (
              <dd className="mt-1 text-xs leading-5 text-muted-foreground">{result.dasar_hukum}</dd>
            ) : null}
          </div>
        </dl>
      </div>

      <div className="space-y-5 border-b border-border/80 px-4 py-5 md:hidden sm:px-5">
        {sections.map((group) => {
          const subtotal = sectionTotal(group.rows);
          return (
            <section key={group.label}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</h4>
              <ul className="mt-3 space-y-2">
                {group.rows.map((row, index) => (
                  <li className="flex items-start justify-between gap-3 text-sm" key={`${group.label}-${index}`}>
                    <span className="min-w-0 text-pretty">{row.nama}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {row.jumlah_rp != null ? formatIdr(row.jumlah_rp) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-right text-sm font-semibold tabular-nums">
                Subtotal <span className="ml-2 font-mono">{formatIdr(subtotal)}</span>
              </p>
            </section>
          );
        })}
        <dl className="space-y-2 border-t border-border/70 pt-4 text-sm">
          {recapLines.map((line) => (
            <div
              className={line.bold ? 'flex justify-between gap-4 border-t border-border/60 pt-3 font-semibold' : 'flex justify-between gap-4'}
              key={line.label}
            >
              <dt className={line.bold ? 'text-foreground' : 'text-muted-foreground'}>{line.label}</dt>
              <dd className="font-mono tabular-nums">{line.amount != null ? formatIdr(line.amount) : '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="hidden md:block">
        <RabTableShell caption={`Rincian harga satuan portal ${result.kode} — ${result.nama}`}>
          {sections.map((group) => {
            const subtotal = sectionTotal(group.rows);
            return (
              <GroupBlock group={group} key={group.label} subtotal={subtotal} />
            );
          })}
          <RabRecapSection lines={recapLines} />
        </RabTableShell>
      </div>

      <div className="border-t border-border/80 px-5 py-4 text-sm">
        <p>
          <a className="font-semibold text-primary hover-fine-underline" href={result.detailHref}>
            Buka halaman lengkap
          </a>
          {result.apiUrl ? (
            <>
              {' · '}
              <a
                className="font-semibold text-primary hover-fine-underline"
                href={result.apiUrl}
                rel="noreferrer"
                target="_blank"
              >
                Sumber API
              </a>
            </>
          ) : null}
          <span className="text-muted-foreground">
            {' · '}
            ID portal:
            {' '}
            <span className="font-mono">{result.sourceId}</span>
          </span>
        </p>
      </div>
    </div>
  );
}

function GroupBlock({
  group,
  subtotal,
}: {
  readonly group: { readonly label: string; readonly rows: readonly PortalComponentRow[] };
  readonly subtotal: number;
}) {
  return (
    <>
      <RabSectionTitle label={group.label} />
      <RabColumnHeaders />
      {group.rows.map((row, index) => (
        <RabComponentRow
          hargaSatuan={row.harga_satuan_rp}
          jumlah={row.jumlah_rp}
          key={`${group.label}-${index}-${row.nama}`}
          koefisien={row.koefisien}
          satuan={row.satuan ?? '—'}
          uraian={row.nama}
        />
      ))}
      <RabSubtotalRow sectionLabel={group.label} total={subtotal} />
    </>
  );
}
