/**
 * Read-only: parse the founder project's stored aggregate and print the book title/author/lang
 * in each version snapshot, to locate WHEN ".ldocx" entered the title. Never writes.
 * Run: npx tsx spikes/founder-aggregate-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';

function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const row = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(FOUNDER_ID) as { aggregate: string };
  const agg = JSON.parse(row.aggregate);
  console.log('aggregate top-level keys:', Object.keys(agg).join(', '));
  console.log('aggregate.name:', agg.name);
  if (agg.book?.metadata) console.log('aggregate.book.metadata:', JSON.stringify(agg.book.metadata));

  const versions = agg.versions ?? [];
  console.log(`\naggregate.versions: ${versions.length}`);
  for (const v of versions) {
    const b = v.book ?? v.snapshot ?? {};
    const chapters = (b.mainContent ?? []).filter((c: { type: string }) => c.type === 'chapter');
    const vkeys = Object.keys(v).filter((k) => k !== 'book' && k !== 'snapshot');
    console.log(`  v#${v.number ?? '?'} [${vkeys.map((k) => `${k}=${String(v[k]).slice(0, 30)}`).join(' ')}]`);
    console.log(`      title="${b.metadata?.title}"  author="${b.metadata?.author}"  lang="${b.metadata?.language}"  chapters=${chapters.length}`);
  }

  // Also inspect the CURRENT book (what the Proof/export would render).
  const cur = agg.book;
  if (cur) {
    const chapters = (cur.mainContent ?? []).filter((c: { type: string }) => c.type === 'chapter');
    console.log(`\ncurrent aggregate.book: title="${cur.metadata?.title}" author="${cur.metadata?.author}" lang="${cur.metadata?.language}" chapters=${chapters.length}`);
    console.log('current frontMatter keys:', Object.keys(cur.frontMatter ?? {}).join(', '));
    if (cur.frontMatter?.titlePage) console.log('  titlePage:', JSON.stringify(cur.frontMatter.titlePage));
    if (cur.frontMatter?.copyrightPage) console.log('  copyrightPage:', JSON.stringify(cur.frontMatter.copyrightPage));
  }
  console.log('\nproject.settings:', JSON.stringify(agg.settings));
  db.close();
}

main();
