// Builds the unpacked extension into dist/.
// dist/ is what "Load unpacked" in chrome://extensions points at.
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const outDir = "dist";

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "iife",
  target: "chrome111",
  outfile: `${outDir}/main.js`,
  sourcemap: false,
  minify: false,
  logLevel: "info",
});

await cp("src/manifest.json", `${outDir}/manifest.json`);
