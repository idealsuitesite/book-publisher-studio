import { createApp } from './presentation/app';

// Configurable via PORT so dev, tests, CI, and tooling (npm run verify-server,
// docs/REAL_EXPORT_CHECKLIST.md) all resolve the same port from the same source,
// instead of each guessing or hardcoding a value independently.
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
