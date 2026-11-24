import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const pathBranchingRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siblingBridgeRoot = path.resolve(pathBranchingRoot, "..", "everend-forge-bridge");
const bundledBridgeRoot = path.join(pathBranchingRoot, "tools", "everend-forge-bridge");
const bridgeRoot = process.env.EVEREND_FORGE_BRIDGE_ROOT
  ? path.resolve(process.env.EVEREND_FORGE_BRIDGE_ROOT)
  : fs.existsSync(path.join(siblingBridgeRoot, "scripts", "build-runtime.mjs"))
    ? siblingBridgeRoot
    : bundledBridgeRoot;
const destination = path.join(pathBranchingRoot, "src-tauri", "bridge-runtime");
const builder = path.join(bridgeRoot, "scripts", "build-runtime.mjs");

if (!fs.existsSync(builder)) {
  console.error(`Everend Forge Bridge runtime builder not found: ${builder}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [builder, destination], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
