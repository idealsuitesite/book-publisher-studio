/**
 * Subtitle style census on the raw corpus DOCX (SUBTITLE_FIELD_SCOPE §1).
 *
 * The question the import path hangs on: do real manuscripts mark their subtitle lines with a
 * REAL Word paragraph style (pStyle "Subtitle" or similar), or do they live as plain paragraphs?
 * Read from the raw OOXML (document.xml pStyle attributes) — the ground truth mammoth reads its
 * style names from — never from formatting inference (the HEURISTIC_STRUCTURE_DETECTION
 * closure). Also prints each styled paragraph's first words so a "Subtitle"-styled line can be
 * matched against the drop-cap case seen in the Novel screenshot loop.
 *
 * Run: npx tsx backend/spikes/subtitle-style-census-spike.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

async function run(): Promise<void> {
  for (const file of readdirSync(CORPUS).filter((f) => f.endsWith('.docx'))) {
    const zip = await JSZip.loadAsync(readFileSync(join(CORPUS, file)));
    const xml = await zip.file('word/document.xml')!.async('string');

    // Every paragraph with an explicit pStyle, with its text head.
    const counts: Record<string, number> = {};
    const samples: Record<string, string[]> = {};
    for (const para of xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
      const style = para.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '(none)';
      counts[style] = (counts[style] ?? 0) + 1;
      if (style !== '(none)') {
        const text = (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join('')
          .slice(0, 60);
        (samples[style] ??= []).push(text);
      }
    }

    console.log(`\n${file}:`);
    for (const [style, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${style}: ${n}`);
    }
    for (const [style, texts] of Object.entries(samples)) {
      if (/subtitle|title/i.test(style)) {
        for (const t of texts.slice(0, 6)) console.log(`    [${style}] ${JSON.stringify(t)}`);
      }
    }
  }
}
void run();
