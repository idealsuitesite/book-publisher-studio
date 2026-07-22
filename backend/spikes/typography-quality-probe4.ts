/**
 * Census of EMPTY (blockless) sections in the real corpus — the "blockless-titled section
 * shape" named as a Part-chantier deferral. Does the renderer draw titles the model never
 * charged? Run: npx tsx spikes/typography-quality-probe4.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import type { Section } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, '..', 'verification', 'corpus');
const FILES = [
  'faith-alone-styled.docx',
  'art-of-captivating-list-dense.docx',
  'generated-unstyled-3060w.docx',
  'pm-notes-unstyled-fr.docx',
];

async function main() {
  for (const file of FILES) {
    const raw = await new MammothParser().parse(readFileSync(join(CORPUS_DIR, file)));
    const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: file }));
    let empty = 0;
    let total = 0;
    const walk = (s: Section): void => {
      total += 1;
      if (s.content.length === 0) {
        empty += 1;
        console.log(`  EMPTY section: "${s.title.slice(0, 60)}" L${s.level} subsections=${s.subsections?.length ?? 0}`);
      }
      (s.subsections ?? []).forEach(walk);
    };
    for (const c of built.mainContent) {
      if (c.type === 'chapter') {
        (c.sections ?? []).forEach(walk);
        if (c.content.length === 0 && !c.partOpener) console.log(`  EMPTY chapter: "${c.title}"`);
      } else {
        walk(c as Section);
      }
    }
    console.log(`${file}: sections ${total}, EMPTY ${empty}\n`);
  }
}

main();
