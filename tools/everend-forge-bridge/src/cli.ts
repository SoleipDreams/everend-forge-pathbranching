import process from "node:process";
import { startBridge, statusBridge, stopBridge } from "./service.js";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberOption(args: string[], name: string): number | undefined {
  const value = option(args, name);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error(`${name} must be a valid TCP port.`);
  return parsed;
}

async function main(): Promise<void> {
  const [command = "status", ...args] = process.argv.slice(2);
  const port = numberOption(args, "--port");
  const stateDirectory = option(args, "--state-dir");
  if (command === "status") { console.log(JSON.stringify(await statusBridge(port, stateDirectory), null, 2)); return; }
  if (command === "stop") { console.log(JSON.stringify({ stopped: await stopBridge(port, stateDirectory) }, null, 2)); return; }
  if (command !== "start") throw new Error(`Unknown command '${command}'. Use start, status, or stop.`);
  const existing = await statusBridge(port, stateDirectory);
  if (!("ok" in existing && existing.ok === false)) {
    console.log(JSON.stringify(existing, null, 2));
    return;
  }
  const service = await startBridge({
    requestedPort: port,
    projectId: option(args, "--project-id"),
    storyId: option(args, "--story-id"),
    stateDirectory,
  });
  console.log(JSON.stringify(service.session, null, 2));
  const shutdown = async () => { await service.stop(); process.exit(0); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
