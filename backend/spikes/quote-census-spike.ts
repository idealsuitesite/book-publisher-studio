/**
 * Quote census spike — the C1 verification gap the CTO refused to approve unmeasured
 * (MINI_DR_C1_QUOTES.md §4): the quote-pricing property test proves the MECHANISM, but nothing
 * proved the CLASS, because it was never established that any REAL corpus manuscript contains
 * quote/scripture blocks at all. A green parity suite on a corpus with zero quotes would mean
 * exactly nothing about quote pagination (ADR-0050: fidelity is proven on real content).
 *
 * Measures, does not assume. Runs every file in verification/corpus/ through the REAL import
 * path (MammothParser -> HtmlNormalizer -> ASTBuilder) and censuses block types per file.
 *
 *   npx tsx spikes/quote-census-spike.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import type { Block, Content } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'verification', 'corpus');

function walkBlocks(contents: Content[], visit: (b: Block) => void): void {
  for (const content of contents) {
    for (const block of content.content) visit(block);
    if (content.type === 'chapter' && content.sections) {
      walkBlocks(content.sections as unknown as Content[], visit);
    } else if (content.type === 'section' && content.subsections) {
      walkBlocks(content.subsections as unknown as Content[], visit);
    }
  }
}

async function census(file: string) {
  const buffer = readFileSync(join(CORPUS_DIR, file));
  const parsed = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(parsed.html);
  const book = new ASTBuilder().build(normalized, { title: file, author: 'census', language: 'en' });

  const counts: Record<string, number> = {};
  const quoteSamples: string[] = [];
  walkBlocks(book.mainContent, (b) => {
    counts[b.type] = (counts[b.type] ?? 0) + 1;
    if ((b.type === 'quote' || b.type === 'scripture') && quoteSamples.length < 3) {
      quoteSamples.push(`${b.type}: "${(b as { text: string }).text.slice(0, 70)}..."`);
    }
  });

  const quotes = (counts['quote'] ?? 0) + (counts['scripture'] ?? 0);
  console.log(`\n=== ${file} ===`);
  console.log(`  blocks: ${JSON.stringify(counts)}`);
  console.log(`  QUOTE/SCRIPTURE TOTAL: ${quotes}`);
  for (const s of quoteSamples) console.log(`    ${s}`);
  return { file, quotes };
}

async function main() {
  const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.docx'));
  const results = [];
  for (const f of files) results.push(await census(f));

  console.log('\n=== VERDICT ===');
  const withQuotes = results.filter((r) => r.quotes > 0);
  for (const r of results) console.log(`  ${r.file}: ${r.quotes} quote/scripture blocks`);
  console.log(
    withQuotes.length > 0
      ? `\nThe corpus DOES exercise the quote path (${withQuotes.length}/${results.length} files).`
      : `\nThe corpus does NOT exercise the quote path at all (0/${results.length} files) — the C1 gap is real.`
  );
}

void main();
