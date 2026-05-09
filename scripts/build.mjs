import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

const watch = process.argv.includes("--watch");

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

function ensureIcons() {
  const iconsDir = path.join(dist, "icons");
  fs.mkdirSync(iconsDir, { recursive: true });
  for (const name of ["icon-16.png", "icon-48.png", "icon-128.png"]) {
    fs.writeFileSync(path.join(iconsDir, name), tinyPng);
  }
}

function copyStatic() {
  fs.mkdirSync(dist, { recursive: true });
  fs.copyFileSync(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
  fs.copyFileSync(path.join(root, "src", "options.html"), path.join(dist, "options.html"));
  ensureIcons();
}

const buildOpts = {
  bundle: true,
  target: "chrome120",
  platform: "browser",
  logLevel: "info",
  legalComments: "none",
};

async function run() {
  copyStatic();
  const ctx = await esbuild.context({
    ...buildOpts,
    entryPoints: {
      background: path.join(root, "src", "background.ts"),
      content: path.join(root, "src", "content.ts"),
      options: path.join(root, "src", "options.ts"),
    },
    outdir: dist,
    format: "iife",
  });

  if (watch) {
    await ctx.watch();
    console.log("watching…");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("built to dist/");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
