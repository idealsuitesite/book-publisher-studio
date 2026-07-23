/**
 * STRUCTURE_CLEANUP cadrage — the A2 (editorial-marker) form measurement (read-only). CTO verdict
 * on Constat 3 second point: for editorial markers (INTRODUCTION/CONCLUSION), measure which of the
 * two forms is CLEANLY realizable with the EXISTING machinery, and propose it to the DR with the
 * measurement (a stop the CTO renders on the measured proposal, not in advance):
 *
 *   Form 1 — remove the marker AND rename the following chapter to the editorial name
 *            (e.g. following chapter titled "Introduction").
 *   Form 2 — the chapter KEEPS its real title and RECEIVES the editorial role (setPartRole),
 *            reusing EDITORIAL_CATEGORIES + setPartRole.
 *
 * Uses the REAL frontend classifier (`classifyEditorialTitle`, `EDITORIAL_CATEGORIES`) and applies
 * the EXACT `computeBookFacts` editorial branch (bookFacts.ts:106-119): a part is excluded from the
 * chapter count if it is role-tagged OR title-canonical, but it earns an editorial PANEL ROW only
 * if its TITLE is canonical (`if (category)`). Read-only; measures on the founder book-2 A2 pair.
 * Run: npx tsx spikes/structure-cleanup-a2-form-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { classifyMarker } from '../src/domain/services/structureAssist/structureTaxonomy';
import { classifyEditorialTitle, EDITORIAL_CATEGORIES } from '../../frontend/lib/editorialParts';
import type { Book, Content } from '../src/domain/models/Book';

const BOOK2 = '1784760982271-w4n3yjxxw';

// Mirrors computeBookFacts (bookFacts.ts:106-119) for a single top-level part — the two outcomes
// that matter for A2: is it withheld from the chapter count, and does it earn an editorial panel row?
function factsOutcome(title: string, role: 'front' | 'back' | undefined) {
  const category = classifyEditorialTitle(title);
  const tagged = role;
  const countExcluded = !!(tagged || category);          // withheld from facts.chapters
  const panelRow = category ? `${category.label}/${tagged ?? category.placement}` : '(none)'; // if (category)
  return { countExcluded, panelRow };
}

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK2) as { bytes: Buffer | Uint8Array } | undefined;
  db.close();
  if (!blob) { console.log('book 2 blob not found'); return; }
  const raw = await new MammothParser().parse(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
  const book: Book = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));

  const rows = book.mainContent as Content[];
  // The two A2 editorial markers and the real title that follows each.
  const a2 = rows
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => classifyMarker(c.title ?? '')?.kind === 'editorial');

  console.log('A2 editorial-marker pairs (marker → following real title):\n');
  for (const { c, i } of a2) {
    const marker = c.title ?? '';
    const next = rows[i + 1];
    const realTitle = next?.title ?? '(none)';
    const markerCat = classifyEditorialTitle(marker); // the marker text IS canonical → gives label + placement
    const placement = markerCat?.placement;

    // Form 1: following chapter renamed to the marker's canonical label.
    const form1Title = markerCat?.label ?? marker;
    const f1 = factsOutcome(form1Title, undefined);

    // Form 2: following chapter keeps its real title, tagged with the placement the marker implies.
    const f2 = factsOutcome(realTitle, placement);

    console.log(`── marker "${marker}"  →  real title "${realTitle.slice(0, 34)}" ──`);
    console.log(`  marker canonical lookup: ${markerCat ? `${markerCat.label} (placement ${markerCat.placement})` : 'NONE'}`);
    console.log(`  FORM 1 (rename to "${form1Title}"):  countExcluded=${f1.countExcluded}  editorialPanelRow=${f1.panelRow}`);
    console.log(`  FORM 2 (keep "${realTitle.slice(0, 20)}" + role ${placement}): countExcluded=${f2.countExcluded}  editorialPanelRow=${f2.panelRow}`);
    console.log('');
  }

  console.log('READING:');
  console.log('  Form 1 reuses the TITLE-based machinery end to end — count exclusion AND the Proof');
  console.log('  editorial panel row AND placement, all from the canonical title. Zero new infrastructure.');
  console.log('  Form 2 gets count exclusion + placement (via setPartRole), but NO panel row: the panel');
  console.log('  is title-based (if (category)), so a chapter keeping a non-canonical title is excluded-');
  console.log('  but-UNLABELED — the editorial part never shows as present. Closing that gap needs a NEW');
  console.log('  editorial-category tag on the model (so the panel can label a part whose title is not');
  console.log('  canonical) — new infrastructure, out of a marker-collapse chantier.');
}

main();
