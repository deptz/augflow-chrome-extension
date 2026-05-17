/**
 * Resize icons/augment.png (or repo-root augment.png) to MV3 sizes.
 * macOS: uses `sips`. Pre-generated icons in icons/ are committed for Linux CI.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const candidates = [
  path.join(root, "icons", "augment.png"),
  path.join(root, "augment.png"),
];
const src = candidates.find((p) => fs.existsSync(p));
if (!src) {
  console.error("Missing source image: icons/augment.png or augment.png");
  process.exit(1);
}

const outDir = path.join(root, "icons");
fs.mkdirSync(outDir, { recursive: true });

const sizes = [16, 48, 128];
try {
  for (const size of sizes) {
    const out = path.join(outDir, `icon-${size}.png`);
    execSync(`sips -z ${size} ${size} ${JSON.stringify(src)} --out ${JSON.stringify(out)}`, {
      stdio: "inherit",
    });
  }
  console.log(`Generated ${sizes.map((s) => `icon-${s}.png`).join(", ")} from ${path.relative(root, src)}`);
} catch {
  console.error("sips failed (macOS only). Use pre-generated files in icons/ or run on a Mac.");
  process.exit(1);
}
