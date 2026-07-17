/**
 * Server Verification Policy (docs/CLAUDE.md): never assume the backend port.
 * This script reads the same PORT resolution src/index.ts uses (env var, 5000
 * fallback), then actually checks the running server against it - it does not
 * start the server itself. Run `npm run dev` first, in a separate terminal.
 *
 *   npm run verify-server
 *   PORT=5050 npm run verify-server   (if the server was started on a different port)
 *
 * Exit code 0 = all checks passed, ready for real-export verification.
 * Exit code 1 = something failed; the specific check that failed is printed.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const BASE_URL = `http://localhost:${PORT}`;
const CANONICAL_FIXTURE = join(__dirname, '..', 'verification', 'typography-test.docx');

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

// A 400 "No file uploaded" proves the route is registered and reachable (it ran
// multer + the controller's file check); a connection failure or 404 means it
// isn't. This does not perform a real export - see docs/REAL_EXPORT_CHECKLIST.md
// for that.
async function checkExportRouteWired(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/manuscripts/export`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    });
    return res.status === 400;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`Checking server at ${BASE_URL}\n`);

  if (!(await checkHealth())) {
    console.error(`✗ Server not reachable at ${BASE_URL}/api/health`);
    console.error('  Start it first: npm run dev');
    console.error('  If it is running on a different port, set PORT to match: PORT=xxxx npm run verify-server');
    process.exitCode = 1;
    return;
  }
  console.log('✓ Server running');
  console.log(`Port: ${PORT}`);
  console.log('✓ GET /api/health');

  if (!(await checkExportRouteWired())) {
    console.error('✗ POST /api/manuscripts/export did not respond as expected (expected 400 "No file uploaded")');
    process.exitCode = 1;
    return;
  }
  console.log('✓ POST /api/manuscripts/export');

  if (!existsSync(CANONICAL_FIXTURE)) {
    console.error(`✗ Canonical fixture missing: ${CANONICAL_FIXTURE}`);
    console.error('  Stop and ask before generating or substituting a different file (docs/CLAUDE.md Real Export Policy).');
    process.exitCode = 1;
    return;
  }
  console.log('✓ Real DOCX found');

  console.log('\nReady for Real Export Verification');
}

main();
