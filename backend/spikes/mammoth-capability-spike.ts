/**
 * Chantier A, step (b): can mammoth expose the signals HTML conversion discards?
 * Measured on the real corpus. Reproduces the three findings in the (b) report.
 */
import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');
const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

// FINDING 1: styleMap cannot express direct formatting - it maps NAMED styles only.
const probe = readFileSync(join(CORPUS, 'pm-notes-unstyled-fr.docx'));
const mapped = await mammoth.convertToHtml({ buffer: probe }, { styleMap: ['p[font-size>14] => h2:fresh'] });
console.log('FINDING 1 - styleMap with a font-size selector:');
for (const m of mapped.messages ?? []) console.log(`  ${m.type}: ${m.message.replace(/\n/g, ' ')}`);

// FINDING 2 + 3: transformDocument DOES expose run.fontSize -- but is it populated?
console.log('\nFINDING 2/3 - run properties reachable via transformDocument:');
for (const file of ['art-of-captivating-list-dense.docx', 'pm-notes-unstyled-fr.docx', 'generated-unstyled-3060w.docx', 'faith-alone-styled.docx']) {
  const buffer = readFileSync(join(CORPUS, file));
  let runs = 0, withSize = 0, bold = 0;
  const sizes = new Map<string, number>();
  await mammoth.convertToHtml({ buffer }, { transformDocument: (doc: Record<string, unknown>) => {
    const walk = (n: Record<string, unknown>): void => {
      if (n.type === 'run') {
        runs++;
        if (n.fontSize != null) { withSize++; sizes.set(String(n.fontSize), (sizes.get(String(n.fontSize)) ?? 0) + 1); }
        if (n.isBold) bold++;
      }
      for (const c of (n.children as Record<string, unknown>[] | undefined) ?? []) walk(c);
    };
    walk(doc);
    return doc;
  }});
  console.log(`  ${file}: runs=${runs} withFontSize=${withSize} bold=${bold} sizes=${JSON.stringify([...sizes.entries()])}`);
}
console.log('\nThe field exists on every file. It is POPULATED only on the already-styled one.');
