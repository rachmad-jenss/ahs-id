import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export {
  assertKnownStrategy,
  calculationPackages,
  findPackage,
  hsdPackages,
  loadResolvedHsdForBundle,
  packageNames,
  PACKAGES,
  type BundleStrategy,
  type PackageRecord,
} from '@ahs-id/engine-registry';

/** Data directory of an installed workspace package, independent of process.cwd(). */
export function installedDataDir(specifier: string): string {
  const entry = fileURLToPath(import.meta.resolve(specifier));
  return join(dirname(entry), '..', 'data');
}
