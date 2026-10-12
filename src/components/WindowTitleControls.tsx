import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useInterfaceLocale } from "../i18n.js";
import { isTauriRuntime } from "../utils/appEnvironment.js";

export function WindowChromeSetup() {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    const window = getCurrentWindow();
    document.documentElement.dataset.windowChrome = "true";

    // Asegura el marco sin decoración durante la carga, antes de que aparezca
    // la barra de la aplicación con sus controles integrados.
    void window.setDecorations(false).catch((error) => {
      console.error("Could not disable native window decorations:", error);
    });

    return () => {
      delete document.documentElement.dataset.windowChrome;
    };
  }, []);

  return null;
}

export function WindowTitleControls() {
  const locale = useInterfaceLocale();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const window = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const refreshMaximized = () => {
      void window.isMaximized().then((value) => {
        if (!disposed) setMaximized(value);
      }).catch(() => undefined);
    };

    refreshMaximized();
    void window.onResized(refreshMaximized).then((stopListening) => {
      unlisten = stopListening;
      if (disposed) stopListening();
    }).catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!isTauriRuntime()) return null;

  const labels = locale === "es"
    ? { minimize: "Minimizar", maximize: "Maximizar", restore: "Restaurar", close: "Cerrar" }
    : { minimize: "Minimize", maximize: "Maximize", restore: "Restore", close: "Close" };

  return (
    <div className="pb-window-title-controls" role="group" aria-label={locale === "es" ? "Controles de ventana" : "Window controls"} data-tauri-drag-region="false">
      <button type="button" className="dock-icon-button" aria-label={labels.minimize} title={labels.minimize} onClick={() => { void getCurrentWindow().minimize(); }}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <button type="button" className="dock-icon-button" aria-label={maximized ? labels.restore : labels.maximize} title={maximized ? labels.restore : labels.maximize} onClick={() => { void getCurrentWindow().toggleMaximize().then(() => getCurrentWindow().isMaximized()).then(setMaximized); }}>
        {maximized ? <Copy size={12} aria-hidden="true" /> : <Square size={12} aria-hidden="true" />}
      </button>
      <button type="button" className="dock-icon-button pb-window-close" aria-label={labels.close} title={labels.close} onClick={() => { void getCurrentWindow().close(); }}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
