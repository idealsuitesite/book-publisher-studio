/**
 * Chantier A, step 1: WHICH SIGNALS ACTUALLY REACH US?
 *
 * Before asking which heuristic could detect chapters in an unstyled DOCX, establish what the
 * current pipeline even exposes. Mammoth maps Word styles semantically and may discard the rest;
 * a heuristic cannot use a signal that never arrives. Measured on the real corpus, not deduced.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

async function inspect(file: string) {
  const { html } = await new MammothParser().parse(readFileSync(join(CORPUS, file)));
  const tags = [...html.matchAll(/<([a-z0-9]+)(\s[^>]*)?>/gi)];
  const counts: Record<string, number> = {};
  for (const t of tags) counts[t[1].toLowerCase()] = (counts[t[1].toLowerCase()] ?? 0) + 1;

  // What ATTRIBUTES survive? A heuristic needs size/spacing; mammoth may emit none.
  const attrs = new Set<string>();
  for (const t of tags) for (const a of (t[2] ?? '').matchAll(/([a-z-]+)=/gi)) attrs.add(a[1]);

  // Structural signals that DO survive: a paragraph whose entire content is one bold run.
  const paras = [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)].map((m) => m[1]);
  const allBold = paras.filter((p) => /^\s*<strong>.*<\/strong>\s*$/is.test(p));
  const short = paras.filter((p) => p.replace(/<[^>]+>/g, '').trim().split(/\s+/).length <= 8);
  const shortAndBold = allBold.filter((p) => p.replace(/<[^>]+>/g, '').trim().split(/\s+/).length <= 8);

  console.log(`\n=== ${file} ===`);
  console.log(`  tags: ${JSON.stringify(counts)}`);
  console.log(`  surviving attributes: ${attrs.size ? [...attrs].join(',') : 'NONE'}`);
  console.log(`  paragraphs: ${paras.length} | entirely-bold: ${allBold.length} | <=8 words: ${short.length} | BOTH: ${shortAndBold.length}`);
  if (shortAndBold.length) console.log(`  samples: ${shortAndBold.slice(0, 3).map((p) => JSON.stringify(p.replace(/<[^>]+>/g, '').trim().slice(0, 55)))}`);
}

const files = readdirSync(CORPUS).filter((f) => f.endsWith('.docx'));
for (const f of files) await inspect(f);
