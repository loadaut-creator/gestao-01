import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Every implemented screen reads its data in the browser, so it can be hosted
// as static HTML without a Node.js process or Cloudflare services.
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)),
  "build", "--webpack",
], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
  env: { ...process.env, HOSTINGER_STATIC_EXPORT: "1", NEXT_TELEMETRY_DISABLED: "1" },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Ship the API with the static export in Pages advanced mode. This also works
// when the dashboard does not automatically discover the root functions folder.
const apiBuild = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
  "pages", "functions", "build", "functions", "--outdir", "out/_worker.js",
  "--compatibility-date", "2026-05-15", "--minify",
], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
  env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: ".sites-runtime/wrangler/logs" },
});
if (apiBuild.error) throw apiBuild.error;
process.exit(apiBuild.status ?? 1);
