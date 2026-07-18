/**
 * Regenerates the fixture .docx files committed alongside this script.
 *
 * These fixtures are the canonical, permanent inputs for real-export verification
 * (docs/REAL_EXPORT_CHECKLIST.md, docs/DEVELOPMENT_WORKFLOW.md's "Which fixture to use") - not test
 * fixtures for automated tests (those live under src/test-utils/). They exist so
 * every session verifies against the exact same known documents instead of
 * searching backend/uploads/ for whatever happens to be there, or generating a
 * throwaway file that leaves nothing for the next session to reproduce.
 *
 * Not run automatically, not part of the build (outside tsconfig's "include":
 * ["src/**\/*"], same pattern as backend/spikes/*.ts). Run manually only when a
 * fixture genuinely needs to change:
 *
 *   npx tsx verification/generate-fixtures.ts
 */
import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, ImageRun, Packer } from 'docx';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Smallest well-formed PNG (1x1, black pixel + alpha) - real, valid image bytes,
// not a placeholder string, so ImageRun/Mammoth/PDFKit all treat it as a genuine
// embedded image rather than a text fallback.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function writeDocx(filename: string, doc: Document): Promise<void> {
  const buffer = await Packer.toBuffer(doc);
  writeFileSync(join(__dirname, filename), buffer);
  console.log(`Wrote ${filename} (${buffer.length} bytes)`);
}

function heading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2): Paragraph {
  return new Paragraph({ text, heading: level });
}

async function buildTypographyTest(): Promise<void> {
  const doc = new Document({
    sections: [
      {
        children: [
          heading('Chapter One: A Typography Test', HeadingLevel.HEADING_1),
          heading('A Subsection', HeadingLevel.HEADING_2),
          new Paragraph({
            children: [
              new TextRun('This paragraph mixes '),
              new TextRun({ text: 'bold', bold: true }),
              new TextRun(', '),
              new TextRun({ text: 'italic', italics: true }),
              new TextRun(', '),
              new TextRun({ text: 'underlined', underline: {} }),
              new TextRun(', and '),
              new TextRun({ text: 'strikethrough', strike: true }),
              new TextRun(' runs, plus a '),
              new TextRun({ text: 'bold italic combination', bold: true, italics: true }),
              new TextRun(' in one sentence.'),
            ],
          }),
          new Paragraph({
            text: 'A second paragraph with straight "quotes" and it\'s apostrophes, for smart-quote verification.',
          }),
          new Paragraph({ text: 'First bullet item', bullet: { level: 0 } }),
          new Paragraph({ text: 'Second bullet item', bullet: { level: 0 } }),
          new Paragraph({
            children: [
              new TextRun('A third paragraph, long enough to plausibly wrap across more than one estimated line, '),
              new TextRun('used to sanity-check pagination and drop-cap rendering on a realistic paragraph length '),
              new TextRun('rather than a single short sentence that never exercises line-estimate logic at all.'),
            ],
          }),
        ],
      },
    ],
  });
  await writeDocx('typography-test.docx', doc);
}

async function buildLargeBook(): Promise<void> {
  const CHAPTERS = 15;
  const PARAGRAPHS_PER_CHAPTER = 20;
  const children: Paragraph[] = [];
  for (let c = 1; c <= CHAPTERS; c++) {
    children.push(heading(`Chapter ${c}`, HeadingLevel.HEADING_1));
    for (let p = 1; p <= PARAGRAPHS_PER_CHAPTER; p++) {
      children.push(new Paragraph({ text: `Paragraph ${p} of chapter ${c}. `.repeat(8) }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  await writeDocx('large-book.docx', doc);
}

async function buildImages(): Promise<void> {
  const imageBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
  const doc = new Document({
    sections: [
      {
        children: [
          heading('Images Test', HeadingLevel.HEADING_1),
          new Paragraph({
            children: [new ImageRun({ data: imageBuffer, transformation: { width: 100, height: 100 }, type: 'png' })],
          }),
          new Paragraph({ text: 'Caption-style text immediately after the embedded image.' }),
          heading('A Second Image', HeadingLevel.HEADING_2),
          new Paragraph({
            children: [new ImageRun({ data: imageBuffer, transformation: { width: 50, height: 50 }, type: 'png' })],
          }),
        ],
      },
    ],
  });
  await writeDocx('images.docx', doc);
}

async function buildTables(): Promise<void> {
  const row = (cells: string[]): TableRow =>
    new TableRow({ children: cells.map((text) => new TableCell({ children: [new Paragraph({ text })] })) });

  const doc = new Document({
    sections: [
      {
        children: [
          heading('Tables Test', HeadingLevel.HEADING_1),
          new Paragraph({ text: 'A small table:' }),
          new Table({ rows: [row(['Name', 'Role']), row(['Alexandre', 'Author']), row(['Marie', 'Editor'])] }),
          new Paragraph({ text: 'A wider table:' }),
          new Table({
            rows: [
              row(['A', 'B', 'C', 'D']),
              row(['1', '2', '3', '4']),
              row(['5', '6', '7', '8']),
            ],
          }),
        ],
      },
    ],
  });
  await writeDocx('tables.docx', doc);
}

async function main(): Promise<void> {
  await buildTypographyTest();
  await buildLargeBook();
  await buildImages();
  await buildTables();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
