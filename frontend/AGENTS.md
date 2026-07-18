<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Heed deprecation notices.

Do **not** look for `node_modules/next/dist/docs/` — that directory does not exist in this install (verified against Next 16.2.10, which ships only `README.md` and `license.md` as prose). Instead, verify APIs empirically before writing code: read the actual type definitions in `node_modules/next/dist/`, check how this repo's existing pages and components already use an API, and trust a failing `npm run build` over remembered conventions. Two real examples of drift already hit this project: React 19 removed the need for `forwardRef` (ref is a normal prop), and `devIndicators: false` was needed in `next.config.ts` because the dev badge polluted visual baselines.
<!-- END:nextjs-agent-rules -->
