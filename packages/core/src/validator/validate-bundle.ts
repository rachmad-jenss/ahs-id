import type {
  DataBundle,
  HsdRegional,
  ValidationReport,
  ValidationError,
} from '../types/index.js';

export function validateBundle(
  bundle: DataBundle,
  hsd: HsdRegional,
): ValidationReport {
  const errors: ValidationError[] = [];

  const tkCodes = new Set(bundle.tenaga_kerja.items.map((tk) => tk.kode));
  const bahanCodes = new Set(bundle.bahan.items.map((b) => b.kode));
  const alatCodes = new Set(bundle.peralatan.items.map((e) => e.kode));
  const hsdTkRefs = new Set(hsd.tenaga_kerja.map((tk) => tk.ref));
  const hsdBahanRefs = new Set(hsd.bahan.map((b) => b.ref));
  const hsdAlatRefs = new Set(hsd.peralatan_sewa.map((e) => e.ref));

  for (const item of bundle.ahsp_items) {
    const prefix = `ahsp[${item.kode_ahsp}]`;

    for (const tk of item.tenaga_kerja) {
      if (!tkCodes.has(tk.ref)) {
        errors.push(err(`${prefix}.tenaga_kerja`, `Ref "${tk.ref}" not found in master tenaga kerja`, 'REF_MISSING'));
      }
      if (!hsdTkRefs.has(tk.ref)) {
        errors.push(err(`${prefix}.tenaga_kerja`, `Ref "${tk.ref}" not found in HSD regional tenaga kerja`, 'HSD_REF_MISSING'));
      }
      if (tk.koefisien <= 0) {
        errors.push(err(`${prefix}.tenaga_kerja[${tk.ref}].koefisien`, `Coefficient must be > 0, got ${tk.koefisien}`, 'RANGE_KOEF'));
      }
    }

    for (const bahan of item.bahan) {
      if (!bahanCodes.has(bahan.ref)) {
        errors.push(err(`${prefix}.bahan`, `Ref "${bahan.ref}" not found in master bahan`, 'REF_MISSING'));
      }
      if (!hsdBahanRefs.has(bahan.ref)) {
        errors.push(err(`${prefix}.bahan`, `Ref "${bahan.ref}" not found in HSD regional bahan`, 'HSD_REF_MISSING'));
      }
      if (bahan.koefisien <= 0) {
        errors.push(err(`${prefix}.bahan[${bahan.ref}].koefisien`, `Coefficient must be > 0, got ${bahan.koefisien}`, 'RANGE_KOEF'));
      }
    }

    for (const alat of item.peralatan) {
      if (!alatCodes.has(alat.ref)) {
        errors.push(err(`${prefix}.peralatan`, `Ref "${alat.ref}" not found in master peralatan`, 'REF_MISSING'));
      }
      if (alat.mode_biaya === 'sewa' && !hsdAlatRefs.has(alat.ref)) {
        errors.push(err(`${prefix}.peralatan`, `Ref "${alat.ref}" in sewa mode but not found in HSD peralatan_sewa`, 'HSD_REF_MISSING'));
      }
    }

    const marginSum = item.margin.overhead_pct.default + item.margin.profit_pct.default;
    if (marginSum < 10 || marginSum > 15) {
      errors.push(err(`${prefix}.margin`, `Default overhead + profit = ${marginSum}%, must be 10-15%`, 'RANGE_MARGIN'));
    }

    if (!item.provenance.sumber_regulasi) {
      errors.push(warn(`${prefix}.provenance`, 'Missing sumber_regulasi', 'PROVENANCE_INCOMPLETE'));
    }
    if (!item.provenance.halaman) {
      errors.push(warn(`${prefix}.provenance`, 'Missing halaman reference', 'PROVENANCE_INCOMPLETE'));
    }

    // Sub-AHSP ref validity
    const ahspCodes = new Set(bundle.ahsp_items.map((a) => a.kode_ahsp));
    for (const sub of item.sub_ahsp) {
      if (!ahspCodes.has(sub.ref_ahsp)) {
        errors.push(err(`${prefix}.sub_ahsp`, `Ref AHSP "${sub.ref_ahsp}" not found in bundle`, 'SUB_AHSP_REF_MISSING'));
      }
      if (sub.koefisien <= 0) {
        errors.push(err(`${prefix}.sub_ahsp[${sub.ref_ahsp}].koefisien`, `Coefficient must be > 0, got ${sub.koefisien}`, 'RANGE_KOEF'));
      }
    }

    // Namespace pattern validation
    for (const tk of item.tenaga_kerja) {
      if (!tk.ref.startsWith('L.')) {
        errors.push(err(`${prefix}.tenaga_kerja[${tk.ref}]`, `Ref must start with "L.", got "${tk.ref}"`, 'NAMESPACE_INVALID'));
      }
    }
    for (const bahan of item.bahan) {
      if (!bahan.ref.startsWith('M.')) {
        errors.push(err(`${prefix}.bahan[${bahan.ref}]`, `Ref must start with "M.", got "${bahan.ref}"`, 'NAMESPACE_INVALID'));
      }
    }
    for (const alat of item.peralatan) {
      if (!alat.ref.startsWith('E.')) {
        errors.push(err(`${prefix}.peralatan[${alat.ref}]`, `Ref must start with "E.", got "${alat.ref}"`, 'NAMESPACE_INVALID'));
      }
    }
  }

  // Faktor konversi coverage: materials used in volume conversion should have factors
  const fkMaterials = new Set(bundle.faktor_konversi.items.map((f) => f.material));
  for (const item of bundle.ahsp_items) {
    const hasVolumeConversion = item.peralatan.some(
      (e) => e.volume_state !== null && e.volume_state !== item.volume_state_bayar,
    );
    if (hasVolumeConversion && fkMaterials.size === 0) {
      errors.push(warn(
        `ahsp[${item.kode_ahsp}]`,
        'Item requires volume conversion but no faktor_konversi entries exist',
        'FK_COVERAGE_MISSING',
      ));
    }
  }

  for (const fk of bundle.faktor_konversi.items) {
    if (fk.bank_to_loose <= 0) {
      errors.push(err(`faktor_konversi[${fk.material}].bank_to_loose`, `Must be > 0, got ${fk.bank_to_loose}`, 'RANGE_FK'));
    }
    if (fk.bank_to_compacted !== null && fk.bank_to_compacted <= 0) {
      errors.push(err(`faktor_konversi[${fk.material}].bank_to_compacted`, `Must be > 0 or null, got ${fk.bank_to_compacted}`, 'RANGE_FK'));
    }
  }

  const realErrors = errors.filter((e) => e.severity === 'error');
  const warnings = errors.filter((e) => e.severity === 'warning');

  return {
    valid: realErrors.length === 0,
    errors: realErrors,
    warnings,
    checked_at: new Date().toISOString(),
  };
}

function err(path: string, message: string, code: string): ValidationError {
  return { path, message, severity: 'error', code };
}

function warn(path: string, message: string, code: string): ValidationError {
  return { path, message, severity: 'warning', code };
}
