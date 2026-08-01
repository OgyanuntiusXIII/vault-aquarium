import esbuild from "esbuild";
import process from "node:process";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const production = process.argv[2] === "production";
const projectDir = fileURLToPath(new URL(".", import.meta.url));
const context = await esbuild.context({
  absWorkingDir: projectDir,
  entryPoints: [path.join(projectDir, "main.ts")],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", ...builtinModules],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  minify: production,
  sourcemap: production ? false : "inline",
  treeShaking: true,
  loader: { ".png": "dataurl" },
  outfile: path.join(projectDir, "main.js")
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
