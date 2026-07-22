/**
 * Read-only: parse each stored version payload for the founder project and print the book
 * title/author/lang + chapter count, to date when ".ldocx" entered the title. Never writes.
 * Run: npx tsx spikes/founder-version-titles-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';

function findBook(obj: unknown, depth = 0): { metadata?: Record<string, unknown>; mainContent?: unknown[] } | undefined {
  if (!obj || typeof obj !== 'object' || depth > 4) return undefined;
  const o = obj as Record<string, unknown>;
  if (o.metadata && o.mainContent) return o as { metadata: Record<string, unknown>; mainContent: unknown[] };
  for (const v of Object.values(o)) {
    const found = findBook(v, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const versions = db.prepare('SELECT number, payload FROM versions WHERE project_id = ? ORDER BY number').all(FOUNDER_ID) as { number: number; payload: string }[];
  console.log(`${versions.length} version payloads:\n`);
  for (const v of versions) {
    const payload = JSON.parse(v.payload);
    const topKeys = Object.keys(payload).join(',');
    const book = findBook(payload);
    const chapters = (book?.mainContent ?? []).filter((c) => (c as { type?: string }).type === 'chapter');
    console.log(`v#${v.number}  [payload keys: ${topKeys}]`);
    console.log(`    title="${book?.metadata?.title}"  author="${book?.metadata?.author}"  lang="${book?.metadata?.language}"  chapters=${chapters.length}`);
  }
  db.close();
}

main();
