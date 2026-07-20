/**
 * Chantier A, step (c): do `alignment` and `isAllCaps` tighten the candidate rule enough?
 *
 * CTO threshold, fixed BEFORE this measurement so the bar cannot move to fit the result:
 * under 5% false positives across the unstyled corpus = usable AS A SUGGESTION, never as
 * silent truth. Above = reliable heuristic detection is out of reach with this material.
 *
 * Method note: a false-positive RATE needs ground truth, and only faith-alone has it (its real
 * h1/h2 styling). So precision/recall are computed there, treating its own styles as labels,
 * and the unstyled files are reported by VOLUME against a plausible chapter count.
 */
import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');
const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

interface Para { text: string; words: number; bold: boolean; caps: boolean; centered: boolean; styleName?: string }

async function paragraphsOf(file: string): Promise<Para[]> {
  const out: Para[] = [];
  await mammoth.convertToHtml({ buffer: readFileSync(join(CORPUS, file)) }, {
    transformDocument: (doc: Record<string, unknown>) => {
      const walk = (n: Record<string, unknown>): void => {
        if (n.type === 'paragraph') {
          const runs: Record<string, unknown>[] = [];
          const collect = (x: Record<string, unknown>): void => {
            if (x.type === 'run') runs.push(x);
            for (const c of (x.children as Record<string, unknown>[] | undefined) ?? []) collect(c);
          };
          collect(n);
          const text = runs.map((r) => {
            let t = '';
            const g = (y: Record<string, unknown>): void => { if (y.type === 'text') t += String(y.value ?? ''); for (const c of (y.children as Record<string, unknown>[] | undefined) ?? []) g(c); };
            g(r); return t;
          }).join('');
          if (text.trim()) out.push({
            text: text.trim(),
            words: text.trim().split(/\s+/).length,
            bold: runs.length > 0 && runs.every((r) => r.isBold === true),
            caps: runs.length > 0 && runs.every((r) => r.isAllCaps === true),
            centered: n.alignment === 'center',
            styleName: n.styleName as string | undefined,
          });
        }
        for (const c of (n.children as Record<string, unknown>[] | undefined) ?? []) walk(c);
      };
      walk(doc); return doc;
    },
  });
  return out;
}

const RULES: Array<{ name: string; test: (p: Para) => boolean }> = [
  { name: 'bold + <=8 words', test: (p) => p.bold && p.words <= 8 },
  { name: '+ centered', test: (p) => p.bold && p.words <= 8 && p.centered },
  { name: '+ allCaps', test: (p) => p.bold && p.words <= 8 && p.caps },
  { name: 'centered alone', test: (p) => p.centered && p.words <= 8 },
];

for (const file of ['art-of-captivating-list-dense.docx', 'pm-notes-unstyled-fr.docx', 'generated-unstyled-3060w.docx', 'faith-alone-styled.docx']) {
  const paras = await paragraphsOf(file);
  const truth = paras.filter((p) => /^heading\s*1$/i.test(p.styleName ?? ''));
  console.log(`\n=== ${file} === (${paras.length} paragraphs, ground-truth H1: ${truth.length || 'none'})`);
  for (const rule of RULES) {
    const hits = paras.filter(rule.test);
    if (truth.length) {
      const tp = hits.filter((h) => truth.includes(h)).length;
      const precision = hits.length ? (tp / hits.length) * 100 : 0;
      const recall = (tp / truth.length) * 100;
      console.log(`  ${rule.name.padEnd(18)}: ${String(hits.length).padStart(4)} hits | precision ${precision.toFixed(1)}% | recall ${recall.toFixed(1)}%`);
    } else {
      console.log(`  ${rule.name.padEnd(18)}: ${String(hits.length).padStart(4)} hits (${((hits.length / paras.length) * 100).toFixed(1)}% of paragraphs)`);
    }
  }
}
