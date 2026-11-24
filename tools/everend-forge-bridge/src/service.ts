import fs from "node:fs";
import crypto from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createEnvelope,
  createId,
  isRecord,
  nowIso,
  type ChangeSetPayload,
  type ClientRole,
  type HelloPayload,
  type SessionInfo,
  type SnapshotPayload,
  type SyncEnvelope,
  type SyncErrorPayload,
  validateEnvelope,
} from "./protocol.js";

const DEFAULT_PORT = 47831;
const MAX_PORT_PROBE = 25;
const MAX_RECENT_MESSAGE_IDS = 4096;
const BRIDGE_VERSION = "0.1.0";

interface BridgeOptions {
  requestedPort?: number;
  projectId?: string;
  storyId?: string;
  stateDirectory?: string;
}

interface ConnectedClient {
  socket: WebSocket;
  clientId: string;
  role: ClientRole;
  connectedAt: string;
}

interface PersistedState {
  pid: number;
  port: number;
  sessionId: string;
  projectId: string | null;
  storyId: string | null;
  startedAt: string;
}

export function defaultStateDirectory(): string {
  const base = process.env.LOCALAPPDATA || process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(base, "EverendForge", "Bridge");
}

export function stateFilePath(port: number, stateDirectory = defaultStateDirectory()): string {
  return path.join(stateDirectory, `bridge-${port}.json`);
}

function currentStateFilePath(stateDirectory = defaultStateDirectory()): string {
  return path.join(stateDirectory, "bridge-current.json");
}

export function readPersistedState(port = DEFAULT_PORT, stateDirectory?: string): PersistedState | null {
  const filePath = stateFilePath(port, stateDirectory);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedState;
  } catch {
    return null;
  }
}

function readAnyPersistedState(stateDirectory = defaultStateDirectory()): PersistedState | null {
  try {
    const current = JSON.parse(fs.readFileSync(currentStateFilePath(stateDirectory), "utf8")) as PersistedState;
    if (isProcessAlive(current.pid)) return current;
  } catch { /* scan fallback below */ }
  try {
    for (const file of fs.readdirSync(stateDirectory)) {
      if (!file.startsWith("bridge-") || !file.endsWith(".json") || file === "bridge-current.json") continue;
      try {
        const state = JSON.parse(fs.readFileSync(path.join(stateDirectory, file), "utf8")) as PersistedState;
        if (isProcessAlive(state.pid)) return state;
      } catch { /* ignore stale state files */ }
    }
  } catch { /* no state directory */ }
  return null;
}

