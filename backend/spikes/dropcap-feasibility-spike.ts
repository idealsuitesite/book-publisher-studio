/**
 * Drop-cap feasibility spike (CTO-ordered 2026-07-21, BEFORE any drop-cap Design Review).
 *
 * Same question C1 answered the hard way: is the drop-cap path REACHABLE from a real DOCX
 * import, or is it a declared capability nothing real can trigger? Measures rather than reads.
 *
 *   npx tsx spikes/dropcap-feasibility-spike.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { getTheme } from '../src/domain/themes/getTheme';
import type { Block, Content } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'verification', 'corpus');

function walk(contents: Content[], visit: (b: Block) => void): void {
  for (const c of contents) {
    for (const b of c.content) visit(b);
    if (c.type === 'chapter' && c.sections) walk(c.sections as unknown as Content[], visit);
    else if (c.type === 'section' && c.subsections) walk(c.subsections as unknown as Content[], visit);
  }
}

async function measure(file: string) {
  const raw = await new MammothParser().parse(readFileSync(join(CORPUS_DIR, file)));
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: file });
  const book = new ASTBuilder().build(normalized, { title: file, author: 'x', language: 'en' });

  // 1. Does the IMPORT ever set Block.dropCap?
  let paragraphs = 0;
  let astDropCaps = 0;
  walk(book.mainContent, (b) => {
    if (b.type === 'paragraph') {
      paragraphs += 1;
      if (b.dropCap === true) astDropCaps += 1;
    }
  });

  // 2. Does the RESOLVER ever resolve one to true?
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, getTheme('classic')));
  const resolved = Object.values(typeset.blockTypography ?? {}).filter((t) => t.dropCap).length;

  console.log(`${file}\n  paragraphs: ${paragraphs} | AST dropCap=true: ${astDropCaps} | RESOLVED dropCap=true: ${resolved}`);
  return { file, paragraphs, astDropCaps, resolved };
}

async function main() {
  const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.docx'));
  const rows = [];
  for (const f of files) rows.push(await measure(f));
  const totalP = rows.reduce((s, r) => s + r.paragraphs, 0);
  const totalD = rows.reduce((s, r) => s + r.resolved, 0);
  console.log(`\n=== VERDICT ===\n${totalD} drop caps resolved across ${totalP} real paragraphs in ${rows.length} real manuscripts.`);
  console.log(totalD === 0 ? 'The drop-cap path is UNREACHABLE from a real import.' : 'The drop-cap path IS reachable.');
}

void main();
