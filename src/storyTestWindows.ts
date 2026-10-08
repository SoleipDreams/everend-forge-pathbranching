import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { emitTo, listen, TauriEvent, type UnlistenFn } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { availableMonitors, getCurrentWindow } from '@tauri-apps/api/window';
import type { StoryTestKind, StoryTestRequest, StoryTestSnapshot } from './storyTestController.js';

export const STORY_TEST_EVENTS = {
  ready: 'pathbranching-story-test-ready',
  request: 'pathbranching-story-test-request',
  command: 'pathbranching-story-test-command',
  snapshot: 'pathbranching-story-test-snapshot',
  ack: 'pathbranching-story-test-ack',
  close: 'pathbranching-story-test-close',
  redock: 'pathbranching-story-test-redock',
  redockRequest: 'pathbranching-story-test-redock-request',
} as const;

export const STORY_TEST_LABELS: Record<StoryTestKind, string> = {
  preview: 'pathbranching-preview', debug: 'pathbranching-debug',
};
export type StoryTestWindowIdentity = { version: 1; kind: StoryTestKind; sessionId: string };
export type StoryTestWindowPacket = StoryTestWindowIdentity & { snapshot: StoryTestSnapshot; font: string };
export type StoryTestWindowCommand = StoryTestWindowIdentity & { request: StoryTestRequest };
export type StoryTestWindowAck = StoryTestWindowIdentity & { commandId: string; accepted: boolean };

export function storyTestWindowKind(search = window.location.search): StoryTestKind | undefined {
  const view = new URLSearchParams(search).get('view');
  return view === 'story-preview' ? 'preview' : view === 'story-debug' ? 'debug' : undefined;
}

type Geometry = { width: number; height: number; x?: number; y?: number };
type WindowRecord = { window: WebviewWindow; sessionId: string; ready: boolean; listeners: UnlistenFn[]; timer?: ReturnType<typeof setTimeout> };
const geometryKey = (kind: StoryTestKind) => `pathbranching.story-test.native.${kind}`;
const defaults: Record<StoryTestKind, Geometry> = { preview: { width: 430, height: 420 }, debug: { width: 580, height: 650 } };

function savedGeometry(kind: StoryTestKind): Geometry {
  try {
    const value = JSON.parse(localStorage.getItem(geometryKey(kind)) ?? 'null') as Geometry | null;
    if (value && Number.isFinite(value.width) && Number.isFinite(value.height)) {
      return { width: Math.max(340, Math.min(1200, value.width)), height: Math.max(260, Math.min(1000, value.height)),
        ...(Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : {}) };
    }
  } catch { /* A presentation preference must never prevent a run. */ }
  return defaults[kind];
}

function validIdentity(value: unknown): value is StoryTestWindowIdentity {
  const identity = value as StoryTestWindowIdentity | null;
  return Boolean(identity && identity.version === 1 && (identity.kind === 'preview' || identity.kind === 'debug') && typeof identity.sessionId === 'string');
}

