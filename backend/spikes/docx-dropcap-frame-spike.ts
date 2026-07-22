/**
 * Queue item 5, Option A's gating spike (CTO condition, ADR-0019/0020 discipline): does the
 * `docx` 9.7.1 frame API really produce Word's NATIVE drop cap — verified in the real Word,
 * never locked on a type signature? Run:
 *   npx tsx spikes/docx-dropcap-frame-spike.ts
 * then the PowerShell half (real Word COM) measures both outputs.
 *
 * Generates two DOCX files with IDENTICAL text (the overlap investigation's fixture shape —
 * repeated-word paragraphs, each opening with a drop-cap candidate):
 *  - dropcap-inline.docx : the CURRENT strategy (enlarged first run at DROP_CAP_SCALE — Word
 *    grows the line box; measured 3 -> 4 pages on this content class in Word 16.0);
 *  - dropcap-frame.docx  : the PROPOSED strategy (Word-native drop-cap frame: the letter as its
 *    own paragraph carrying framePr dropCap="drop" lines=3, remainder as the next paragraph).
 * Also asserts the emitted XML really carries <w:framePr w:dropCap="drop" w:lines="3"> — the
 * library's half of the proof, independent of Word.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, DropCapType, FrameAnchorType, FrameWrap } from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'output');
mkdirSync(OUT, { recursive: true });

const BODY_PT = 11;
const SCALE = 2.5;
const PARAGRAPHS = 12;
const WORDS = 33; // ~397 words / 12 paragraphs, the overlap fixture's density

const text = () => Array.from({ length: WORDS }, () => 'word').join(' ');

function inlineDoc(): Document {
  // Current strategy: first char enlarged inline (DOCXRenderer's buildRunsWithDropCap shape).
  const paragraphs = Array.from({ length: PARAGRAPHS }, () => {
    const t = `E${text()}`;
    return new Paragraph({
      children: [
        new TextRun({ text: t[0], size: BODY_PT * SCALE * 2, bold: true }), // docx size = half-points
        new TextRun({ text: t.slice(1), size: BODY_PT * 2 }),
      ],
    });
  });
  return new Document({ sections: [{ children: paragraphs }] });
}

function frameDoc(): Document {
  // Proposed strategy: Word-native drop cap — the letter is its OWN paragraph with framePr.
  const paragraphs = Array.from({ length: PARAGRAPHS }, () => [
    new Paragraph({
      frame: {
        // XY variant satisfies the type; Word's own drop caps anchor to text both ways.
        position: { x: 0, y: 0 },
        width: 0,
        height: 0,
        anchor: { horizontal: FrameAnchorType.TEXT, vertical: FrameAnchorType.TEXT },
        dropCap: DropCapType.DROP,
        lines: 3,
        wrap: FrameWrap.AROUND,
      },
      children: [new TextRun({ text: 'E', size: BODY_PT * SCALE * 2, bold: true })],
    }),
    new Paragraph({ children: [new TextRun({ text: text(), size: BODY_PT * 2 })] }),
  ]).flat();
  return new Document({ sections: [{ children: paragraphs }] });
}

/**
 * Finding B APPLIED (the CTO's pre-validation visual condition): the letter sized as Word sizes
 * its own — 129 half-points (64.5pt) for lines=3 over an 11pt body, read from the native file —
 * and the framePr stripped of the type-forced zero attrs to match the native shape exactly.
 * Word 16.0 rendered this file to PDF; rasterised (WinRT Windows.Data.Pdf), the page shows REAL
 * wrapped drop caps — the human-visible proof (`output/dropcap-frame-sized.png`).
 */
function sizedFrameDoc(): Document {
  const paragraphs = Array.from({ length: 4 }, () => [
    new Paragraph({
      frame: {
        type: 'absolute',
        position: { x: 0, y: 0 },
        width: 0,
        height: 0,
        anchor: { horizontal: FrameAnchorType.TEXT, vertical: FrameAnchorType.TEXT },
        dropCap: DropCapType.DROP,
        lines: 3,
        wrap: FrameWrap.AROUND,
      },
      children: [new TextRun({ text: 'E', size: 129, bold: true })], // native Word's own auto-size
    }),
    new Paragraph({ children: [new TextRun({ text: Array.from({ length: 60 }, () => 'word').join(' '), size: BODY_PT * 2 })] }),
  ]).flat();
  return new Document({ sections: [{ children: paragraphs }] });
}

async function stripFrameAttrs(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  let xml = await zip.file('word/document.xml')!.async('string');
  // The library's types FORCE width/height/position; native Word drop caps omit them. Strip to
  // the native shape (the production path will be a custom XmlComponent, not this patch).
  xml = xml.replace(/<w:framePr([^>]*)\/>/g, (_m, attrs: string) => `<w:framePr${attrs.replace(/ w:(w|h|x|y)="0"/g, '')}/>`);
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  const inline = await Packer.toBuffer(inlineDoc());
  const framed = await Packer.toBuffer(frameDoc());
  writeFileSync(join(OUT, 'dropcap-inline.docx'), inline);
  writeFileSync(join(OUT, 'dropcap-frame.docx'), framed);
  writeFileSync(join(OUT, 'dropcap-frame-sized.docx'), await stripFrameAttrs(await Packer.toBuffer(sizedFrameDoc())));

  // The library's half of the proof: the XML really carries Word's drop-cap frame markup.
  const zip = await JSZip.loadAsync(framed);
  const xml = await zip.file('word/document.xml')!.async('string');
  const hasFramePr = /<w:framePr[^>]*w:dropCap="drop"[^>]*\/?>/.test(xml);
  const hasLines = /<w:framePr[^>]*w:lines="3"[^>]*\/?>/.test(xml);
  console.log('emitted XML carries w:framePr w:dropCap="drop":', hasFramePr);
  console.log('emitted XML carries w:lines="3":', hasLines);
  if (hasFramePr) {
    const m = xml.match(/<w:framePr[^>]*>/);
    console.log('first framePr:', m?.[0]);
  }
  console.log(`\nwrote ${OUT}\\dropcap-inline.docx and dropcap-frame.docx — the real-Word half runs next.`);
}

main();
