import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteProjectRepository } from './SqliteProjectRepository';
import { describeProjectRepositoryContract } from '../../test-utils/projectRepositoryContract';
import { ProjectService } from '../../domain/services/ProjectService';
import { createBook } from '../../domain/models/Book';

// The same behavioural contract the in-memory implementation passes (PERSISTENCE.md §6).
describeProjectRepositoryContract('SqliteProjectRepository', () => new SqliteProjectRepository(':memory:'));

// What only a DURABLE store must additionally prove.
describe('SqliteProjectRepository — durability', () => {
  const settings = { layoutName: 'kdp-6x9', themeName: 'classic' };

  it('a project saved by one instance is read by a FRESH instance on the same file — restart survival', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bps-sqlite-'));
    const path = join(dir, 'studio.db');
    try {
      const service = new ProjectService(() => 'id-1');
      let project = service.create(
        createBook({ title: 'Le Guide de Jean', author: 'Jean', language: 'fr' }),
        settings
      );
      project = service.attachSource(
        project,
        'guide.docx',
        'application/octet-stream',
        Buffer.from('the retained source survives too')
      );
      project = service.snapshot(project, 'avant redémarrage');

      const first = new SqliteProjectRepository(path);
      await first.save(project);
      first.close(); // the "restart": the process that wrote is gone

      const second = new SqliteProjectRepository(path);
      const loaded = await second.findById('id-1');
      second.close();

      expect(loaded?.name).toBe('Le Guide de Jean');
      expect(loaded?.versions[0].label).toBe('avant redémarrage');
      const source = loaded?.assets.find((a) => a.id === loaded.sourceAssetId);
      expect(source?.data?.toString()).toBe('the retained source survives too');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('opening an already-migrated database is a no-op, not a re-create', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bps-sqlite-'));
    const path = join(dir, 'studio.db');
    try {
      new SqliteProjectRepository(path).close();
      // Second open must find user_version already set and touch nothing.
      const again = new SqliteProjectRepository(path);
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('version payloads live in their own rows, not in the aggregate column (PERSISTENCE §3)', async () => {
    const repo = new SqliteProjectRepository(':memory:');
    const service = new ProjectService(() => 'id-1');
    let project = service.create(
      createBook({ title: 'Sharded', author: 'A', language: 'en' }),
      settings
    );
    project = service.snapshot(project, 'v1');
    await repo.save(project);

    // Reach past the port on purpose: this asserts STORAGE SHAPE, which the contract suite
    // deliberately cannot see.
    const db = (repo as unknown as { db: { prepare(sql: string): { get(...a: unknown[]): unknown } } }).db;
    const row = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get('id-1') as { aggregate: string };
    expect(JSON.parse(row.aggregate).versions).toEqual([]);
    const versionRow = db.prepare('SELECT number FROM versions WHERE project_id = ?').get('id-1') as {
      number: number;
    };
    expect(versionRow.number).toBe(1);
  });
});
