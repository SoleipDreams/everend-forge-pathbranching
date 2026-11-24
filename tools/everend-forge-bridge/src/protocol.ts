export const SYNC_PROTOCOL_VERSION = "0.1" as const;

export type SyncMessageType =
  | "hello"
  | "welcome"
  | "snapshot"
  | "changeSet"
  | "inventory"
  | "validationReport"
  | "applyResult"
  | "heartbeat"
  | "error";

export type SyncOrigin = "pathbranching" | "unity" | "adapter";
export type ClientRole = "author" | "unity";
export type SyncOperationKind = "upsert" | "set" | "remove" | "propose";
export type Ownership = "pathbranching" | "unity" | "adapter";

export interface SyncOperation {
  operation: SyncOperationKind;
  entityType: string;
  entityId: string;
  propertyPath?: string;
  ownership: Ownership;
  value?: unknown;
  reason?: string;
  [key: string]: unknown;
}

export interface SyncEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  syncProtocolVersion: typeof SYNC_PROTOCOL_VERSION;
  messageType: SyncMessageType;
  messageId: string;
  sessionId: string;
  projectId: string;
  storyId: string;
  baseRevision: number;
  revision: number;
  origin: SyncOrigin;
  payload: TPayload;
}

export interface HelloPayload extends Record<string, unknown> {
  role: ClientRole;
  clientId: string;
  pairingCode?: string;
  token?: string;
  clientVersion?: string;
}

export interface SnapshotPayload extends Record<string, unknown> {
  runtimePackage: Record<string, unknown>;
  projection?: Record<string, unknown>;
  validationReport?: Record<string, unknown>;
}

export interface ChangeSetPayload extends Record<string, unknown> {
  operations: SyncOperation[];
  description?: string;
}

export interface SyncErrorPayload extends Record<string, unknown> {
  code: string;
  message: string;
  details?: unknown;
}

export interface SessionInfo {
  service: "everend-forge-bridge";
  bridgeVersion: string;
  syncProtocolVersion: typeof SYNC_PROTOCOL_VERSION;
  endpoint: string;
  port: number;
  sessionId: string;
  projectId: string | null;
  storyId: string | null;
  pairingCode: string;
  revision: number;
  connectedClients: Array<{ clientId: string; role: ClientRole; connectedAt: string }>;
  hasSnapshot: boolean;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEnvelope<TPayload extends Record<string, unknown>>(
  input: Omit<SyncEnvelope<TPayload>, "syncProtocolVersion">,
): SyncEnvelope<TPayload> {
  return { syncProtocolVersion: SYNC_PROTOCOL_VERSION, ...input };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateEnvelope(value: unknown): asserts value is SyncEnvelope {
  if (!isRecord(value)) throw new Error("Message must be a JSON object.");
  const required = [
    "syncProtocolVersion",
    "messageType",
    "messageId",
    "sessionId",
    "projectId",
    "storyId",
    "baseRevision",
    "revision",
    "origin",
    "payload",
  ];
  for (const key of required) {
    if (!(key in value)) throw new Error(`Message.${key} is required.`);
  }
  if (value.syncProtocolVersion !== SYNC_PROTOCOL_VERSION) throw new Error(`Unsupported sync protocol '${String(value.syncProtocolVersion)}'.`);
  if (typeof value.messageType !== "string") throw new Error("Message.messageType must be a string.");
  if (typeof value.messageId !== "string" || value.messageId.length === 0) throw new Error("Message.messageId must be a non-empty string.");
  if (typeof value.sessionId !== "string" || value.sessionId.length === 0) throw new Error("Message.sessionId must be a non-empty string.");
  if (typeof value.projectId !== "string" || value.projectId.length === 0) throw new Error("Message.projectId must be a non-empty string.");
  if (typeof value.storyId !== "string" || value.storyId.length === 0) throw new Error("Message.storyId must be a non-empty string.");
  if (!Number.isInteger(value.baseRevision) || Number(value.baseRevision) < 0) throw new Error("Message.baseRevision must be a non-negative integer.");
  if (!Number.isInteger(value.revision) || Number(value.revision) < 0) throw new Error("Message.revision must be a non-negative integer.");
  if (!["pathbranching", "unity", "adapter"].includes(String(value.origin))) throw new Error("Message.origin is invalid.");
  if (!isRecord(value.payload)) throw new Error("Message.payload must be an object.");
  if (value.messageType === "hello") {
    const payload = value.payload;
    if (!["author", "unity"].includes(String(payload.role))) throw new Error("hello.payload.role must be author or unity.");
    if (typeof payload.clientId !== "string" || payload.clientId.length === 0) throw new Error("hello.payload.clientId is required.");
  }
  if (value.messageType === "changeSet") {
    if (!Array.isArray(value.payload.operations)) throw new Error("changeSet.payload.operations must be an array.");
    for (const operation of value.payload.operations) validateOperation(operation);
  }
  if (value.messageType === "snapshot" && !isRecord(value.payload.runtimePackage)) throw new Error("snapshot.payload.runtimePackage must be an object.");
}

export function validateOperation(value: unknown): asserts value is SyncOperation {
  if (!isRecord(value)) throw new Error("Change operation must be an object.");
  if (!["upsert", "set", "remove", "propose"].includes(String(value.operation))) throw new Error("Change operation has an invalid operation.");
  if (typeof value.entityType !== "string" || value.entityType.length === 0) throw new Error("Change operation.entityType is required.");
  if (typeof value.entityId !== "string" || value.entityId.length === 0) throw new Error("Change operation.entityId is required.");
  if (!["pathbranching", "unity", "adapter"].includes(String(value.ownership))) throw new Error("Change operation.ownership is invalid.");
}
