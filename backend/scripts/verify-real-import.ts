/**
 * verify-real-import — the IMPORT-FIDELITY harness (IMPORT_FIDELITY.md commit 5, ADR-0049).
 *
 * Runs every manuscript in backend/verification/corpus/ through the REAL server's import and
 * asserts, per file, what a faithful import of THAT file means: exact chapter count, exact
 * word count, and — the part unit tests cannot own — the EXPECTED FINDINGS. A file that must
 * trigger UNSTRUCTURED_MANUSCRIPT fails the run if it doesn't; a file that must not, fails if
 * it does. The "18 h1 → 17 chapters, empty heading absorbed" discovery is a PERMANENT
 * assertion here by CTO direction, not a note.
 *
 * The corpus (grow it — every real defect earns its file a place here):
 *  - faith-alone-styled.docx     Real EN manuscript, real Heading 1/2 styles, ~40k words,
 *                                and one EMPTY Heading 1 the normalizer must drop LOUDLY.
 *  - pm-notes-unstyled-fr.docx   Real French-Word notes (only `Paragraphedeliste`), headings
 *                                faked with bold runs — zero chapters, but BELOW the word
 *                                threshold: a small single-flow document is legitimate and
 *                                must stay silent (CTO decision Q3).
 *  - generated-unstyled-3060w.docx  Generated stand-in for a BOOK-LENGTH unstyled manuscript
 *                                (no real one in the corpus yet — replace it with a real file
 *                                the day one lands, per docs/REAL_FIXTURE_POLICY.md). This is
 *                                the file that must make UNSTRUCTURED_MANUSCRIPT fire.
 *
 * Requires a running server (Server Verification Policy — never assume the port):
 *   npm run verify-real-import
 *   PORT=5050 npm run verify-real-import
 * Exit 0 = every assertion on every file passed. Exit 1 = at least one failed, printed inline.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const BASE_URL = `http://localhost:${PORT}`;
const CORPUS_DIR = join(__dirname, '..', 'verification', 'corpus');
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface CorpusExpectation {
  file: string;
  /** Exact — a chapter appearing or vanishing is the defect class this harness exists for. */
  chapters: number;
  /** Exact — word-count drift means content was lost or invented at import. */
  words: number;
  /** Issue codes that MUST be present in the report. */
  mustFind: string[];
  /** Issue codes that must NOT be present. */
  mustNotFind: string[];
  /** Substrings that must appear in report.warnings. */
  warningsContain?: string[];
  /** The import must still create a project (ADR-0049: explorable, never rejected). */
  createsProject: boolean;
}

const CORPUS: CorpusExpectation[] = [
  {
    file: 'faith-alone-styled.docx',
    chapters: 17,
    words: 39_913,
    mustFind: ['EMPTY_HEADING_DROPPED'],
    mustNotFind: ['UNSTRUCTURED_MANUSCRIPT'],
    warningsContain: ['empty Heading 1'],
    createsProject: true,
  },
  {
    file: 'pm-notes-unstyled-fr.docx',
    chapters: 0,
    // 1,403, not the pre-fix 1,424: the TABLE_DUPLICATION fix (ADR-0050) stopped a NESTED
    // list's items from being counted twice (once by the parent list's descendant find, once
    // by the inner list emitted separately). This harness caught the change — closing the
    // class, not just the observed table symptom. Ground truth (mammoth, tags stripped) is
    // 1,396; 1,403 is the honest tokenized count, 1,424 was inflated by the duplication.
    words: 1_403,
    mustFind: [],
    mustNotFind: ['UNSTRUCTURED_MANUSCRIPT', 'EMPTY_HEADING_DROPPED'],
    createsProject: true,
  },
  {
    file: 'generated-unstyled-3060w.docx',
    chapters: 0,
    words: 3_060,
    mustFind: ['UNSTRUCTURED_MANUSCRIPT'],
    mustNotFind: [],
    createsProject: true,
  },
  {
    // Second real varied-structure fixture (CTO-authorized 2026-07-21, LIST_PAGINATION_DRIFT.md):
    // a real chapterless, list-dense manuscript (214 lists / 1,067 items, 0 tables).
    // The DIRECT measurement that corrected the PM-notes proxy extrapolation and confirmed the
    // list-dense reconciliation phenomenon on real data. Kept here so the shape stays covered;
    // its pagination behaviour is the ongoing calibration evidence toward the CTO's >=3 trigger.
    // WORD COUNT RE-LOCKED 9_280 -> 9_322 (2026-07-23): the class-wide <br> boundary fix
    // (BR_BOUNDARY_SCOPE.md, collapseLineBreaks in HtmlNormalizer) un-jammed exactly the 42 word
    // pairs this fixture had glued together across <br> line breaks — the file carries exactly 42
    // <br> tags and the count rose by exactly 42, one faithful word recovered per break. 9_322 is
    // the CORRECT post-fix count; 9_280 was the pre-fix jammed count. The <br> merge re-locked the
    // in-suite parity byte-locks but did not re-run this server-only harness, so the stale
    // assertion surfaced at the STRUCTURE_ASSIST post-merge gate (which does not touch import).
    file: 'art-of-captivating-list-dense.docx',
    chapters: 0,
    words: 9_322,
    mustFind: ['UNSTRUCTURED_MANUSCRIPT'],
    mustNotFind: ['EMPTY_HEADING_DROPPED'],
    createsProject: true,
  },
];

