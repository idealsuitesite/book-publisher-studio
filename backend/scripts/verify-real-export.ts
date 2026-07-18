/**
 * Real Export Policy (docs/DEVELOPMENT_WORKFLOW.md): mechanical verification only - no visual
 * analysis. This script confirms every permanent fixture in backend/verification/
 * survives a real round trip through the running server (import + export to all
 * 3 formats) with a 200, the right Content-Type, a non-empty/non-trivial body,
 * and no server exception. It does NOT open the generated files or check their
 * content (bold/italic/tables/etc.) - that stays a human step in
 * docs/MERGE_CHECKLIST.md. Generated output is saved under
 * backend/verification/output/ so that human step has something to open without
 * re-running anything.
 *
 * Requires a running server - does not start one itself (Server Verification
 * Policy: never assume the port). Run npm run verify-server first, or just run
 * this directly - it performs the same reachability check before anything else.
 *
 *   npm run verify-real-export
 *   PORT=5050 npm run verify-real-export
 *
 * Exit code 0 = every fixture x operation passed. Exit code 1 = at least one
 * failed; each failure prints fixture, format/operation, HTTP code, error
 * message, and root cause (when available) immediately.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const BASE_URL = `http://localhost:${PORT}`;
const FIXTURES_DIR = join(__dirname, '..', 'verification');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output');

// Sanity floor only, not content validation - real fixture output is tens of KB;
// this just catches a truncated/empty response, not whether the content is right.
const MIN_BYTES = 500;

type ExportFormat = 'docx' | 'pdf' | 'epub';

const EXPORT_CONTENT_TYPE: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
};

interface CheckResult {
  fixture: string;
  operation: string;
  pass: boolean;
  httpCode?: number;
  error?: string;
  rootCause?: string;
}

const results: CheckResult[] = [];

function loadFixtureBlob(path: string): Blob {
  const buf = readFileSync(path);
  return new Blob([buf], { type: EXPORT_CONTENT_TYPE.docx });
}

function extractRootCause(bodyText: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      return String((parsed as { error: unknown }).error);
    }
  } catch {
    // Not JSON - no structured root cause available.
  }
  return undefined;
}

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function runImport(fixtureName: string, filePath: string): Promise<void> {
  const form = new FormData();
  form.append('file', loadFixtureBlob(filePath), fixtureName);

  try {
    const res = await fetch(`${BASE_URL}/api/manuscripts/import`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const contentType = res.headers.get('content-type') ?? '';
    const bodyText = await res.text();

    if (res.status !== 200) {
      results.push({
        fixture: fixtureName,
        operation: 'import',
        pass: false,
        httpCode: res.status,
        error: bodyText.slice(0, 300),
        rootCause: extractRootCause(bodyText),
      });
      return;
    }
    if (!contentType.includes('application/json')) {
      results.push({
        fixture: fixtureName,
        operation: 'import',
        pass: false,
        httpCode: res.status,
        error: `Unexpected Content-Type: ${contentType} (expected application/json)`,
      });
      return;
    }
    if (bodyText.length === 0) {
      results.push({ fixture: fixtureName, operation: 'import', pass: false, httpCode: res.status, error: 'Empty response body' });
      return;
    }
    results.push({ fixture: fixtureName, operation: 'import', pass: true, httpCode: res.status });
  } catch (err) {
    results.push({
      fixture: fixtureName,
      operation: 'import',
      pass: false,
      error: err instanceof Error ? err.message : String(err),
      rootCause: 'Request failed before a response was received (connection error, timeout, or server crash)',
    });
  }
}

async function runExport(fixtureName: string, filePath: string, format: ExportFormat): Promise<void> {
  const operation = `export-${format}`;
  const form = new FormData();
  form.append('file', loadFixtureBlob(filePath), fixtureName);
  form.append('theme', 'classic');
  form.append('format', format);

  try {
    const res = await fetch(`${BASE_URL}/api/manuscripts/export`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const contentType = res.headers.get('content-type') ?? '';

    if (res.status !== 200) {
      const bodyText = await res.text();
      results.push({
        fixture: fixtureName,
        operation,
        pass: false,
        httpCode: res.status,
        error: bodyText.slice(0, 300),
        rootCause: extractRootCause(bodyText),
      });
      return;
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    if (!contentType.includes(EXPORT_CONTENT_TYPE[format])) {
      results.push({
        fixture: fixtureName,
        operation,
        pass: false,
        httpCode: res.status,
        error: `Unexpected Content-Type: ${contentType} (expected ${EXPORT_CONTENT_TYPE[format]})`,
      });
      return;
    }
    if (buffer.length === 0) {
      results.push({ fixture: fixtureName, operation, pass: false, httpCode: res.status, error: 'Empty response body' });
      return;
    }
    if (buffer.length < MIN_BYTES) {
      results.push({
        fixture: fixtureName,
        operation,
        pass: false,
        httpCode: res.status,
        error: `Suspiciously small output: ${buffer.length} bytes (< ${MIN_BYTES} byte floor)`,
      });
      return;
    }

    const outDir = join(OUTPUT_DIR, basename(fixtureName, '.docx'));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `export.${format}`), buffer);

    results.push({ fixture: fixtureName, operation, pass: true, httpCode: res.status });
  } catch (err) {
    results.push({
      fixture: fixtureName,
      operation,
      pass: false,
      error: err instanceof Error ? err.message : String(err),
      rootCause: 'Request failed before a response was received (connection error, timeout, or server crash)',
    });
  }
}

async function main(): Promise<void> {
  console.log(`Checking server at ${BASE_URL}\n`);
  if (!(await checkHealth())) {
    console.error(`✗ Server not reachable at ${BASE_URL}/api/health`);
    console.error('  Run npm run verify-server first, or npm run dev in another terminal.');
    process.exitCode = 1;
    return;
  }
  console.log('✓ Server reachable\n');

  const fixtures = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.docx'));
  if (fixtures.length === 0) {
    console.error(`✗ No .docx fixtures found in ${FIXTURES_DIR}`);
    process.exitCode = 1;
    return;
  }

  for (const fixture of fixtures) {
    const filePath = join(FIXTURES_DIR, fixture);
    console.log(`Running ${fixture}...`);
    await runImport(fixture, filePath);
    await runExport(fixture, filePath, 'docx');
    await runExport(fixture, filePath, 'pdf');
    await runExport(fixture, filePath, 'epub');
  }

  console.log('\n' + 'Fixture'.padEnd(24) + 'Operation'.padEnd(14) + 'Result');
  console.log('-'.repeat(48));
  for (const r of results) {
    console.log(r.fixture.padEnd(24) + r.operation.padEnd(14) + (r.pass ? 'PASS' : 'FAIL'));
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

  if (failed.length > 0) {
    console.log('\nFailures:\n');
    for (const f of failed) {
      console.log(`Fixture:          ${f.fixture}`);
      console.log(`Format/Operation: ${f.operation}`);
      console.log(`HTTP:             ${f.httpCode ?? 'N/A (no response received)'}`);
      console.log(`Error:            ${f.error ?? '(none captured)'}`);
      console.log(`Root cause:       ${f.rootCause ?? '(not available)'}`);
      console.log('');
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nOutput saved to ${OUTPUT_DIR} for manual visual verification (docs/MERGE_CHECKLIST.md).`);
}

main();
