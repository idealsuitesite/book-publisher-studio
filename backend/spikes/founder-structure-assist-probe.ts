/**
 * FOUNDER_TRAVERSAL lot 2 — STRUCTURE_ASSIST cadrage, measure only. Read-only on the founder's
 * stored source bytes. Measures, on a real style-less manuscript:
 *   1. Do Word heading styles survive at all? (mammoth h1-h6 in HTML + paragraph styleName +
 *      run fontSize/isBold via transformDocument) — the HEURISTIC_STRUCTURE_DETECTION mechanism,
 *      re-verified against THIS real text.
 *   2. What SUGGESTION signals exist in the text (short standalone lines, ALL-CAPS, keyword
 *      patterns FOREWORD/INTRODUCTION/Chapter N/Part N, sentence-case single lines)?
 *   3. Ground truth = the founder's OWN chapter titles (from his stored aggregate). For each,
 *      does it appear as a distinguishable line a suggester could have surfaced? Crude
 *      precision/recall of a naive keyword+short-line suggester against his boundaries.
 * Run: npx tsx spikes/founder-structure-assist-probe.ts
 */
import { createRequire } from 'module';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

const FOUNDER_ID = '1784744671298-h9o6o9tn2';
const KEYWORDS = /^\s*(foreword|preface|introduction|prologue|chapter\b|part\b|section\b|conclusion|epilogue|afterword|appendix|acknowledg|bibliography|contents|dedication|next step)/i;

function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const agg = JSON.parse((db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(FOUNDER_ID) as { aggregate: string }).aggregate);
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(FOUNDER_ID) as { bytes: Buffer | Uint8Array };
  const buffer = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);
  db.close();

  // Ground truth: the founder's own chapter/section titles.
  const groundTruth: string[] = [];
  const collect = (c: { type: string; title?: string; content?: unknown[]; sections?: unknown[] }) => {
    if (c.title) groundTruth.push(c.title);
    (c.sections as typeof groundTruth extends never ? never : { type: string; title?: string }[] | undefined ?? []).forEach((s) => collect(s as never));
  };
  for (const c of agg.book.mainContent) collect(c);
  console.log(`GROUND TRUTH — the founder's ${groundTruth.length} chosen titles:`);
  groundTruth.forEach((t) => console.log(`  • "${t.slice(0, 80)}"`));

  void (async () => {
    // 1. Heading survival — the closure's mechanism on THIS file.
    let runs = 0, withSize = 0, bold = 0, allCapsRuns = 0;
    const styleNames = new Map<string, number>();
    await mammoth.convertToHtml({ buffer }, { transformDocument: (doc: Record<string, unknown>) => {
      const walk = (n: Record<string, unknown>): void => {
        if (n.type === 'paragraph') {
          const sn = (n.styleName ?? n.styleId) as string | undefined;
          if (sn) styleNames.set(String(sn), (styleNames.get(String(sn)) ?? 0) + 1);
        }
        if (n.type === 'run') {
          runs++;
          if (n.fontSize != null) withSize++;
          if (n.isBold) bold++;
          if (n.isAllCaps) allCapsRuns++;
        }
        for (const c of (n.children as Record<string, unknown>[] | undefined) ?? []) walk(c);
      };
      walk(doc);
      return doc;
    }});
    const html: string = (await mammoth.convertToHtml({ buffer })).value;
    const headingTags = (html.match(/<h[1-6]/g) ?? []).length;

    console.log(`\n1. HEADING SURVIVAL (HEURISTIC_STRUCTURE_DETECTION mechanism, re-measured on the founder file):`);
    console.log(`   HTML <h1-6> elements: ${headingTags}`);
    console.log(`   paragraph styleNames seen: ${JSON.stringify([...styleNames.entries()])}`);
    console.log(`   runs=${runs} withFontSize=${withSize} bold=${bold} allCaps=${allCapsRuns}`);

    // 2. Suggestion signals from the text.
    const paras = html.split(/<\/?p>/).map((s) => s.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim()).filter(Boolean);
    const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
    const shortLines = paras.filter((p) => words(p) > 0 && words(p) <= 8);
    const allCapsLines = paras.filter((p) => p.length > 2 && p === p.toUpperCase() && /[A-Z]/.test(p));
    const keywordLines = paras.filter((p) => KEYWORDS.test(p));
    console.log(`\n2. SUGGESTION SIGNALS in the extracted text (${paras.length} paragraphs):`);
    console.log(`   short lines (<=8 words): ${shortLines.length}`);
    console.log(`   ALL-CAPS lines: ${allCapsLines.length}  e.g. ${JSON.stringify(allCapsLines.slice(0, 5).map((s) => s.slice(0, 40)))}`);
    console.log(`   keyword-matching lines: ${keywordLines.length}  e.g. ${JSON.stringify(keywordLines.slice(0, 8).map((s) => s.slice(0, 40)))}`);

    // 3. Crude precision/recall of a naive suggester (keyword OR short-line) vs the founder's titles.
    const candidates = new Set([...shortLines, ...keywordLines, ...allCapsLines].map((s) => s.toLowerCase().trim()));
    const gtNorm = groundTruth.map((t) => t.toLowerCase().trim());
    // A ground-truth title is "recovered" if it matches a candidate line, OR its first ~8 words do.
    const recovered = gtNorm.filter((t) => {
      const head = t.split(/\s+/).slice(0, 8).join(' ');
      return [...candidates].some((c) => c === t || c.startsWith(head) || t.startsWith(c));
    });
    console.log(`\n3. NAIVE SUGGESTER vs the founder's ground truth:`);
    console.log(`   candidate lines proposed: ${candidates.size}`);
    console.log(`   ground-truth titles recovered: ${recovered.length}/${groundTruth.length}`);
    console.log(`   → recall ≈ ${(recovered.length / Math.max(1, groundTruth.length) * 100).toFixed(0)}%,  ` +
      `precision ≈ ${(recovered.length / Math.max(1, candidates.size) * 100).toFixed(1)}% (candidates that are real titles)`);
    console.log(`   recovered: ${JSON.stringify(recovered.map((t) => t.slice(0, 50)))}`);
    console.log(`   MISSED: ${JSON.stringify(gtNorm.filter((t) => !recovered.includes(t)).map((t) => t.slice(0, 50)))}`);
  })();
}

main();
