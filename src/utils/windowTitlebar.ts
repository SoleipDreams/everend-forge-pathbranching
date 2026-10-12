import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./appEnvironment.js";

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    "button, a, input, select, textarea, summary, details, [role='button'], [role='link'], [role='menu'], [role^='menuitem'], [contenteditable='true'], [data-tauri-drag-region='false']",
  ));
}

export function handleWindowTitlebarMouseDown(event: Pick<MouseEvent, "button" | "detail" | "target">) {
  if (!isTauriRuntime() || event.button !== 0 || isInteractiveTarget(event.target)) return;

  const window = getCurrentWindow();
  const action = event.detail === 2 ? window.toggleMaximize() : window.startDragging();
  void action.catch(() => undefined);
}
