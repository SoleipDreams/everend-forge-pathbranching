import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { applyInterfaceLocale } from '../i18n.js';
import type { StoryTestKind, StoryTestRequest, StoryTestSnapshot, StoryTestUiCommand } from '../storyTestController.js';
import { STORY_TEST_EVENTS, STORY_TEST_LABELS, storyTestWindowKind, type StoryTestWindowAck, type StoryTestWindowCommand, type StoryTestWindowIdentity, type StoryTestWindowPacket } from '../storyTestWindows.js';
import { StoryTestControls, StoryTestDebug, StoryTestPreview } from './StoryTestViews.js';
import '../storyTestWindows.css';

export { storyTestWindowKind };

type Pending = { request: StoryTestRequest; acknowledged: boolean; sentAt: number };
const draftScope = (key: string): 'run' | 'scenario' | undefined => key.startsWith('run:') ? 'run' : key.startsWith('scenario:') ? 'scenario' : undefined;

/** Presentation client only: the editor remains the sole owner of execution. */
export function StoryTestDetached({ kind }: { kind: StoryTestKind }) {
  const sessionId = new URLSearchParams(window.location.search).get('session') ?? '';
  const identity: StoryTestWindowIdentity = { version: 1, kind, sessionId };
  const [snapshot, setSnapshot] = useState<StoryTestSnapshot>();
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [closing, setClosing] = useState(false);
  const snapshotRef = useRef<StoryTestSnapshot | undefined>(undefined);
  const queue = useRef<StoryTestUiCommand[]>([]);
  const pending = useRef<Pending | undefined>(undefined);
  // Keep typing responsive while the authoritative owner acknowledges IPC.
  // Older snapshots must not overwrite a newer keystroke still in the queue.
  const optimisticDrafts = useRef<Record<string, string>>({});
  const closeRequested = useRef(false);
  const allowClose = useRef(false);
  const redockSent = useRef(false);
  const latestContact = useRef(Date.now());
  const connectedRef = useRef(false);
  const alive = useRef(false);

  const close = useCallback(() => {
    allowClose.current = true;
    void getCurrentWebviewWindow().close().catch(() => undefined);
  }, []);
  const matches = (value: StoryTestWindowIdentity) => value.version === 1 && value.kind === kind && value.sessionId === sessionId;
  const requestSnapshot = useCallback(() => emitTo('main', STORY_TEST_EVENTS.request, { version: 1, kind, sessionId }).catch(() => undefined), [kind, sessionId]);

  const pump = useCallback(() => {
    if (!connectedRef.current || pending.current || !snapshotRef.current || !queue.current.length) return;
    const current = snapshotRef.current;
    const command = queue.current.shift()!;
    const request: StoryTestRequest = { version: 1, sessionId, expectedSequence: current.sequence, commandId: crypto.randomUUID(), command };
    pending.current = { request, acknowledged: false, sentAt: Date.now() };
    const message: StoryTestWindowCommand = { version: 1, kind, sessionId, request };
    void emitTo('main', STORY_TEST_EVENTS.command, message).catch((cause) => {
      // Keep the same pending ID: the owner may have executed it even if the
      // transport failed while returning. Heartbeats retry it safely.
      if (alive.current) setError(String(cause));
      void requestSnapshot();
    });
  }, [kind, sessionId, requestSnapshot]);

  const dispatch = useCallback((command: StoryTestUiCommand) => {
    if (!connectedRef.current || closeRequested.current) return;
    // Intermediate keystrokes need not cross IPC; the last unsent value wins.
    if (command.type === 'editDraft') {
      const scope = draftScope(command.key);
      const edit = { ...command, ...(scope ? { draftEpoch: snapshotRef.current?.draftEpochs[scope] } : {}) };
      optimisticDrafts.current[edit.key] = edit.value;
      setSnapshot((current) => current ? { ...current,
        drafts: { ...current.drafts, [edit.key]: edit.value },
        draftErrors: Object.fromEntries(Object.entries(current.draftErrors).filter(([key]) => key !== edit.key)),
      } : current);
      const previous = queue.current.findIndex((queued) => queued.type === 'editDraft' && queued.key === edit.key);
      if (previous >= 0) queue.current[previous] = edit; else queue.current.push(edit);
    } else queue.current.push(command);
    pump();
  }, [pump]);

  const finishRedock = useCallback(() => {
    if (!closeRequested.current || redockSent.current || !connectedRef.current
      || pending.current || queue.current.length || Object.keys(optimisticDrafts.current).length) return;
    redockSent.current = true;
    void emitTo('main', STORY_TEST_EVENTS.redock, { version: 1, kind, sessionId }).catch((cause) => {
      redockSent.current = false;
      if (alive.current) setError(String(cause));
      void requestSnapshot();
    });
  }, [kind, sessionId, requestSnapshot]);

  const redock = useCallback(() => {
    closeRequested.current = true;
    setClosing(true);
    pump();
    finishRedock();
  }, [pump, finishRedock]);

  useEffect(() => {
    alive.current = true;
    if (!isTauri() || !sessionId) {
      setError('This window requires an active desktop story test.');
      return () => { alive.current = false; };
    }
    let cancelled = false;
    const subscriptions: UnlistenFn[] = [];
    const subscribe = async <T,>(event: string, handler: (value: T) => void) => {
      const unlisten = await listen<T>(event, ({ payload }) => handler(payload), { target: STORY_TEST_LABELS[kind] });
      if (cancelled) unlisten(); else subscriptions.push(unlisten);
    };
    void Promise.all([
      subscribe<StoryTestWindowPacket>(STORY_TEST_EVENTS.snapshot, (packet) => {
        if (!matches(packet) || packet.snapshot?.sessionId !== sessionId) return;
        latestContact.current = Date.now();
        connectedRef.current = true;
        setConnected(true);
        if (snapshotRef.current && packet.snapshot.sequence < snapshotRef.current.sequence) return;
        const current = packet.snapshot;
        const previous = snapshotRef.current;
        for (const scope of ['run', 'scenario'] as const) {
          if (!previous || previous.draftEpochs[scope] === current.draftEpochs[scope]) continue;
          for (const key of Object.keys(optimisticDrafts.current)) if (draftScope(key) === scope) delete optimisticDrafts.current[key];
          queue.current = queue.current.filter((command) => command.type !== 'editDraft' || draftScope(command.key) !== scope);
          const inFlight = pending.current?.request.command;
          if (inFlight?.type === 'editDraft' && draftScope(inFlight.key) === scope) pending.current = undefined;
        }
        snapshotRef.current = current;
        for (const [key, value] of Object.entries(optimisticDrafts.current)) {
          if (current.drafts[key] === value) delete optimisticDrafts.current[key];
        }
        const drafts = optimisticDrafts.current;
        setSnapshot(Object.keys(drafts).length ? { ...current,
          drafts: { ...current.drafts, ...drafts },
          draftErrors: Object.fromEntries(Object.entries(current.draftErrors).filter(([key]) => !(key in drafts))),
        } : current);
        applyInterfaceLocale(current.locale);
        document.documentElement.dataset.theme = current.theme;
        if (packet.font) document.documentElement.style.setProperty('--ef-primary-font', packet.font);
        const request = pending.current;
        if (request?.acknowledged && current.sequence > request.request.expectedSequence) pending.current = undefined;
        pump();
        finishRedock();
      }),
      subscribe<StoryTestWindowAck>(STORY_TEST_EVENTS.ack, (ack) => {
        if (!matches(ack) || pending.current?.request.commandId !== ack.commandId) return;
        latestContact.current = Date.now();
        if (ack.accepted) {
          pending.current.acknowledged = true;
          if ((snapshotRef.current?.sequence ?? -1) > pending.current.request.expectedSequence) pending.current = undefined;
          pump();
          finishRedock();
        } else {
          const rejected = pending.current.request.command;
          pending.current = undefined;
          // Retry typing after resynchronization; never retry story effects automatically.
          const edits = queue.current.filter((command) => command.type === 'editDraft');
          const scope = rejected.type === 'editDraft' ? draftScope(rejected.key) : undefined;
          const canRetry = rejected.type === 'editDraft' && (!scope || rejected.draftEpoch === snapshotRef.current?.draftEpochs[scope]);
          queue.current = canRetry ? [rejected, ...edits] : edits;
          setError(snapshotRef.current?.locale === 'es' ? 'La sesión cambió. Se actualizará antes de continuar.' : 'The session changed. It will refresh before continuing.');
          void requestSnapshot();
        }
      }),
      subscribe<StoryTestWindowIdentity>(STORY_TEST_EVENTS.close, (message) => { if (matches(message)) close(); }),
      subscribe<StoryTestWindowIdentity>(STORY_TEST_EVENTS.redockRequest, (message) => { if (matches(message)) redock(); }),
    ]).then(async () => {
      if (cancelled) return;
      const unlistenClose = await getCurrentWebviewWindow().onCloseRequested((event) => {
        if (allowClose.current) return;
        event.preventDefault();
        redock();
      });
      if (cancelled) { unlistenClose(); return; }
      subscriptions.push(unlistenClose);
      await emitTo('main', STORY_TEST_EVENTS.ready, { version: 1, kind, sessionId });
    }).catch((cause) => { if (!cancelled) setError(String(cause)); });
    const heartbeat = setInterval(() => {
      const elapsed = Date.now() - latestContact.current;
      if (elapsed > 6500) { connectedRef.current = false; setConnected(false); }
      if (elapsed > 12000) {
        if (!pending.current && !queue.current.length && !Object.keys(optimisticDrafts.current).length) close();
        else setError(snapshotRef.current?.locale === 'es'
          ? 'No hay conexión con el editor. Los borradores siguen en esta ventana hasta recuperarla.'
          : 'The editor is disconnected. Drafts remain in this window until it reconnects.');
        void requestSnapshot();
        return;
      }
      const inFlight = pending.current;
      if (connectedRef.current && inFlight && !inFlight.acknowledged && Date.now() - inFlight.sentAt > 2000) {
        inFlight.sentAt = Date.now();
        // Retransmit the same ID; the owner deduplicates already executed effects.
        const message: StoryTestWindowCommand = { version: 1, kind, sessionId, request: inFlight.request };
        void emitTo('main', STORY_TEST_EVENTS.command, message).catch(() => undefined);
      }
      void requestSnapshot();
      finishRedock();
    }, 2000);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); redock(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      alive.current = false;
      cancelled = true;
      clearInterval(heartbeat);
      subscriptions.forEach((unlisten) => unlisten());
      window.removeEventListener('keydown', keydown);
    };
  }, [kind, sessionId, close, pump, redock, finishRedock, requestSnapshot]);

  const es = snapshot?.locale === 'es';
  return <main className="story-test-detached-shell" data-testid={`story-test-detached-${kind}`}>
    <header className="story-test-detached-header" data-tauri-drag-region>
      <span className="story-test-native-grip" data-tauri-drag-region title={es ? 'Arrastra para mover la ventana' : 'Drag to move the window'}>⠿ <span data-tauri-drag-region>{kind === 'preview' ? (es ? 'Prueba' : 'Preview') : 'Debug'}</span></span>
      <button type="button" onClick={redock}>{es ? 'Volver al canvas' : 'Reattach to canvas'}</button>
    </header>
    {!connected && <p role="status">{es ? 'Conectando con el editor…' : 'Connecting to the editor…'}</p>}
    {closing && <p role="status">{es ? 'Conservando borradores antes de volver al canvas…' : 'Preserving drafts before returning to the canvas…'}</p>}
    {error && <p role="alert">{error}<button type="button" onClick={() => { setError(undefined); void requestSnapshot(); }}>{es ? 'Actualizar' : 'Refresh'}</button></p>}
    {snapshot && <>
      <fieldset disabled={!connected || closing} className="story-test-detached-controls"><StoryTestControls snapshot={snapshot} dispatch={dispatch} locale={snapshot.locale} /></fieldset>
      <fieldset disabled={!connected || closing} className="story-test-detached-body">
        {kind === 'preview' ? <StoryTestPreview snapshot={snapshot} dispatch={dispatch} locale={snapshot.locale} /> : <StoryTestDebug snapshot={snapshot} dispatch={dispatch} locale={snapshot.locale} />}
      </fieldset>
    </>}
  </main>;
}
