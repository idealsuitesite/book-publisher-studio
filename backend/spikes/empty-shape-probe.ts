import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = [
  'faith-alone-styled.docx',
  'art-of-captivating-list-dense.docx',
  'generated-unstyled-3060w.docx',
  'pm-notes-unstyled-fr.docx',
];

async function main() {
  for (const f of files) {
    const raw = await new MammothParser().parse(readFileSync(join(__dirname, '..', 'verification', 'corpus', f)));
    const b = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: f }));
    let emptyWithSections = 0;
    let trulyEmptyTitled = 0;
    let trulyEmptyUntitled = 0;
    for (const c of b.mainContent) {
      const kids = c.type === 'chapter' ? c.sections : c.subsections;
      if (c.content.length === 0 && (kids?.length ?? 0) > 0) emptyWithSections++;
      if (c.content.length === 0 && (kids?.length ?? 0) === 0) {
        if (c.title) trulyEmptyTitled++;
        else trulyEmptyUntitled++;
      }
    }
    console.log(
      `${f}: top-level=${b.mainContent.length}, empty-with-sections=${emptyWithSections}, truly-empty-titled=${trulyEmptyTitled}, truly-empty-untitled=${trulyEmptyUntitled}`
    );
  }
}
main();
