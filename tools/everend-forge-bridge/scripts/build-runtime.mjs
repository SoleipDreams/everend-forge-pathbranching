import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const bridgeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.resolve(bridgeRoot, process.argv[2] ?? "dist/runtime");
const entry = path.join(destination, "bridge.cjs");
const launcherSource = path.join(bridgeRoot, "everend-forge-bridge.cmd");

fs.mkdirSync(destination, { recursive: true });

await build({
  entryPoints: [path.join(bridgeRoot, "src/cli.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: entry,
  sourcemap: false,
  legalComments: "eof",
});

fs.copyFileSync(launcherSource, path.join(destination, "everend-forge-bridge.cmd"));

if (process.platform === "win32") {
  fs.copyFileSync(process.execPath, path.join(destination, "node.exe"));
  const nodeLicense = path.join(path.dirname(process.execPath), "LICENSE");
  if (fs.existsSync(nodeLicense)) fs.copyFileSync(nodeLicense, path.join(destination, "node-LICENSE.txt"));
} else {
  const localNode = path.join(destination, "node");
  fs.copyFileSync(process.execPath, localNode);
  fs.chmodSync(localNode, 0o755);
}

const manifest = {
  service: "everend-forge-bridge",
  bridgeVersion: "0.1.0",
  syncProtocolVersion: "0.1",
  entry: "bridge.cjs",
  launcher: os.platform() === "win32" ? "everend-forge-bridge.cmd" : "node",
  bundledNode: true,
};
fs.writeFileSync(path.join(destination, "everend-forge-bridge.manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`Everend Forge Bridge runtime staged at ${destination}`);