function writePersistedState(state: PersistedState, stateDirectory: string): void {
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(stateFilePath(state.port, stateDirectory), JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(currentStateFilePath(stateDirectory), JSON.stringify(state, null, 2), "utf8");
}

function removePersistedState(state: PersistedState, stateDirectory: string): void {
  try { fs.rmSync(stateFilePath(state.port, stateDirectory), { force: true }); } catch { /* best effort during shutdown */ }
  try {
    const current = JSON.parse(fs.readFileSync(currentStateFilePath(stateDirectory), "utf8")) as PersistedState;
    if (current.sessionId === state.sessionId) fs.rmSync(currentStateFilePath(stateDirectory), { force: true });
  } catch { /* best effort during shutdown */ }
}

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function send(socket: WebSocket, message: SyncEnvelope): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

export class BridgeService {
  private readonly options: BridgeOptions;
  private readonly stateDirectory: string;
  private readonly clients = new Map<WebSocket, ConnectedClient>();
  private readonly messageIds = new Set<string>();
  private readonly startedAt = nowIso();
  private readonly sessionId = createId("session");
  private readonly pairingCode = String(Math.floor(100000 + Math.random() * 900000));
  private readonly authToken: string;
  private server: http.Server | null = null;
  private webSocketServer: WebSocketServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private latestSnapshot: SyncEnvelope<SnapshotPayload> | null = null;
  private currentRevision = 0;
  private projectId: string | null;
  private storyId: string | null;
  private actualPort = 0;
  private persistedState: PersistedState | null = null;

  constructor(options: BridgeOptions = {}) {
    this.options = options;
    this.stateDirectory = options.stateDirectory ?? defaultStateDirectory();
    this.projectId = options.projectId ?? null;
    this.storyId = options.storyId ?? null;
    this.authToken = this.loadOrCreateToken();
  }

  get port(): number { return this.actualPort; }
  get session(): SessionInfo { return this.sessionInfo(); }

  async start(): Promise<SessionInfo> {
    if (this.server) return this.sessionInfo();
    const requestedPort = this.options.requestedPort ?? DEFAULT_PORT;
    const existing = readPersistedState(requestedPort, this.stateDirectory);
    if (existing && isProcessAlive(existing.pid)) throw new Error(`Bridge already running on 127.0.0.1:${existing.port} (pid ${existing.pid}).`);
    const port = await this.findPort(requestedPort);
    this.actualPort = port;
    this.server = http.createServer((request, response) => this.handleHttp(request, response));
    this.webSocketServer = new WebSocketServer({ noServer: true });
    this.server.on("upgrade", (request, socket, head) => {
      const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
      if (requestUrl.pathname !== "/v1/sync") { socket.destroy(); return; }
      this.webSocketServer?.handleUpgrade(request, socket, head, (webSocket) => this.handleSocket(webSocket));
    });
    await new Promise<void>((resolve, reject) => {
      const server = this.server!;
      const onError = (error: Error) => { server.off("listening", onListening); reject(error); };
      const onListening = () => {
        server.off("error", onError);
        const address = server.address();
        if (address && typeof address === "object") this.actualPort = address.port;
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    });
    this.persistedState = { pid: process.pid, port, sessionId: this.sessionId, projectId: this.projectId, storyId: this.storyId, startedAt: this.startedAt };
    writePersistedState(this.persistedState, this.stateDirectory);
    this.heartbeatTimer = setInterval(() => this.broadcastHeartbeat(), 10_000);
    this.heartbeatTimer.unref();
    return this.sessionInfo();
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    for (const client of this.clients.values()) client.socket.close(1001, "Bridge stopping");
    this.clients.clear();
    await new Promise<void>((resolve) => {
      if (!this.server) { resolve(); return; }
      this.server.close(() => resolve());
    });
    this.webSocketServer?.close();
    this.webSocketServer = null;
    this.server = null;
    if (this.persistedState) removePersistedState(this.persistedState, this.stateDirectory);
    this.persistedState = null;
  }

  private async findPort(start: number): Promise<number> {
    if (start === 0) return 0;
    for (let offset = 0; offset <= MAX_PORT_PROBE; offset += 1) {
      const port = start + offset;
      const available = await new Promise<boolean>((resolve) => {
        const probe = http.createServer();
        probe.once("error", () => resolve(false));
        probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
      });
      if (available) return port;
    }
    throw new Error(`No loopback port available from ${start} to ${start + MAX_PORT_PROBE}.`);
  }

  private loadOrCreateToken(): string {
    const tokenPath = path.join(this.stateDirectory, "bridge-token.txt");
    try {
      const token = fs.readFileSync(tokenPath, "utf8").trim();
      if (token) return token;
    } catch { /* create below */ }
    const token = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(this.stateDirectory, { recursive: true });
    fs.writeFileSync(tokenPath, token, "utf8");
    return token;
  }

  private sessionInfo(): SessionInfo {
    return {
      service: "everend-forge-bridge",
      bridgeVersion: BRIDGE_VERSION,
      syncProtocolVersion: "0.1",
      endpoint: `http://127.0.0.1:${this.actualPort}`,
      port: this.actualPort,
      sessionId: this.sessionId,
      projectId: this.projectId,
      storyId: this.storyId,
      pairingCode: this.pairingCode,
      revision: this.currentRevision,
      connectedClients: [...this.clients.values()].map((client) => ({ clientId: client.clientId, role: client.role, connectedAt: client.connectedAt })),
      hasSnapshot: this.latestSnapshot !== null,
    };
  }

  private handleHttp(request: http.IncomingMessage, response: http.ServerResponse): void {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${this.actualPort}`);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }
    if (requestUrl.pathname === "/health" && request.method === "GET") {
      this.json(response, 200, { ok: true, service: "everend-forge-bridge", bridgeVersion: BRIDGE_VERSION, syncProtocolVersion: "0.1", sessionId: this.sessionId, revision: this.currentRevision });
      return;
    }
    if (requestUrl.pathname === "/v1/session" && request.method === "GET") { this.json(response, 200, this.sessionInfo()); return; }
    this.json(response, 404, { ok: false, error: "not_found" });
  }

  private json(response: http.ServerResponse, status: number, value: unknown): void {
    const body = JSON.stringify(value);
    response.statusCode = status;
    response.setHeader("Content-Length", Buffer.byteLength(body));
    response.end(body);
  }

  private handleSocket(socket: WebSocket): void {
    let client: ConnectedClient | null = null;
    socket.on("message", (data) => {
      try {
        const parsed: unknown = JSON.parse(data.toString());
        validateEnvelope(parsed);
        const message = parsed as SyncEnvelope;
        if (!client) {
          client = this.acceptHello(socket, message);
          return;
        }
        this.handleMessage(client, message);
      } catch (error) {
        send(socket, this.errorEnvelope(error instanceof Error ? error.message : String(error), "invalid_message"));
      }
    });
    socket.on("close", () => { if (client) this.clients.delete(socket); });
    socket.on("error", () => { if (client) this.clients.delete(socket); });
  }

  private acceptHello(socket: WebSocket, message: SyncEnvelope): ConnectedClient {
    if (message.messageType !== "hello") throw new Error("The first message must be hello.");
    const payload = message.payload as unknown as HelloPayload;
    if ((payload.role === "author" && message.origin !== "pathbranching") || (payload.role === "unity" && message.origin !== "unity")) throw new Error("hello origin does not match client role.");
    if (this.projectId && this.projectId !== message.projectId) throw new Error(`Project mismatch. Session expects '${this.projectId}'.`);
    if (this.storyId && this.storyId !== message.storyId) throw new Error(`Story mismatch. Session expects '${this.storyId}'.`);
    if (!this.projectId) this.projectId = message.projectId;
    if (!this.storyId) this.storyId = message.storyId;
    if (payload.role === "unity" && payload.token !== this.authToken && payload.pairingCode !== this.pairingCode) throw new Error("Invalid pairing code or token.");
    if ([...this.clients.values()].some((existing) => existing.role === payload.role)) throw new Error(`Only one ${payload.role} client is supported per session.`);
    const connected: ConnectedClient = { socket, clientId: payload.clientId, role: payload.role, connectedAt: nowIso() };
    this.clients.set(socket, connected);
    send(socket, createEnvelope({ messageType: "welcome", messageId: createId("welcome"), sessionId: this.sessionId, projectId: this.projectId, storyId: this.storyId, baseRevision: this.currentRevision, revision: this.currentRevision, origin: "adapter", payload: { role: payload.role, pairingAccepted: true, revision: this.currentRevision, hasSnapshot: this.latestSnapshot !== null, token: this.authToken } }));
    if (connected.role === "unity" && this.latestSnapshot) send(socket, this.latestSnapshot);
    return connected;
  }

  private handleMessage(client: ConnectedClient, message: SyncEnvelope): void {
    if (message.sessionId !== this.sessionId) throw new Error("Message belongs to another session.");
    if (message.projectId !== this.projectId || message.storyId !== this.storyId) throw new Error("Message project or story does not match the session.");
    if (this.messageIds.has(message.messageId)) { send(client.socket, this.errorEnvelope("Duplicate messageId rejected.", "duplicate_message", message.messageId)); return; }
    this.messageIds.add(message.messageId);
    if (this.messageIds.size > MAX_RECENT_MESSAGE_IDS) {
      const oldestMessageId = this.messageIds.values().next().value;
      if (oldestMessageId) this.messageIds.delete(oldestMessageId);
    }
    if (message.messageType === "hello") throw new Error("hello can only be sent once.");
    if (message.messageType === "heartbeat") { send(client.socket, this.heartbeatEnvelope()); return; }
    if (message.messageType === "inventory" && client.role === "unity" && message.payload.requestSnapshot === true) {
      if (this.latestSnapshot) send(client.socket, this.latestSnapshot);
      else send(client.socket, this.errorEnvelope("No PathBranching snapshot is available yet.", "snapshot_unavailable", message.messageId));
      return;
    }
    if (message.messageType === "snapshot" || message.messageType === "changeSet") {
      if (client.role !== "author") throw new Error(`${message.messageType} is only accepted from PathBranching.`);
      if (message.baseRevision !== this.currentRevision) { send(client.socket, this.errorEnvelope(`Stale baseRevision ${message.baseRevision}; current revision is ${this.currentRevision}.`, "stale_revision", message.messageId)); return; }
      this.currentRevision += 1;
      const stamped = { ...message, baseRevision: this.currentRevision - 1, revision: this.currentRevision } as SyncEnvelope;
      if (message.messageType === "snapshot") this.latestSnapshot = stamped as SyncEnvelope<SnapshotPayload>;
      this.broadcast(stamped, client.socket);
      return;
    }
    this.broadcast(message, client.socket);
  }

  private broadcast(message: SyncEnvelope, except?: WebSocket): void {
    for (const client of this.clients.values()) if (client.socket !== except) send(client.socket, message);
  }

  private broadcastHeartbeat(): void {
    this.broadcast(this.heartbeatEnvelope());
  }

  private heartbeatEnvelope(): SyncEnvelope {
    return createEnvelope({ messageType: "heartbeat", messageId: createId("heartbeat"), sessionId: this.sessionId, projectId: this.projectId ?? "unpaired", storyId: this.storyId ?? "unpaired", baseRevision: this.currentRevision, revision: this.currentRevision, origin: "adapter", payload: { serverTime: nowIso(), revision: this.currentRevision, connectedClients: this.clients.size } });
  }

  private errorEnvelope(message: string, code: string, relatedMessageId?: string): SyncEnvelope<SyncErrorPayload> {
    return createEnvelope({ messageType: "error", messageId: createId("error"), sessionId: this.sessionId, projectId: this.projectId ?? "unpaired", storyId: this.storyId ?? "unpaired", baseRevision: this.currentRevision, revision: this.currentRevision, origin: "adapter", payload: { code, message, relatedMessageId } });
  }
}

export async function startBridge(options: BridgeOptions = {}): Promise<BridgeService> {
  const service = new BridgeService(options);
  await service.start();
  return service;
}

export async function stopBridge(port = DEFAULT_PORT, stateDirectory?: string): Promise<boolean> {
  const state = readPersistedState(port, stateDirectory) ?? readAnyPersistedState(stateDirectory);
  if (!state || !isProcessAlive(state.pid)) return false;
  process.kill(state.pid, "SIGTERM");
  return true;
}

export async function statusBridge(port = DEFAULT_PORT, stateDirectory?: string): Promise<SessionInfo | { ok: false; message: string }> {
  const state = readPersistedState(port, stateDirectory) ?? readAnyPersistedState(stateDirectory);
  if (!state || !isProcessAlive(state.pid)) return { ok: false, message: "Bridge is not running." };
  try {
    const response = await fetch(`http://127.0.0.1:${state.port}/v1/session`);
    if (!response.ok) return { ok: false, message: `Bridge responded with HTTP ${response.status}.` };
    return await response.json() as SessionInfo;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