/** The editor owns the session; native windows receive presentation snapshots only. */
export function useStoryTestWindows(snapshot: StoryTestSnapshot, onRequest: (request: StoryTestRequest) => boolean) {
  const snapshotRef = useRef(snapshot);
  const requestRef = useRef(onRequest);
  snapshotRef.current = snapshot;
  requestRef.current = onRequest;
  const records = useRef<Partial<Record<StoryTestKind, WindowRecord>>>({});
  const opening = useRef(new Set<StoryTestKind>());
  const mounted = useRef(false);
  const listenersReady = useRef<Promise<void>>(Promise.resolve());
  const [detached, setDetached] = useState<Record<StoryTestKind, boolean>>({ preview: false, debug: false });
  const [error, setError] = useState<string>();

  const sendSnapshot = useCallback(async (kind: StoryTestKind) => {
    const current = snapshotRef.current;
    const record = records.current[kind];
    if (!record || record.sessionId !== current.sessionId) return;
    const packet: StoryTestWindowPacket = { version: 1, kind, sessionId: current.sessionId, snapshot: current,
      font: getComputedStyle(document.documentElement).getPropertyValue('--ef-primary-font') };
    await emitTo(STORY_TEST_LABELS[kind], STORY_TEST_EVENTS.snapshot, packet);
  }, []);

  const closeRecord = useCallback(async (kind: StoryTestKind, focus = false) => {
    const record = records.current[kind];
    if (mounted.current) setDetached((previous) => previous[kind] ? ({ ...previous, [kind]: false }) : previous);
    if (!record) return;
    delete records.current[kind];
    clearTimeout(record.timer);
    record.listeners.forEach((unlisten) => unlisten());
    // An owner stop is authoritative. Let the client bypass its draft-draining
    // native close handler before closing this window.
    await emitTo(STORY_TEST_LABELS[kind], STORY_TEST_EVENTS.close,
      { version: 1, kind, sessionId: record.sessionId }).catch(() => undefined);
    try { await record.window.destroy(); } catch { /* It may already have been closed natively. */ }
    if (focus) { try { await getCurrentWindow().setFocus(); } catch { /* The owner may be shutting down. */ } }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setDetached({ preview: false, debug: false });
    if (!isTauri()) return () => { mounted.current = false; };
    let cancelled = false;
    const subscriptions: UnlistenFn[] = [];
    const acceptIdentity = (value: unknown): boolean => validIdentity(value)
      && value.sessionId === snapshotRef.current.sessionId
      && records.current[value.kind]?.sessionId === value.sessionId;
    const subscribe = async <T,>(name: string, handler: (value: T) => void | Promise<void>) => {
      const unlisten = await listen<T>(name, (event) => { void handler(event.payload); }, { target: 'main' });
      if (cancelled) unlisten(); else subscriptions.push(unlisten);
    };
    listenersReady.current = Promise.all([
      subscribe<StoryTestWindowIdentity>(STORY_TEST_EVENTS.ready, async (identity) => {
        if (!acceptIdentity(identity)) return;
        const record = records.current[identity.kind];
        try {
          await sendSnapshot(identity.kind);
          if (record && records.current[identity.kind] === record) {
            record.ready = true;
            clearTimeout(record.timer);
            if (mounted.current) setDetached((previous) => ({ ...previous, [identity.kind]: true }));
          }
        } catch (cause) {
          if (mounted.current) setError(String(cause));
          await closeRecord(identity.kind);
        }
      }),
      subscribe<StoryTestWindowIdentity>(STORY_TEST_EVENTS.request, async (identity) => {
        if (acceptIdentity(identity)) await sendSnapshot(identity.kind).catch(() => undefined);
        else if (validIdentity(identity)) await emitTo(STORY_TEST_LABELS[identity.kind], STORY_TEST_EVENTS.close, identity).catch(() => undefined);
      }),
      subscribe<StoryTestWindowCommand>(STORY_TEST_EVENTS.command, async (message) => {
        if (!acceptIdentity(message) || !message.request || message.request.sessionId !== message.sessionId) return;
        const accepted = requestRef.current(message.request);
        const ack: StoryTestWindowAck = { version: 1, kind: message.kind, sessionId: message.sessionId, commandId: message.request.commandId, accepted };
        await emitTo(STORY_TEST_LABELS[message.kind], STORY_TEST_EVENTS.ack, ack).catch(() => undefined);
        await sendSnapshot(message.kind).catch(() => undefined);
      }),
      subscribe<StoryTestWindowIdentity>(STORY_TEST_EVENTS.redock, async (identity) => {
        if (acceptIdentity(identity)) await closeRecord(identity.kind, true);
      }),
    ]).then(() => undefined).catch((cause) => { if (mounted.current) setError(String(cause)); });
    return () => {
      mounted.current = false;
      cancelled = true;
      subscriptions.forEach((unlisten) => unlisten());
      void closeRecord('preview');
      void closeRecord('debug');
    };
  }, [closeRecord, sendSnapshot]);

  useEffect(() => {
    if (!isTauri()) return;
    for (const kind of ['preview', 'debug'] as const) {
      const record = records.current[kind];
      if (!record) {
        setDetached((previous) => previous[kind] ? ({ ...previous, [kind]: false }) : previous);
        continue;
      }
      if (record.sessionId !== snapshot.sessionId || (kind === 'preview' ? !snapshot.active : !snapshot.debugOpen)) {
        void closeRecord(kind);
      } else if (record.ready) void sendSnapshot(kind).catch(() => undefined);
    }
  }, [snapshot, closeRecord, sendSnapshot]);

  const detach = useCallback(async (kind: StoryTestKind) => {
    if (!isTauri()) return;
    const current = snapshotRef.current;
    if (kind === 'preview' ? !current.active : !current.debugOpen) return;
    if (opening.current.has(kind)) return;
    opening.current.add(kind);
    setError(undefined);
    try {
      await listenersReady.current;
      const existing = records.current[kind];
      if (existing) { await existing.window.setFocus().catch(() => undefined); return; }
      const orphan = await WebviewWindow.getByLabel(STORY_TEST_LABELS[kind]);
      if (orphan) await orphan.destroy();
      const geometry = savedGeometry(kind);
      if (geometry.x !== undefined && geometry.y !== undefined) {
        const monitors = await availableMonitors();
        const visible = monitors.some((monitor) => {
          const position = monitor.position.toLogical(monitor.scaleFactor);
          const size = monitor.size.toLogical(monitor.scaleFactor);
          return geometry.x! + 100 >= position.x && geometry.x! < position.x + size.width
            && geometry.y! >= position.y && geometry.y! + 50 < position.y + size.height;
        });
        if (!visible) { delete geometry.x; delete geometry.y; }
      }
      const latest = snapshotRef.current;
      if (!mounted.current || latest.sessionId !== current.sessionId || (kind === 'preview' ? !latest.active : !latest.debugOpen)) return;
      const title = current.locale === 'es' ? (kind === 'preview' ? 'Probar historia' : 'Debug de la historia') : (kind === 'preview' ? 'Story preview' : 'Story debug');
      const auxiliary = new WebviewWindow(STORY_TEST_LABELS[kind], {
        url: `index.html?view=story-${kind}&session=${encodeURIComponent(current.sessionId)}`,
        title, ...geometry, minWidth: 340, minHeight: 260,
        center: geometry.x === undefined, resizable: true, focus: true,
        decorations: false, parent: 'main',
      });
      const record: WindowRecord = { window: auxiliary, sessionId: current.sessionId, ready: false, listeners: [] };
      records.current[kind] = record;
      const addListener = (unlisten: UnlistenFn) => {
        if (records.current[kind] === record) record.listeners.push(unlisten); else unlisten();
      };
      record.timer = setTimeout(() => {
        if (records.current[kind] !== record || record.ready) return;
        setError(current.locale === 'es' ? 'No se pudo preparar la ventana. La prueba continúa en el canvas.' : 'The window could not be prepared. Testing remains in the canvas.');
        void closeRecord(kind);
      }, 12000);
      void auxiliary.once('tauri://error', (event) => {
        if (records.current[kind] !== record) return;
        setError(String(event.payload));
        void closeRecord(kind);
      }).then(addListener);
      void auxiliary.once(TauriEvent.WINDOW_DESTROYED, () => {
        if (records.current[kind] !== record) return;
        delete records.current[kind];
        clearTimeout(record.timer);
        record.listeners.forEach((unlisten) => unlisten());
        if (mounted.current) setDetached((previous) => ({ ...previous, [kind]: false }));
      }).then(addListener);
      const saveGeometry = async () => {
        try {
          const factor = await auxiliary.scaleFactor();
          const size = (await auxiliary.innerSize()).toLogical(factor);
          const position = (await auxiliary.outerPosition()).toLogical(factor);
          localStorage.setItem(geometryKey(kind), JSON.stringify({ width: size.width, height: size.height, x: position.x, y: position.y }));
        } catch { /* Geometry is recoverable UI state, never narrative data. */ }
      };
      void auxiliary.onMoved(() => { void saveGeometry(); }).then(addListener);
      void auxiliary.onResized(() => { void saveGeometry(); }).then(addListener);
    } catch (cause) {
      if (mounted.current) setError(String(cause));
      await closeRecord(kind);
    } finally { opening.current.delete(kind); }
  }, [closeRecord]);

  const redock = useCallback(async (kind: StoryTestKind) => {
    const record = records.current[kind];
    if (!record?.ready) return closeRecord(kind, true);
    await emitTo(STORY_TEST_LABELS[kind], STORY_TEST_EVENTS.redockRequest,
      { version: 1, kind, sessionId: record.sessionId }).catch((cause) => {
      if (mounted.current) setError(String(cause));
    });
  }, [closeRecord]);

  return { detached, detach, redock, error, clearError: () => setError(undefined), canDetach: isTauri() };
}
