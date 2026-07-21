import { describe, it, expect } from 'vitest';
import { InMemoryPaginationCache } from './InMemoryPaginationCache';
import type { PaginationGeometry } from '../../domain/ports/PaginationCache';

const geom = (n: number): PaginationGeometry => ({ pages: [{ number: n, blocks: [`b${n}`] }] });

describe('InMemoryPaginationCache', () => {
  it('returns undefined on a miss and the stored geometry on a hit', () => {
    const cache = new InMemoryPaginationCache();
    expect(cache.get('k')).toBeUndefined();
    cache.set('k', geom(1));
    expect(cache.get('k')).toEqual(geom(1));
  });

  it('overwrites an existing key without growing', () => {
    const cache = new InMemoryPaginationCache();
    cache.set('k', geom(1));
    cache.set('k', geom(2));
    expect(cache.get('k')).toEqual(geom(2));
    expect(cache.size).toBe(1);
  });

  it('evicts the least-recently-used entry once over capacity', () => {
    const cache = new InMemoryPaginationCache(2);
    cache.set('a', geom(1));
    cache.set('b', geom(2));
    cache.set('c', geom(3)); // 'a' is the oldest -> evicted
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toEqual(geom(2));
    expect(cache.get('c')).toEqual(geom(3));
    expect(cache.size).toBe(2);
  });

  it('a get promotes an entry so it is no longer the eviction victim (true LRU, not FIFO)', () => {
    const cache = new InMemoryPaginationCache(2);
    cache.set('a', geom(1));
    cache.set('b', geom(2));
    cache.get('a'); // 'a' is now most-recently-used, 'b' is the oldest
    cache.set('c', geom(3)); // evicts 'b', not 'a'
    expect(cache.get('a')).toEqual(geom(1));
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toEqual(geom(3));
  });

  it('rejects a capacity below 1', () => {
    expect(() => new InMemoryPaginationCache(0)).toThrow(/capacity/);
  });
});
