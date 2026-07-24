import { describe, it, expect } from 'vitest';
import { resolveDatabasePath } from './resolveDatabasePath';

/**
 * STORE_DEFAULT_SAFE (CTO Ruling 1) — the guard that closes the ad-hoc-store class: `createApp()` must
 * never reach the real store `data/studio.db` by omission. These pin that the ONLY way to a real path is
 * an explicit DATABASE_PATH opt-in; every default is the safe in-memory DB.
 */
describe('resolveDatabasePath — the store default is safe', () => {
  it('defaults to :memory: when nothing is set (the class-closing default)', () => {
    expect(resolveDatabasePath({})).toBe(':memory:');
  });

  it('honours an explicit DATABASE_PATH opt-in (the dev/prod entrypoint, or a deliberate script)', () => {
    expect(resolveDatabasePath({ DATABASE_PATH: '/tmp/throwaway.db' })).toBe('/tmp/throwaway.db');
    expect(resolveDatabasePath({ DATABASE_PATH: 'data/studio.db' })).toBe('data/studio.db');
  });

  it('treats an empty DATABASE_PATH as unset (still safe)', () => {
    expect(resolveDatabasePath({ DATABASE_PATH: '' })).toBe(':memory:');
    expect(resolveDatabasePath({ DATABASE_PATH: '   ' })).toBe(':memory:');
  });

  it('never falls through to the real store by omission — in ANY NODE_ENV', () => {
    for (const NODE_ENV of ['test', 'development', 'production', undefined]) {
      const path = resolveDatabasePath({ ...(NODE_ENV ? { NODE_ENV } : {}) });
      // The founder store is reachable only via an explicit path, never a NODE_ENV-driven fallthrough.
      expect(path).toBe(':memory:');
      expect(path).not.toContain('studio.db');
    }
  });
});
