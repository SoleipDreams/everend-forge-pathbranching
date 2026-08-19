import { invoke } from "@tauri-apps/api/core";
import type { BranchingProject, RuntimePackage } from "./domain.js";
import { exportRuntimePackage } from "./exportRuntime.js";
import { isTauriRuntime } from "./utils/appEnvironment.js";

export type EverendBridgeMode = "live" | "manual";
export type EverendBridgeConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export type EverendBridgeSettings = {
  mode: EverendBridgeMode;
  endpoint: string;
  daemonExecutable: string;
  showTerminal: boolean;
  profileId: string;
  outputRoot: string;
  autoSync: boolean;
  locale: string;
};

export type EverendBridgeSession = {
  service: string;
  bridgeVersion: string;
  syncProtocolVersion: string;
  endpoint: string;
  port: number;
  sessionId: string;
  projectId: string | null;
  storyId: string | null;
  pairingCode: string;
  revision: number;
  connectedClients: Array<{ clientId: string; role: "author" | "unity"; connectedAt: string }>;
  hasSnapshot: boolean;
};

type SyncEnvelope = {
  syncProtocolVersion: "0.1";
  messageType: string;
  messageId: string;
  sessionId: string;
  projectId: string;
  storyId: string;
  baseRevision: number;
  revision: number;
  origin: "pathbranching" | "unity" | "adapter";
  payload: Record<string, unknown>;
};

export type EverendBridgeStatus = {
  state: EverendBridgeConnectionState;
  message: string;
  lastMessageType?: string;
  revision: number;
};

export type EverendBridgeServiceResult = {
  ok: boolean;
  message: string;
  pid?: number;
  port?: number;
  output?: string;
};

export const DEFAULT_EVEREND_BRIDGE_SETTINGS: EverendBridgeSettings = {
  mode: "live",
  endpoint: "http://127.0.0.1:47831",
  daemonExecutable: "",
  showTerminal: true,
  profileId: "sinpo-v0.1",
  outputRoot: "Assets/EverendForge/Generated",
  autoSync: false,
  locale: "und",
};

export function normalizeBridgeEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_EVEREND_BRIDGE_SETTINGS.endpoint;
  return trimmed.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://");
}

function syncEndpoint(endpoint: string): string {
  return normalizeBridgeEndpoint(endpoint).replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://") + "/v1/sync";
}

function id(prefix: string): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
}

function createEnvelope(input: Omit<SyncEnvelope, "syncProtocolVersion">): SyncEnvelope {
  return { syncProtocolVersion: "0.1", ...input };
}

export async function getEverendBridgeSession(endpoint: string): Promise<EverendBridgeSession> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${normalizeBridgeEndpoint(endpoint)}/v1/session`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Bridge session returned HTTP ${response.status}.`);
    return await response.json() as EverendBridgeSession;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function startEverendBridgeService(input: {
  executable: string;
  port: number;
  showTerminal: boolean;
  projectId?: string;
  storyId?: string;
}): Promise<EverendBridgeServiceResult> {
  if (!isTauriRuntime()) throw new Error("Starting the local Everend Forge Bridge requires the desktop app.");
  return invoke<EverendBridgeServiceResult>("everend_bridge_start", {
    executable: input.executable,
    port: input.port,
    showTerminal: input.showTerminal,
    projectId: input.projectId,
    storyId: input.storyId,
  });
}

export async function stopEverendBridgeService(input: { executable: string; port: number }): Promise<EverendBridgeServiceResult> {
  if (!isTauriRuntime()) throw new Error("Stopping the local Everend Forge Bridge requires the desktop app.");
  return invoke<EverendBridgeServiceResult>("everend_bridge_stop", input);
}

export async function statusEverendBridgeService(port: number): Promise<EverendBridgeServiceResult> {
  if (!isTauriRuntime()) throw new Error("Checking the local Everend Forge Bridge requires the desktop app.");
  return invoke<EverendBridgeServiceResult>("everend_bridge_status", { port });
}

export class EverendBridgeClient {
  private socket?: WebSocket;
  private reconnectTimer?: number;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private connection?: { endpoint: string; projectId: string; storyId: string; pairingCode?: string; onMessage?: (message: SyncEnvelope) => void; onStatus?: (status: EverendBridgeStatus) => void };
  private session?: EverendBridgeSession;
  private state: EverendBridgeStatus = { state: "disconnected", message: "Disconnected.", revision: 0 };

