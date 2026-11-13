export type PackageDataMode = 'schema' | 'syntax';

export interface PackageDataFileResult {
  readonly file: string;
  readonly status: 'ok' | 'fail' | 'skip';
  readonly message: string;
}

export interface PackageDataReport {
  readonly valid: boolean;
  readonly files: readonly PackageDataFileResult[];
}
