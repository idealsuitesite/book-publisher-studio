/**
 * Chantier A, step (b2): does the EFFECTIVE font size vary in an unstyled manuscript?
 *
 * Mammoth reports only explicitly-set run properties, so it returns null for every run in our
 * unstyled fixtures. A raw OOXML reader could instead resolve the inheritance chain
 * (docDefaults -> paragraph style -> direct run property) and compute an effective size.
 *
 * This settles whether that would be worth building AT ALL: if the resolved sizes are uniform,
 * the chain yields no signal and an OOXML reader would buy nothing. Measured, not assumed --
 * and deliberately measured BEFORE costing any integration.
 */
import JSZip from 'jszip';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');
const attr = (xml: string, re: RegExp): string | undefined => re.exec(xml)?.[1];

async function analyse(file: string) {
  const zip = await JSZip.loadAsync(readFileSync(join(CORPUS, file)));
  const doc = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const styles = (await zip.file('word/styles.xml')?.async('string')) ?? '';

  // 1. Document default size (half-points).
  const defaults = /<w:docDefaults>[\s\S]*?<\/w:docDefaults>/.exec(styles)?.[0] ?? '';
  const defaultSz = attr(defaults, /<w:sz w:val="(\d+)"/);

  // 2. Per-style sizes.
  const styleSz = new Map<string, string>();
  for (const m of styles.matchAll(/<w:style [^>]*w:styleId="([^"]+)"[\s\S]*?<\/w:style>/g)) {
    const sz = attr(m[0], /<w:sz w:val="(\d+)"/);
    if (sz) styleSz.set(m[1], sz);
  }

  // 3. Effective size per paragraph: direct run sz > paragraph style sz > document default.
  const effective = new Map<string, number>();
  let paragraphs = 0;
  for (const p of doc.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    paragraphs++;
    const direct = attr(p[0], /<w:sz w:val="(\d+)"/);
    const styleId = attr(p[0], /<w:pStyle w:val="([^"]+)"/);
    const size = direct ?? (styleId ? styleSz.get(styleId) : undefined) ?? defaultSz ?? 'none';
    effective.set(size, (effective.get(size) ?? 0) + 1);
  }

  const sorted = [...effective.entries()].sort((a, b) => b[1] - a[1]);
  const distinct = sorted.filter(([k]) => k !== 'none').length;
  console.log(`\n=== ${file} ===`);
  console.log(`  docDefaults size: ${defaultSz ? `${Number(defaultSz) / 2}pt` : 'ABSENT'} | styles carrying a size: ${styleSz.size}`);
  console.log(`  paragraphs: ${paragraphs}`);
  console.log(`  EFFECTIVE sizes: ${sorted.map(([k, v]) => `${k === 'none' ? 'none' : `${Number(k) / 2}pt`}x${v}`).join(', ')}`);
  console.log(`  -> ${distinct <= 1 ? 'UNIFORM: resolving inheritance yields NO signal.' : `${distinct} distinct sizes: a real signal exists.`}`);
}

for (const f of readdirSync(CORPUS).filter((f) => f.endsWith('.docx'))) await analyse(f);