  get status(): EverendBridgeStatus { return this.state; }
  get currentSession(): EverendBridgeSession | undefined { return this.session; }

  async connect(input: {
    endpoint: string;
    projectId: string;
    storyId: string;
    pairingCode?: string;
    autoReconnect?: boolean;
    onMessage?: (message: SyncEnvelope) => void;
    onStatus?: (status: EverendBridgeStatus) => void;
  }): Promise<void> {
    this.disconnect(false);
    this.connection = input;
    this.shouldReconnect = input.autoReconnect ?? true;
    this.update({ state: "connecting", message: "Reading bridge session…" });
    this.session = await getEverendBridgeSession(input.endpoint);
    this.update({ state: "connecting", message: `Connecting to ${input.endpoint}.`, revision: this.session.revision });
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(syncEndpoint(input.endpoint));
      this.socket = socket;
      let settled = false;
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify(createEnvelope({
          messageType: "hello",
          messageId: id("hello"),
          sessionId: this.session!.sessionId,
          projectId: input.projectId,
          storyId: input.storyId,
          baseRevision: this.session!.revision,
          revision: this.session!.revision,
          origin: "pathbranching",
          payload: { role: "author", clientId: "pathbranching-desktop", pairingCode: input.pairingCode },
        })));
      });
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as SyncEnvelope;
          this.handleMessage(message);
          if (!settled && message.messageType === "welcome") { settled = true; resolve(); }
          if (!settled && message.messageType === "error") { settled = true; reject(new Error(String(message.payload.message ?? "Bridge rejected the connection."))); }
        } catch (error) {
          if (!settled) { settled = true; reject(error); }
        }
      });
      socket.addEventListener("error", () => {
        if (!settled) { settled = true; reject(new Error("Could not connect to the Everend Forge Bridge.")); }
        this.update({ state: "error", message: "Bridge connection error." });
      });
      socket.addEventListener("close", () => {
        this.socket = undefined;
        if (this.shouldReconnect && this.connection) this.scheduleReconnect();
        else this.update({ state: "disconnected", message: "Disconnected." });
      });
    });
    this.reconnectAttempt = 0;
    this.update({ state: "connected", message: "Connected to Everend Forge Bridge.", revision: this.session.revision });
  }

  disconnect(allowReconnect = false): void {
    this.shouldReconnect = allowReconnect;
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close();
    this.socket = undefined;
    if (!allowReconnect) this.connection = undefined;
    this.update({ state: "disconnected", message: "Disconnected." });
  }

  publishSnapshot(project: BranchingProject): void {
    const runtimePackage = exportRuntimePackage(project) as unknown as Record<string, unknown>;
    this.send("snapshot", { runtimePackage });
  }

  sendInventory(inventory: Record<string, unknown>): void {
    this.send("inventory", inventory);
  }

  sendChangeSet(operations: Array<Record<string, unknown>>, description?: string): void {
    this.send("changeSet", { operations, description });
  }

  private send(messageType: string, payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.session || !this.connection) throw new Error("Everend Forge Bridge is not connected.");
    this.socket.send(JSON.stringify(createEnvelope({
      messageType,
      messageId: id(messageType),
      sessionId: this.session.sessionId,
      projectId: this.connection.projectId,
      storyId: this.connection.storyId,
      baseRevision: this.state.revision,
      revision: this.state.revision,
      origin: "pathbranching",
      payload,
    })));
  }

  private handleMessage(message: SyncEnvelope): void {
    if (Number.isInteger(message.revision)) this.update({ revision: message.revision, lastMessageType: message.messageType });
    if (message.messageType === "error") this.update({ state: "error", message: String(message.payload.message ?? "Bridge error."), lastMessageType: "error" });
    if (message.messageType === "welcome") this.update({ state: "connected", message: "Connected to Everend Forge Bridge.", lastMessageType: "welcome" });
    this.connection?.onMessage?.(message);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== undefined || !this.connection) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(10_000, 500 * 2 ** Math.min(this.reconnectAttempt, 5));
    this.update({ state: "reconnecting", message: `Reconnecting in ${Math.round(delay / 1000)}s…` });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      const connection = this.connection;
      if (!connection) return;
      void this.connect(connection).catch((error) => this.update({ state: "error", message: error instanceof Error ? error.message : String(error) }));
    }, delay);
  }

  private update(patch: Partial<EverendBridgeStatus>): void {
    this.state = { ...this.state, ...patch };
    this.connection?.onStatus?.(this.state);
  }
}

export type { RuntimePackage };
