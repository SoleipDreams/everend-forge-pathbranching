import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CheckCircle2,
  Info,
  AlertTriangle,
  CircleAlert,
  X,
  CheckCheck,
  Trash2,
} from "lucide-react";
import {
  createNotificationStore,
  NOTIFICATION_DURATION,
  type NotificationInput,
  type NotificationStore,
} from "./notificationStore";
import "./notifications.css";

export type NotificationHost = {
  publish: (input: NotificationInput) => void;
  renderBell: (active?: boolean) => ReactNode;
};
const fallbackStore = createNotificationStore();
const Context = createContext<{
  store: NotificationStore;
  host?: NotificationHost;
  source?: string;
  active: boolean;
}>({ store: fallbackStore, active: true });
const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: CircleAlert,
};
function runAction(
  store: NotificationStore,
  entry: ReturnType<NotificationStore["getSnapshot"]>["entries"][number],
) {
  void Promise.resolve()
    .then(() => entry.action?.run())
    .catch((error) =>
      store.publish({
        message: error instanceof Error ? error.message : String(error),
        source: entry.source,
        kind: "error",
      }),
    );
}

export function NotificationProvider({
  children,
  host,
  source,
  active = true,
}: {
  children: ReactNode;
  host?: NotificationHost;
  source?: string;
  active?: boolean;
}) {
  const [store] = useState(createNotificationStore);
  return (
    <Context.Provider value={{ store, host, source, active }}>
      {children}
      {!host && <NotificationToasts />}
    </Context.Provider>
  );
}
export function useNotify() {
  const { store, host, source } = useContext(Context);
  return useCallback(
    (input: NotificationInput) =>
      (host?.publish ?? store.publish)({
        ...input,
        source: input.source ?? source,
      }),
    [store, host?.publish, source],
  );
}
/** Captures changes in existing operation state without clearing drafts or errors. */
export function useNotificationMessage(
  message: string | undefined,
  kind: NotificationInput["kind"] = "info",
  options?: Omit<NotificationInput, "message" | "kind">,
) {
  const notify = useNotify();
  const previous = useRef<string | undefined>(undefined);
  const current = useRef(options);
  current.current = options;
  useEffect(() => {
    if (message && message !== previous.current)
      notify({ ...current.current, message, kind });
    previous.current = message;
  }, [message, kind, notify]);
}
export function NotificationBell({
  locale = "en",
  enabled = true,
}: {
  locale?: "en" | "es";
  enabled?: boolean;
}) {
  const { store, host, active: contextActive } = useContext(Context);
  const active = contextActive && enabled;
  const data = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 52, right: 8 });
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null);
  const id = useId();
  const es = locale === "es";
  const unread = data.entries.filter((entry) => entry.unread).length;
  useEffect(() => {
    if (!host) store.setLocale(locale);
  }, [store, host, locale]);
  useLayoutEffect(() => {
    if (
      host ||
      !active ||
      !trigger.current ||
      !trigger.current.getClientRects().length
    )
      return;
    const style = getComputedStyle(trigger.current),
      theme: Record<string, string> = {};
    for (const name of [
      "--ef-panel",
      "--ef-text",
      "--ef-muted",
      "--ef-border",
      "--ef-accent",
      "--ef-accent-soft",
      "--ef-bg",
      "--ef-danger",
    ]) {
      const value = style.getPropertyValue(name).trim();
      if (value) theme[name] = value;
    }
    store.setTheme(theme);
  });
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  useEffect(() => {
    if (open) {
      store.markRead();
      if (data.toast !== undefined) store.dismissToast(data.toast);
    }
  }, [open, data.entries, data.toast, store]);
  useLayoutEffect(() => {
    if (!open || host) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          top: Math.min(rect.bottom + 8, window.innerHeight - 120),
          right: Math.max(8, window.innerWidth - rect.right),
        });
    };
    place();
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
    };
  }, [open, host]);
  if (host) return <>{host.renderBell(active)}</>;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="ef-notification-bell"
        aria-label={`${es ? "Notificaciones" : "Notifications"}${unread ? ` (${unread})` : ""}`}
        title={es ? "Notificaciones" : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        data-tauri-drag-region="false"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span className="ef-notification-badge" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open &&
        active &&
        createPortal(
          <section
            ref={panel}
            id={id}
            className="ef-notification-center"
            role="dialog"
            aria-label={es ? "Centro de notificaciones" : "Notification center"}
            style={{
              ...data.theme,
              top: position.top,
              right: position.right,
              maxHeight: `calc(100dvh - ${position.top + 8}px)`,
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
          >
            <header>
              <strong>{es ? "Notificaciones" : "Notifications"}</strong>
              <button
                type="button"
                title={es ? "Marcar como leídas" : "Mark as read"}
                aria-label={es ? "Marcar como leídas" : "Mark as read"}
                onClick={store.markRead}
              >
                <CheckCheck size={16} />
              </button>
              <button
                type="button"
                aria-label={
                  es ? "Vaciar notificaciones" : "Clear notifications"
                }
                disabled={!data.entries.length}
                onClick={store.clear}
              >
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                aria-label={
                  es ? "Cerrar notificaciones" : "Close notifications"
                }
                onClick={close}
              >
                <X size={16} />
              </button>
            </header>
            <div className="ef-notification-list">
              {!data.entries.length && (
                <p className="ef-notification-empty">
                  {es
                    ? "No hay notificaciones en esta sesión."
                    : "No notifications this session."}
                </p>
              )}
              {data.entries.map((entry) => {
                const Icon = icons[entry.kind];
                return (
                  <article
                    key={entry.id}
                    className={`ef-notification-entry kind-${entry.kind}`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <div>
                      {entry.title && <strong>{entry.title}</strong>}
                      <p>{entry.message}</p>
                      <small>
                        {entry.source && <span>{entry.source} · </span>}
                        <time
                          dateTime={new Date(entry.createdAt).toISOString()}
                        >
                          {new Date(entry.createdAt).toLocaleTimeString(
                            es ? "es" : "en",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </time>
                        {entry.count > 1 && ` · ×${entry.count}`}
                      </small>
                      {entry.action && (
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            runAction(store, entry);
                          }}
                        >
                          {entry.action.label}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label={`${es ? "Quitar notificación" : "Remove notification"}: ${entry.message}`}
                      onClick={() => store.remove(entry.id)}
                    >
                      <X size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
            <footer>
              {es
                ? "Historial de esta sesión · hasta 50 avisos"
                : "Session history · up to 50 notices"}
            </footer>
          </section>,
          document.body,
        )}
    </>
  );
}

function NotificationToasts() {
  const { store, active } = useContext(Context);
  const data = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const entry = data.entries.find((item) => item.id === data.toast);
  return active && entry ? (
    <TransientNotification
      key={entry.id}
      store={store}
      entry={entry}
      locale={data.locale}
    />
  ) : null;
}
function TransientNotification({
  store,
  entry,
  locale,
}: {
  store: NotificationStore;
  entry: ReturnType<NotificationStore["getSnapshot"]>["entries"][number];
  locale: "en" | "es";
}) {
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [hidden, setHidden] = useState(document.hidden);
  const remaining = useRef(NOTIFICATION_DURATION[entry.kind]);
  const paused = hovered || focused || hidden;
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const timer = window.setTimeout(
      () => store.dismissToast(entry.id),
      remaining.current,
    );
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
    };
  }, [paused, store, entry.id]);
  const Icon = icons[entry.kind];
  const es = locale === "es";
  return createPortal(
    <aside
      className={`ef-notification-toast kind-${entry.kind}`}
      style={store.getSnapshot().theme as CSSProperties}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <Icon size={18} aria-hidden="true" />
      <div role="status" aria-live="polite" aria-atomic="true">
        {entry.title && <strong>{entry.title}</strong>}
        <p>{entry.message}</p>
        {entry.source && <small>{entry.source}</small>}
      </div>
      {entry.action && (
        <button
          type="button"
          onClick={() => {
            store.dismissToast(entry.id);
            runAction(store, entry);
          }}
        >
          {entry.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={es ? "Cerrar aviso" : "Dismiss notice"}
        onClick={() => store.dismissToast(entry.id)}
      >
        <X size={16} />
      </button>
    </aside>,
    document.body,
  );
}
