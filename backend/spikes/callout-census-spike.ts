/**
 * Callout census on the real corpus (queue item 6 scope report, CALLOUTS_SCOPE.md §1).
 *
 * Question, mirroring quote-census-spike.ts (the C1 lesson): does ANY real manuscript carry
 * callout-shaped content the import pipeline can already see? Three visible signals:
 *  1. single-cell (1x1) tables — Word's classic hand-made callout box;
 *  2. shouting-case label paragraphs ("NOTE:", "IMPORTANT:", "WARNING:", "TIP:", "REMEMBER:",
 *     EN/FR) — VISION.md item 7's own example of a callout expressed as plain text;
 *  3. quote blocks (already counted zero by quote-census — re-checked here since the corpus
 *     has grown since).
 * Word-native shading/text-boxes are NOT visible signals: mammoth surfaces neither (measured
 * in HEURISTIC_STRUCTURE_DETECTION), so no count of them is claimed — absence of evidence
 * stated as exactly that.
 *
 * Run: npx tsx backend/spikes/callout-census-spike.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import type { Block, Content } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

const LABEL = /^\s*(NOTE|IMPORTANT|WARNING|ATTENTION|TIP|CAUTION|REMEMBER|KEY POINT|NOTA|REMARQUE|ASTUCE|CONSEIL|À RETENIR|AVERTISSEMENT)\s*[:—-]/i;
const SHOUTING = /^\s*[A-ZÀ-Ü][A-ZÀ-Ü\s]{2,30}[:—]/; // an all-caps lead-in ending in a separator

function* allBlocks(contents: Content[]): Generator<Block> {
  for (const c of contents) {
    yield* c.content;
    if (c.type === 'chapter' && c.sections) for (const s of c.sections) yield* allBlocks([s]);
    if (c.type === 'section' && c.subsections) for (const s of c.subsections) yield* allBlocks([s]);
  }
}

async function run(): Promise<void> {
  const files = readdirSync(CORPUS).filter((f) => f.endsWith('.docx'));
  for (const file of files) {
    const raw = await new MammothParser().parse(readFileSync(join(CORPUS, file)));
    const book = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: file }));

    let paragraphs = 0;
    let oneByOneTables = 0;
    let tables = 0;
    let labelParagraphs = 0;
    let shoutingParagraphs = 0;
    let quotes = 0;
    const samples: string[] = [];

    for (const block of allBlocks(book.mainContent)) {
      if (block.type === 'paragraph') {
        paragraphs += 1;
        if (LABEL.test(block.text)) {
          labelParagraphs += 1;
          if (samples.length < 3) samples.push(block.text.slice(0, 70));
        } else if (SHOUTING.test(block.text)) {
          shoutingParagraphs += 1;
          if (samples.length < 3) samples.push(block.text.slice(0, 70));
        }
      } else if (block.type === 'table') {
        tables += 1;
        if (block.headers.length <= 1 && block.rows.length <= 1) oneByOneTables += 1;
      } else if (block.type === 'quote' || block.type === 'scripture') {
        quotes += 1;
      }
    }

    console.log(
      `${file}: paragraphs=${paragraphs} tables=${tables} (1x1=${oneByOneTables}) ` +
        `labelParas=${labelParagraphs} shoutingParas=${shoutingParagraphs} quote/scripture=${quotes}`
    );
    for (const s of samples) console.log(`   sample: ${JSON.stringify(s)}`);
  }
}
void run();
