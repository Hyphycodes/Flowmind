/** Back-compat shim — the canonical secret scanner now lives in `lib/security/secrets.ts` and is
 *  shared by both export paths (ZIP + GitHub). Kept so existing imports keep working. */
export {
  scanExportFilesForSecrets,
  checkExportSafety,
  assertNoSecretsInExport,
  type SecretFinding,
  type ExportSafetyResult,
} from "@/lib/security/secrets";
