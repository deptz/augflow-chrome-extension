import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

if (!fs.existsSync(path.join(dist, "manifest.json"))) {
  console.error("dist/ is missing or empty. Run: npm run build");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const ver = manifest.version;
const outDir = path.join(root, ".artifacts");
const outFile = path.join(outDir, `augflow-jira-bridge-v${ver}.zip`);

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(outFile)) {
  fs.unlinkSync(outFile);
}

/** Zip so `manifest.json` is at the archive root (required for stores / side-load helpers). */
function zipWithPosix() {
  return spawnSync("zip", ["-r", "-q", outFile, "."], {
    cwd: dist,
    stdio: "inherit",
  });
}

function zipWithWindows() {
  const distNorm = dist.replace(/'/g, "''");
  const outNorm = outFile.replace(/'/g, "''");
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    `Compress-Archive -Path (Join-Path '${distNorm}' '*') -DestinationPath '${outNorm}' -Force`,
  ].join("; ");
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
    stdio: "inherit",
  });
}

const r = process.platform === "win32" ? zipWithWindows() : zipWithPosix();

if (r.error) {
  console.error(r.error.message);
  console.error("Install Info-Zip (`zip`) or use Windows with PowerShell.");
  process.exit(1);
}

if (r.status !== 0 && r.status != null) {
  process.exit(r.status);
}

console.log(`Wrote ${outFile}`);
