/** Renders a drop-cap book through the REAL DOCXRenderer (native path) for the Word verification. */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCXRenderer } from '../src/infrastructure/renderers/DOCXRenderer';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { ClassicTheme } from '../src/domain/themes/ClassicTheme';
import { createBook } from '../src/domain/models/Book';
import type { Chapter, Paragraph } from '../src/domain/models/Book';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';
import type { ResolvedTypography } from '../src/domain/models/ResolvedTypography';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const now = new Date();
  const words = Array.from({ length: 60 }, () => 'word').join(' ');
  const paras: Paragraph[] = Array.from({ length: 3 }, (_, i) => ({ type: 'paragraph', id: `p${i}`, text: `E${words}` }));
  const chapter: Chapter = { type: 'chapter', id: 'c1', number: 1, title: 'One', content: paras, createdAt: now, updatedAt: now };
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter]);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  const blockTypography: Record<string, ResolvedTypography> = Object.fromEntries(
    paras.map((p) => [p.id, { runs: [{ text: p.text, bold: false, italic: false, superscript: false, subscript: false, smallCaps: false }], dropCap: true }])
  );
  const paginated: PaginatedBook = {
    styledBook: { ...styled, blockTypography },
    pages: [{ number: 1, blocks: paras.map((p) => p.id) }],
    pageLayout: { pageSize: 'letter', width: 612, height: 792, marginTop: 72, marginBottom: 72, marginLeft: 72, marginRight: 72 },
  };
  const out = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginated, { language: 'en' });
  writeFileSync(join(__dirname, 'output', 'renderer-native-dropcap.docx'), out.output);
  console.log('renderer output written:', out.output.length, 'bytes');
}
main();
