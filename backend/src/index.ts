import { join } from 'node:path';
import { createApp } from './presentation/app';

// STORE_DEFAULT_SAFE (CTO Ruling 1): this server entrypoint is the ONE legitimate opener of the real
// store. It opts in EXPLICITLY — setting DATABASE_PATH to `data/studio.db` unless the caller already
// chose a path (e.g. a harness on a throwaway temp DB). createApp() itself defaults to `:memory:`, so a
// spike/debug helper that constructs the app without going through here can never touch the founder
// store by omission. Serving the real store in dev is deliberate and explicit, not a silent fallthrough.
process.env.DATABASE_PATH ??= join(process.cwd(), 'data', 'studio.db');

// Configurable via PORT so dev, tests, CI, and tooling (npm run verify-server,
// docs/REAL_EXPORT_CHECKLIST.md) all resolve the same port from the same source,
// instead of each guessing or hardcoding a value independently.
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
