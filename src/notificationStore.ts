export type NotificationKind = "info" | "success" | "warning" | "error";
export type NotificationInput = {
  message: string;
  title?: string;
  kind?: NotificationKind;
  source?: string;
  /** Suppress only the transient toast; retain the notification in the bell. */
  silent?: boolean;
  action?: { label: string; run: () => void | Promise<void> };
};
export type NotificationEntry = NotificationInput & {
  id: number;
  kind: NotificationKind;
  createdAt: number;
  unread: boolean;
  count: number;
};
export const NOTIFICATION_DURATION = {
  info: 4000,
  success: 4000,
  warning: 6000,
  error: 8000,
};
export const NOTIFICATION_LIMIT = 50;

/** Session-only presentation state. Never writes universe files or browser storage. */
export function createNotificationStore() {
  let nextId = 0;
  let snapshot: {
    entries: NotificationEntry[];
    toast?: number;
    locale: "en" | "es";
    theme: Record<string, string>;
  } = { entries: [], locale: "en", theme: {} };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(input: NotificationInput) {
      if (!input.message.trim()) return;
      const kind = input.kind ?? "info";
      const recent = snapshot.entries[0];
      if (
        recent &&
        recent.message === input.message &&
        recent.source === input.source &&
        recent.kind === kind &&
        Date.now() - recent.createdAt < 2000
      ) {
        snapshot = {
          ...snapshot,
          entries: [
            { ...recent, ...input, kind, count: recent.count + 1 },
            ...snapshot.entries.slice(1),
          ],
        };
      } else {
        const entry: NotificationEntry = {
          ...input,
          kind,
          id: ++nextId,
          createdAt: Date.now(),
          unread: true,
          count: 1,
        };
        snapshot = {
          ...snapshot,
          entries: [entry, ...snapshot.entries].slice(0, NOTIFICATION_LIMIT),
          toast: input.silent ? snapshot.toast : entry.id,
        };
      }
      emit();
    },
    dismissToast(id: number) {
      if (snapshot.toast === id) {
        snapshot = { ...snapshot, toast: undefined };
        emit();
      }
    },
    remove(id: number) {
      snapshot = {
        ...snapshot,
        entries: snapshot.entries.filter((entry) => entry.id !== id),
        toast: snapshot.toast === id ? undefined : snapshot.toast,
      };
      emit();
    },
    markRead() {
      if (snapshot.entries.some((entry) => entry.unread)) {
        snapshot = {
          ...snapshot,
          entries: snapshot.entries.map((entry) => ({
            ...entry,
            unread: false,
          })),
        };
        emit();
      }
    },
    clear() {
      snapshot = { ...snapshot, entries: [], toast: undefined };
      emit();
    },
    setLocale(locale: "en" | "es") {
      if (snapshot.locale !== locale) {
        snapshot = { ...snapshot, locale };
        emit();
      }
    },
    setTheme(theme: Record<string, string>) {
      if (JSON.stringify(snapshot.theme) !== JSON.stringify(theme)) {
        snapshot = { ...snapshot, theme };
        emit();
      }
    },
  };
}
export type NotificationStore = ReturnType<typeof createNotificationStore>;
