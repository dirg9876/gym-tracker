import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
  entryPoints: [fileURLToPath(new URL("./src/coach/index.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("./dist/index.mjs", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: ["express", "openai", "zod"],
  sourcemap: "linked",
  logLevel: "info",
});