interface Failure {
  file: string;
  assertion: string;
  detail: string;
}
const failures: Failure[] = [];

function check(file: string, assertion: string, ok: boolean, detail: string): void {
  if (!ok) failures.push({ file, assertion, detail });
}

interface ImportReport {
  status: string;
  statistics: { chapters: number; words: number };
  warnings: string[];
  issues: Array<{ code: string; severity: string }>;
  score: { overall: number; categories: { structure: number } };
}

async function importFile(name: string): Promise<{ http: number; projectId?: string; report?: ImportReport }> {
  const buf = readFileSync(join(CORPUS_DIR, name));
  const form = new FormData();
  form.append('file', new Blob([buf], { type: DOCX_MIME }), name);
  const res = await fetch(`${BASE_URL}/api/manuscripts/import`, { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as { projectId?: string; report?: ImportReport } | null;
  return { http: res.status, projectId: body?.projectId, report: body?.report };
}

async function main(): Promise<void> {
  // Reachability first, same discipline as verify-real-export.
  try {
    const health = await fetch(`${BASE_URL}/api/health`);
    if (!health.ok) throw new Error(`health ${health.status}`);
  } catch (error) {
    console.error(`Server unreachable at ${BASE_URL} — start it first (npm run dev). ${String(error)}`);
    process.exit(1);
  }

  for (const entry of CORPUS) {
    const { http, projectId, report } = await importFile(entry.file);
    const f = entry.file;

    check(f, 'HTTP 200', http === 200, `got ${http}`);
    if (!report) {
      check(f, 'report present', false, 'no report body');
      continue;
    }
    check(f, "status 'success'", report.status === 'success', `got '${report.status}'`);
    check(
      f,
      `chapters === ${entry.chapters}`,
      report.statistics.chapters === entry.chapters,
      `got ${report.statistics.chapters}`
    );
    check(f, `words === ${entry.words}`, report.statistics.words === entry.words, `got ${report.statistics.words}`);
    check(f, 'creates a project', Boolean(projectId) === entry.createsProject, `projectId: ${String(projectId)}`);

    const codes = new Set(report.issues.map((i) => i.code));
    for (const code of entry.mustFind) {
      check(f, `finding ${code} present`, codes.has(code), `codes: ${[...codes].join(', ')}`);
    }
    for (const code of entry.mustNotFind) {
      check(f, `finding ${code} ABSENT`, !codes.has(code), `codes: ${[...codes].join(', ')}`);
    }
    for (const fragment of entry.warningsContain ?? []) {
      check(
        f,
        `warnings mention "${fragment}"`,
        report.warnings.some((w) => w.includes(fragment)),
        `warnings: ${JSON.stringify(report.warnings)}`
      );
    }

    // Structure-score honesty (ADR-0049): 0 chapters + the unstructured finding can never
    // score 100; a structured book with no structural findings can never score below 100.
    if (entry.mustFind.includes('UNSTRUCTURED_MANUSCRIPT')) {
      check(f, 'structure score < 100', report.score.categories.structure < 100, `got ${report.score.categories.structure}`);
    }

    const state = failures.some((x) => x.file === f) ? 'FAIL' : 'ok';
    console.log(
      `${state === 'ok' ? '✓' : '✗'} ${f} — ${report.statistics.chapters} ch, ${report.statistics.words} words, structure ${report.score.categories.structure}, issues [${[...codes].join(', ')}]`
    );
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} assertion(s) FAILED:`);
    for (const fail of failures) {
      console.error(`  ✗ ${fail.file} — ${fail.assertion}: ${fail.detail}`);
    }
    process.exit(1);
  }
  console.log(`\n✓ verify-real-import: every assertion passed on ${CORPUS.length} real-corpus files.`);
}

void main();
