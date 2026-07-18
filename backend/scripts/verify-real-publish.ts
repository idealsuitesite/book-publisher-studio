/**
 * Real Fixture Policy (docs/REAL_FIXTURE_POLICY.md, which names "any future Publishing Engine
 * work" as in-scope): mechanical verification only - no visual analysis. This script confirms
 * every permanent fixture in backend/verification/ survives a real round trip through the
 * running server's POST /api/manuscripts/publish with a 200, a real JSON PublishingResponseDTO
 * of the right shape, and no server exception.
 *
 * Deliberately does NOT assert PASS: a real DOCX import cannot populate BookMetadata.isbn today
 * (ASTBuilder has no DOCX-native signal for it - the same confirmed gap Sprint 5 disclosed and
 * PUBLISHING_ENGINE.md §6 Risk 4 records), so every real fixture is expected to report a real
 * FAIL on MISSING_REQUIRED_METADATA. This script verifies the report is REAL and well-formed,
 * not that it is green - a green result here would actually indicate a bug.
 *
 * Sibling of verify-real-export.ts, same structure and same reachability discipline (Server
 * Verification Policy: never assume the port).
 *
 *   npm run verify-real-publish
 *   PORT=5050 npm run verify-real-publish
 *
 * Exit code 0 = every fixture produced a real, well-formed report. Exit code 1 = at least one
 * failed; each failure prints fixture, HTTP code, error message, and root cause.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const BASE_URL = `http://localhost:${PORT}`;
const FIXTURES_DIR = join(__dirname, '..', 'verification');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface CheckResult {
  fixture: string;
  operation: string;
  pass: boolean;
  httpCode?: number;
  error?: string;
  rootCause?: string;
  detail?: string;
}

const results: CheckResult[] = [];

function loadFixtureBlob(path: string): Blob {
  return new Blob([readFileSync(path)], { type: DOCX_MIME });
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

// Shape check against the real PublishingResponseDTO contract (packages/shared-types).
// Returns the first structural problem found, or undefined if the shape is fully valid.
function findShapeProblem(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return 'Response body is not a JSON object';
  const r = body as Record<string, unknown>;

  if (r.target !== 'kdp') return `target is ${JSON.stringify(r.target)} (expected "kdp")`;
  if (r.status !== 'PASS' && r.status !== 'FAIL') return `status is ${JSON.stringify(r.status)} (expected PASS or FAIL)`;
  if (typeof r.summary !== 'string' || r.summary.length === 0) return 'summary is missing or empty';
  if (!Array.isArray(r.issues)) return 'issues is not an array';
  if (!Array.isArray(r.warnings)) return 'warnings is not an array';
  if (!Array.isArray(r.artifacts)) return 'artifacts is not an array';
  if (typeof r.duration !== 'number' || !Number.isFinite(r.duration)) return 'duration is not a finite number';
  if (typeof r.generatedAt !== 'string' || Number.isNaN(Date.parse(r.generatedAt))) {
    return `generatedAt is not a parseable ISO string: ${JSON.stringify(r.generatedAt)}`;
  }

  // The engine really ran: a PDF was rendered and handed to KDPTarget (Commit 5's pipeline).
  if (!(r.artifacts as unknown[]).includes('pdf')) {
    return `artifacts does not include "pdf": ${JSON.stringify(r.artifacts)} - the render step may not have run`;
  }

  // Every issue must itself be well-formed - a real finding, not a placeholder.
  for (const [i, issue] of (r.issues as unknown[]).entries()) {
    if (!issue || typeof issue !== 'object') return `issues[${i}] is not an object`;
    const it = issue as Record<string, unknown>;
    if (typeof it.code !== 'string' || it.code.length === 0) return `issues[${i}].code is missing or empty`;
    if (typeof it.message !== 'string' || it.message.length === 0) return `issues[${i}].message is missing or empty`;
    if (it.severity !== 'ERROR' && it.severity !== 'WARNING') {
      return `issues[${i}].severity is ${JSON.stringify(it.severity)} (expected ERROR or WARNING)`;
    }
  }

  return undefined;
}

async function runPublish(fixtureName: string, filePath: string): Promise<void> {
  const form = new FormData();
  form.append('file', loadFixtureBlob(filePath), fixtureName);
  form.append('theme', 'classic');
  form.append('target', 'kdp');

  try {
    const res = await fetch(`${BASE_URL}/api/manuscripts/publish`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    const contentType = res.headers.get('content-type') ?? '';
    const bodyText = await res.text();

    if (res.status !== 200) {
      results.push({
        fixture: fixtureName,
        operation: 'publish-kdp',
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
        operation: 'publish-kdp',
        pass: false,
        httpCode: res.status,
        error: `Unexpected Content-Type: ${contentType} (expected application/json)`,
      });
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      results.push({
        fixture: fixtureName,
        operation: 'publish-kdp',
        pass: false,
        httpCode: res.status,
        error: `Response body is not valid JSON: ${bodyText.slice(0, 200)}`,
      });
      return;
    }

    const shapeProblem = findShapeProblem(body);
    if (shapeProblem) {
      results.push({
        fixture: fixtureName,
        operation: 'publish-kdp',
        pass: false,
        httpCode: res.status,
        error: shapeProblem,
        rootCause: 'Response did not match the PublishingResponseDTO contract (packages/shared-types)',
      });
      return;
    }

    const report = body as { status: string; issues: { code: string }[]; warnings: string[] };

    const outDir = join(OUTPUT_DIR, basename(fixtureName, '.docx'));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'publish-kdp.json'), JSON.stringify(body, null, 2));

    results.push({
      fixture: fixtureName,
      operation: 'publish-kdp',
      pass: true,
      httpCode: res.status,
      detail: `${report.status} - ${report.issues.length} issue(s), ${report.warnings.length} warning(s): ${
        report.issues.map((i) => i.code).join(', ') || 'none'
      }`,
    });
  } catch (err) {
    results.push({
      fixture: fixtureName,
      operation: 'publish-kdp',
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
    console.log(`Running ${fixture}...`);
    await runPublish(fixture, join(FIXTURES_DIR, fixture));
  }

  console.log('\n' + 'Fixture'.padEnd(24) + 'Operation'.padEnd(14) + 'Result');
  console.log('-'.repeat(48));
  for (const r of results) {
    console.log(r.fixture.padEnd(24) + r.operation.padEnd(14) + (r.pass ? 'PASS' : 'FAIL'));
  }

  console.log('\nReal findings per fixture (a FAIL status here is EXPECTED - see header):');
  for (const r of results.filter((x) => x.pass)) {
    console.log(`  ${r.fixture.padEnd(24)}${r.detail ?? ''}`);
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

  console.log(`\nReports saved to ${OUTPUT_DIR}/<fixture>/publish-kdp.json for inspection.`);
}

main();
