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
import { Document, Packer, Paragraph, TextRun } from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

function censusOf(xml: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const para of xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? []) {
    const style = para.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '(none)';
    counts[style] = (counts[style] ?? 0) + 1;
  }
  return counts;
}

/**
 * POSITIVE CONTROL (CTO-required, the instrument-liar doctrine): a zero is a comfortable
 * measurement — a spike reading the wrong attribute or namespace returns the same zero. Before
 * "no Subtitle style in the corpus" enters the record as fact, the instrument must prove it can
 * SEE what it claims not to find: a minimal DOCX carrying a real Word `Subtitle` paragraph
 * style (and its French styleId sibling `Sous-titre`), generated in-memory, must be counted.
 */
async function positiveControl(): Promise<boolean> {
  const doc = new Document({
    styles: {
      paragraphStyles: [
        { id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', run: { italics: true } },
        { id: 'Sous-titre', name: 'Sous-titre', basedOn: 'Normal', run: { italics: true } },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun('A real title')] }),
          new Paragraph({ style: 'Subtitle', children: [new TextRun('A real subtitle line')] }),
          new Paragraph({ style: 'Sous-titre', children: [new TextRun('Une vraie ligne de sous-titre')] }),
        ],
      },
    ],
  });
  const bytes = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(bytes);
  const counts = censusOf(await zip.file('word/document.xml')!.async('string'));
  const seen = (counts['Subtitle'] ?? 0) === 1 && (counts['Sous-titre'] ?? 0) === 1;
  console.log(
    seen
      ? 'POSITIVE CONTROL PASSED: the instrument sees Subtitle=1 and Sous-titre=1 in a file known to carry them.'
      : `POSITIVE CONTROL FAILED: expected Subtitle=1 and Sous-titre=1, saw ${JSON.stringify(counts)} — the corpus zero below is NOT trustworthy.`
  );
  return seen;
}

async function run(): Promise<void> {
  const controlOk = await positiveControl();
  if (!controlOk) process.exitCode = 1;

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
