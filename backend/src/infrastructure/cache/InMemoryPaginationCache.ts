import type { PaginationCache, PaginationGeometry } from '../../domain/ports/PaginationCache';

/**
 * A bounded, in-memory LRU implementation of `PaginationCache` (MINI_DR_PAGINATION_REUSE §4).
 *
 * Content-hash keys accumulate as a book is edited (each edit is a new book → a new key), so the
 * cache is size-capped and evicts least-recently-used entries. A stale entry for a superseded
 * book edit is never *served* — its hash never recurs — it only occupies a slot until evicted.
 *
 * Backs the whole export path with ONE instance (a server singleton, wired in `app.ts`): the
 * geometry is format-independent by construction (one shared `LayoutEngine`, PDF-metric
 * pagination reused by DOCX/EPUB knowingly), so the key omits format (CTO §7 Q3).
 *
 * Insertion-ordered `Map` gives LRU for free: a `get` hit re-inserts the key to mark it most
 * recently used; `set` evicts from the front (oldest) once over capacity.
 */
export class InMemoryPaginationCache implements PaginationCache {
  private readonly store = new Map<string, PaginationGeometry>();

  /** Default 16 (CTO §7 Q2) — a handful of active projects × a couple of theme/layout combos. */
  constructor(private readonly capacity: number = 16) {
    if (capacity < 1) throw new Error(`PaginationCache capacity must be >= 1, got ${capacity}`);
  }

  get(key: string): PaginationGeometry | undefined {
    const geometry = this.store.get(key);
    if (geometry === undefined) return undefined;
    // Mark most-recently-used: delete then re-insert moves it to the end of the iteration order.
    this.store.delete(key);
    this.store.set(key, geometry);
    return geometry;
  }

  set(key: string, geometry: PaginationGeometry): void {
    // Re-insert so an updated key is also most-recently-used, not left at its old position.
    this.store.delete(key);
    this.store.set(key, geometry);
    while (this.store.size > this.capacity) {
      // The first key in insertion order is the least-recently-used.
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /** Test/diagnostic only: current number of cached entries. */
  get size(): number {
    return this.store.size;
  }
}
