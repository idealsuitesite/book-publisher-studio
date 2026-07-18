import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Next's development indicator badge is rendered into the page in dev mode and was being
   * captured by the Sprint 9 visual baseline as though it were product UI (found at Commit 1:
   * a 29-pixel difference in the bottom-left of one screen turned out to be the badge, not the
   * application). It is dev-only tooling that never ships, so capturing it can only ever
   * produce false regressions. Disabled so the baseline photographs the product and nothing
   * else. No effect on production builds. */
  devIndicators: false,
};

export default nextConfig;
