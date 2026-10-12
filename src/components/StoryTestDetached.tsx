import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Fullscreen, Maximize2, Shrink } from 'lucide-react';
import { applyInterfaceLocale } from '../i18n.js';
import type { StoryTestKind, StoryTestRequest, StoryTestSnapshot, StoryTestUiCommand } from '../storyTestController.js';
import { STORY_TEST_EVENTS, STORY_TEST_LABELS, storyTestWindowKind, type StoryTestWindowAck, type StoryTestWindowCommand, type StoryTestWindowIdentity, type StoryTestWindowPacket } from '../storyTestWindows.js';
import { StoryTestGeneralView, storyTestPlayTitle } from './StoryTestViews.js';
// This entry is also mounted directly by desktop hosts, without loading App.
import '../app.css';
import '../forgeTheme.css';
import '../storyTestWindows.css';

export { storyTestWindowKind };

type Pending = { request: StoryTestRequest; acknowledged: boolean; sentAt: number };
const draftScope = (key: string): 'run' | 'scenario' | undefined => key.startsWith('run:') ? 'run' : key.startsWith('scenario:') ? 'scenario' : undefined;

/** Presentation client only: the editor remains the sole owner of execution. */
export function StoryTestDetached({ kind }: { kind: StoryTestKind }) {
  const sessionId = new URLSearchParams(window.location.search).get('session') ?? '';
  const identity: StoryTestWindowIdentity = { version: 1, kind, sessionId };
  const [snapshot, setSnapshot] = useState<StoryTestSnapshot>();
  const [font, setFont] = useState<string>();
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [closing, setClosing] = useState(false);
  const snapshotRef = useRef<StoryTestSnapshot | undefined>(undefined);
  const queue = useRef<StoryTestUiCommand[]>([]);
  const pending = useRef<Pending | undefined>(undefined);
  const resynchronizing = useRef(false);
  // Keep typing responsive while the authoritative owner acknowledges IPC.
  // Older snapshots must not overwrite a newer keystroke still in the queue.
  const optimisticDrafts = useRef<Record<string, string>>({});
  const closeRequested = useRef(false);
  const allowClose = useRef(false);
  const redockSent = useRef(false);
  const latestContact = useRef(Date.now());
  const connectedRef = useRef(false);
  const alive = useRef(false);
  const shell = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const close = useCallback(() => {
    allowClose.current = true;
    void getCurrentWebviewWindow().close().catch(() => undefined);
  }, []);
  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);
  const toggleFullscreen = async () => {
    const element = shell.current;
    if (kind !== 'preview' || !element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch (cause) {
      if (alive.current) setError(String(cause));
    }
  };
  const matches = (value: StoryTestWindowIdentity) => value.version === 1 && value.kind === kind && value.sessionId === sessionId;
  const requestSnapshot = useCallback(() => emitTo('main', STORY_TEST_EVENTS.request, { version: 1, kind, sessionId }).catch(() => undefined), [kind, sessionId]);

  const pump = useCallback(() => {
    if (!connectedRef.current || resynchronizing.current || pending.current || !snapshotRef.current || !queue.current.length) return;
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
    if (kind === 'debug' && command.type === 'debugAttachment' && command.attached) {
      // Freeze this surface immediately, then let the existing drain protocol
      // carry all earlier typing and the attachment command to the editor.
      closeRequested.current = true;
      setClosing(true);
    }
    pump();
  }, [kind, pump]);

  const finishRedock = useCallback(() => {
    if (!closeRequested.current || redockSent.current || !connectedRef.current || resynchronizing.current
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
        resynchronizing.current = false;
        for (const [key, value] of Object.entries(optimisticDrafts.current)) {
          if (current.drafts[key] === value) delete optimisticDrafts.current[key];
        }
        const drafts = optimisticDrafts.current;
        setSnapshot(Object.keys(drafts).length ? { ...current,
          drafts: { ...current.drafts, ...drafts },
          draftErrors: Object.fromEntries(Object.entries(current.draftErrors).filter(([key]) => !(key in drafts))),
        } : current);
        applyInterfaceLocale(current.locale);
        if (packet.font) setFont(packet.font);
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
          resynchronizing.current = true;
          // Typing and attachment are idempotent UI intents. Preserve their
          // order while refreshing; never retry narrative effects automatically.
          const retryable = queue.current.filter((command) => command.type === 'editDraft' || command.type === 'debugAttachment');
          const scope = rejected.type === 'editDraft' ? draftScope(rejected.key) : undefined;
          const canRetry = rejected.type === 'debugAttachment'
            || (rejected.type === 'editDraft' && (!scope || rejected.draftEpoch === snapshotRef.current?.draftEpochs[scope]));
          queue.current = canRetry ? [rejected, ...retryable] : retryable;
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

  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(), elapsedMs = now - last; last = now;
      const current = snapshotRef.current;
      if (document.hasFocus() && document.visibilityState === 'visible' && connectedRef.current && !pending.current && !queue.current.length && current?.active && !current.paused && !current.changed && current.status === 'ready' && current.view?.interactions?.some(x => x.mechanic.kind === 'qte')) dispatch({ type: 'interactionTime', elapsedMs });
    }, 100);
    const reset = () => { last = performance.now(); };
    window.addEventListener('focus', reset); window.addEventListener('blur', reset);
    return () => { clearInterval(timer); window.removeEventListener('focus', reset); window.removeEventListener('blur', reset); };
  }, [dispatch]);

  useEffect(() => {
    if (!snapshot) return;
    const title = storyTestPlayTitle(snapshot);
    document.title = title;
    if (isTauri()) void getCurrentWebviewWindow().setTitle(title).catch((cause) => {
      if (alive.current) setError(String(cause));
    });
  }, [snapshot?.storyName, snapshot?.locale]);

  const es = snapshot?.locale === 'es';
  return <div className="pathbranching-app story-test-detached-app" data-theme={snapshot?.theme ?? 'worldnotion-dark'} style={font ? { '--ef-primary-font': font } as CSSProperties : undefined}>
  <main ref={shell} className={`story-test-detached-shell${fullscreen ? ' fullscreen' : ''}`} data-testid={`story-test-detached-${kind}`} onKeyDown={event => {
    if (event.key === 'Escape' && document.fullscreenElement === shell.current) {
      event.preventDefault(); event.stopPropagation();
      void document.exitFullscreen().catch(() => undefined);
    }
  }}>
    <header className="story-test-detached-header" data-tauri-drag-region>
      <span className="story-test-native-grip" data-tauri-drag-region title={es ? 'Arrastra para mover la ventana' : 'Drag to move the window'}>⠿ <span data-tauri-drag-region>{snapshot ? storyTestPlayTitle(snapshot) : 'Play Mode'}</span></span>
      <button type="button" className="story-test-icon" aria-label={fullscreen ? (es ? 'Salir de pantalla completa' : 'Exit fullscreen') : (es ? 'Pantalla completa' : 'Enter fullscreen')} title={fullscreen ? (es ? 'Salir de pantalla completa' : 'Exit fullscreen') : (es ? 'Pantalla completa' : 'Enter fullscreen')} aria-pressed={fullscreen} onClick={() => { void toggleFullscreen(); }}>{fullscreen ? <Shrink size={15} aria-hidden="true" /> : <Fullscreen size={15} aria-hidden="true" />}</button>
      <button type="button" className="story-test-icon" aria-label={es ? 'Maximizar o restaurar ventana' : 'Maximize or restore window'} title={es ? 'Maximizar o restaurar ventana' : 'Maximize or restore window'} onClick={() => { void getCurrentWebviewWindow().toggleMaximize().catch((cause) => { if (alive.current) setError(String(cause)); }); }}><Maximize2 size={15} aria-hidden="true" /></button>
      <button type="button" onClick={redock}>{es ? 'Volver al canvas' : 'Reattach to canvas'}</button>
    </header>
    {!connected && <p role="status">{es ? 'Conectando con el editor…' : 'Connecting to the editor…'}</p>}
    {closing && <p role="status">{es ? 'Conservando borradores antes de acoplar la ventana…' : 'Preserving drafts before reattaching the window…'}</p>}
    {error && <p role="alert">{error}<button type="button" onClick={() => { setError(undefined); void requestSnapshot(); }}>{es ? 'Actualizar' : 'Refresh'}</button></p>}
    {snapshot && <>
      <fieldset disabled={!connected || closing} className="story-test-detached-body">
        <StoryTestGeneralView snapshot={snapshot} dispatch={dispatch} locale={snapshot.locale} fullscreen={fullscreen} />
      </fieldset>
    </>}
  </main>
  </div>;
}
