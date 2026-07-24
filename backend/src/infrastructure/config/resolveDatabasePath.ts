/**
 * STORE_DEFAULT_SAFE (CTO Ruling 1, 2026-07-24) — the guard that closes the ad-hoc-store class.
 *
 * The project store (`data/studio.db`) holds the founder's real books. Before this guard, `createApp()`
 * fell through to that path whenever `DATABASE_PATH` was unset and `NODE_ENV !== 'test'` — so ANY spike
 * or debug helper that constructed the app via `npx tsx` (neither var set) silently opened the REAL
 * store and could leave a trace in his library (exactly the INCREMENTAL_RENDER P1 `region`-project
 * incident). The class is now closed at the SOURCE, not by convention:
 *
 *   - The SAFE default is `:memory:`. A helper that constructs the app without an explicit choice gets an
 *     in-memory DB and can NEVER touch the founder store by omission.
 *   - The REAL store is reached only by an EXPLICIT opt-in: `DATABASE_PATH` set to the path. The live
 *     dev/production server sets it in `src/index.ts` (the one legitimate opener); a script that truly
 *     wants a specific store sets it too — deliberate, never accidental.
 *
 * Pure and env-injectable so the guarantee is unit-tested rather than trusted.
 */
export function resolveDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  // The deliberate opt-in wins: an explicit, non-empty DATABASE_PATH is honoured as given.
  if (env.DATABASE_PATH && env.DATABASE_PATH.trim() !== '') return env.DATABASE_PATH;
  // No explicit choice ⇒ SAFE default. Never the real store by omission (in any NODE_ENV).
  return ':memory:';
}
