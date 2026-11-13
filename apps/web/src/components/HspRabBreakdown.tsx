import type { AhspGroup, HSPResult } from '@ahs-id/core';
import type { HspCalculationSources } from '@/lib/calculator';
import {
  formatIdr,
  RabColumnHeaders,
  RabComponentRow,
  RabRecapSection,
  RabSectionTitle,
  RabSubtotalRow,
  RabTableShell,
  uraianKomponen,
} from '@/components/hsp-rab-table';

const SECTION_LABEL: Readonly<Record<AhspGroup['type'], string>> = {
  L: 'A. Tenaga Kerja',
  M: 'B. Bahan',
  E: 'C. Peralatan',
};

interface HspRabBreakdownProps {
  readonly result: HSPResult;
  readonly sources?: HspCalculationSources | null;
}

/** RAB / PUPR column layout matching {@link exportHspToExcelBuffer}. */
export function HspRabBreakdown({ result, sources }: HspRabBreakdownProps) {
  const overheadValue = result.baseTotal * (result.overheadPct / 100);
  const profitValue = result.baseTotal * (result.profitPct / 100);
  const directLabel = result.subAhsp.length > 0
    ? 'Biaya Langsung (A+B+C+D)'
    : 'Biaya Langsung (A+B+C)';

  return (
    <div className="min-w-0 max-w-full overflow-x-clip rounded-2xl border border-border/80 bg-card/50">
      <div className="grid gap-4 border-b border-border/80 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Kode</p>
          <p className="mt-1 font-mono font-semibold text-primary">{result.kode_ahsp}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Nama</p>
          <p className="mt-1 text-pretty font-medium">{result.nama}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Satuan pekerjaan</p>
          <p className="mt-1 font-mono font-semibold tabular-nums">{result.satuan_bayar}</p>
        </div>
      </div>

      {sources ? (
        <div className="border-b border-border/80 bg-muted/20 px-5 py-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sumber data</p>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Koefisien AHSP (AHS)</dt>
              <dd className="mt-1 font-medium">{sources.ahspBundle}</dd>
              {sources.ahspRegulation ? (
                <dd className="mt-1 text-xs leading-5 text-muted-foreground">{sources.ahspRegulation}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Harga satuan dasar (HSD)</dt>
              {sources.fixedPriceNote ? (
                <dd className="mt-1 text-xs leading-5 text-muted-foreground">{sources.fixedPriceNote}</dd>
              ) : (
                <>
                  {sources.hsdCatalog ? <dd className="mt-1 font-medium">{sources.hsdCatalog}</dd> : null}
                  {sources.hsdDetail ? (
                    <dd className="mt-1 text-xs leading-5 text-muted-foreground">{sources.hsdDetail}</dd>
                  ) : null}
                </>
              )}
            </div>
          </dl>
          {sources.overlayNote ? (
            <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
              {sources.overlayNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <HspRabMobileSummary
        directLabel={directLabel}
        overheadValue={overheadValue}
        profitValue={profitValue}
        result={result}
      />

      <div className="hidden md:block">
        <RabTableShell caption={`Rincian analisa harga satuan ${result.kode_ahsp} — ${result.nama}`}>
          {result.groups.map((group) => {
            const sectionLabel = SECTION_LABEL[group.type] ?? group.title;
            return (
              <GroupSection
                group={group}
                key={group.type}
                sectionLabel={sectionLabel}
              />
            );
          })}
          {result.subAhsp.length > 0 ? (
            <SubAhspSection lines={result.subAhsp} />
          ) : null}
          <RabRecapSection
            lines={[
              { label: directLabel, amount: result.baseTotal },
              { label: `Overhead (${result.overheadPct}%)`, amount: overheadValue },
              { label: `Profit (${result.profitPct}%)`, amount: profitValue },
              { label: 'Harga Satuan Pekerjaan', amount: result.grandTotal, bold: true },
            ]}
          />
        </RabTableShell>
      </div>
    </div>
  );
}

function HspRabMobileSummary({
  result,
  directLabel,
  overheadValue,
  profitValue,
}: {
  readonly result: HSPResult;
  readonly directLabel: string;
  readonly overheadValue: number;
  readonly profitValue: number;
}): React.JSX.Element {
  return (
    <div className="space-y-5 border-b border-border/80 px-4 py-5 md:hidden sm:px-5">
      <p className="text-pretty text-xs leading-5 text-muted-foreground">
        Ringkasan untuk HP. Tabel PUPR lengkap tampil di layar lebih lebar, atau unduh Excel.
      </p>
      {result.groups.map((group) => {
        const sectionLabel = SECTION_LABEL[group.type] ?? group.title;
        return (
          <section key={group.type}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{sectionLabel}</h4>
            <ul className="mt-3 space-y-2">
              {group.components.map((component) => (
                <li className="flex items-start justify-between gap-3 text-sm" key={`${group.type}-${component.ref}-${component.nama}`}>
                  <span className="min-w-0 text-pretty text-foreground">
                    {uraianKomponen(component.ref, component.nama)}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatIdr(component.total_price)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-sm font-semibold tabular-nums">
              Subtotal {sectionLabel}
              <span className="ml-2 font-mono">{formatIdr(group.total)}</span>
            </p>
          </section>
        );
      })}
      {result.subAhsp.length > 0 ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">D. Sub AHSP</h4>
          <ul className="mt-3 space-y-2">
            {result.subAhsp.map((line) => (
              <li className="flex items-start justify-between gap-3 text-sm" key={`${line.ref_ahsp}-${line.nama}`}>
                <span className="min-w-0 text-pretty">{uraianKomponen(line.ref_ahsp, line.nama)}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums">{formatIdr(line.total_price)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <dl className="space-y-2 border-t border-border/70 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{directLabel}</dt>
          <dd className="font-mono tabular-nums">{formatIdr(result.baseTotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Overhead ({result.overheadPct}%)</dt>
          <dd className="font-mono tabular-nums">{formatIdr(overheadValue)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Profit ({result.profitPct}%)</dt>
          <dd className="font-mono tabular-nums">{formatIdr(profitValue)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border/60 pt-3 font-semibold">
          <dt>Harga satuan pekerjaan</dt>
          <dd className="font-mono text-primary tabular-nums">{formatIdr(result.grandTotal)}</dd>
        </div>
      </dl>
    </div>
  );
}

function GroupSection({
  group,
  sectionLabel,
}: {
  readonly group: AhspGroup;
  readonly sectionLabel: string;
}) {
  return (
    <>
      <RabSectionTitle label={sectionLabel} />
      <RabColumnHeaders />
      {group.components.map((component) => (
        <RabComponentRow
          hargaSatuan={component.unit_price}
          jumlah={component.total_price}
          key={`${group.type}-${component.ref}-${component.nama}`}
          koefisien={component.coefficient}
          satuan={component.satuan}
          uraian={uraianKomponen(component.ref, component.nama)}
        />
      ))}
      <RabSubtotalRow sectionLabel={sectionLabel} total={group.total} />
    </>
  );
}

function SubAhspSection({
  lines,
}: {
  readonly lines: HSPResult['subAhsp'];
}) {
  const subtotal = lines.reduce((sum, line) => sum + line.total_price, 0);
  return (
    <>
      <RabSectionTitle label="D. Sub AHSP" />
      <RabColumnHeaders />
      {lines.map((line) => (
        <RabComponentRow
          hargaSatuan={line.unit_price}
          jumlah={line.total_price}
          key={`${line.ref_ahsp}-${line.nama}`}
          koefisien={line.koefisien}
          satuan="—"
          uraian={uraianKomponen(line.ref_ahsp, line.nama)}
        />
      ))}
      <RabSubtotalRow sectionLabel="D. Sub AHSP" total={subtotal} />
    </>
  );
}
