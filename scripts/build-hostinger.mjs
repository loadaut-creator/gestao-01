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
process.exit(result.status ?? 1);
