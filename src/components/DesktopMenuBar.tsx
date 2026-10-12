import { useApplicationEffect } from "./useApplicationActivity.js";
import { useRef, useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { emit } from "@tauri-apps/api/event";
import { isTauriRuntime } from "../utils/appEnvironment.js";
import { useInterfaceLocale } from "../i18n.js";

type MenuItem = { label: string; id?: string; separator?: true; command?: string };
type MenuGroup = { label: string; items: MenuItem[] };

const menuGroups = (spanish: boolean): MenuGroup[] => spanish ? [
  { label: "Archivo", items: [
    { label: "Abrir universo…", id: "pb:file:open" },
    { label: "Guardar cambios", id: "pb:file:save", command: "Ctrl+S" },
    { separator: true, label: "" },
    { label: "Exportar paquete runtime…", id: "pb:file:export-runtime" },
    { label: "Exportar Ink…", id: "pb:file:export-ink" },
    { label: "Exportar SINPO GameData…", id: "pb:file:export-game-data" },
  ] },
  { label: "Editar", items: [
    { label: "Deshacer", id: "pb:edit:undo", command: "Ctrl+Z" },
    { label: "Rehacer", id: "pb:edit:redo", command: "Ctrl+Shift+Z" },
    { separator: true, label: "" },
    { label: "Cortar", command: "cut" }, { label: "Copiar", command: "copy" },
    { label: "Pegar", command: "paste" }, { label: "Seleccionar todo", command: "selectAll" },
  ] },
  { label: "Ver", items: [
    { label: "Espacio de trabajo", id: "pb:view:workspace", command: "Ctrl+2" },
    { label: "Recargar vista", id: "pb:view:reload", command: "Ctrl+R" },
    { separator: true, label: "" },
    { label: "Alternar Recursos", id: "pb:view:toggle-assets" },
    { label: "Alternar Historias", id: "pb:view:toggle-outline" },
    { label: "Alternar Lógica", id: "pb:view:toggle-logic" },
    { label: "Alternar Exportar e importar", id: "pb:view:toggle-export" },
    { label: "Alternar Conectar", id: "pb:view:toggle-connect" },
    { label: "Restablecer disposición", id: "pb:view:reset-layout" },
    { separator: true, label: "" },
    { label: "Tema Everend Forge", id: "pb:style:forge-mono" },
    { label: "Tema WorldNotion", id: "pb:style:worldnotion" },
    { label: "Tema GitHub", id: "pb:style:github" },
    { label: "Tema One Pro", id: "pb:style:one" },
    { label: "Tema Dracula", id: "pb:style:dracula" },
    { label: "Tema Night Owl", id: "pb:style:owl" },
    { label: "Tema Material", id: "pb:style:material" },
    { label: "Cambiar modo claro/oscuro", id: "pb:style:toggle-mode", command: "Ctrl+Shift+T" },
  ] },
  { label: "Ayuda", items: [
    { label: "Acerca de Everend PathBranching", id: "pb:help:about" },
    { label: "Documentación", id: "pb:help:docs" },
  ] },
] : [
  { label: "File", items: [
    { label: "Open Universe…", id: "pb:file:open" },
    { label: "Save Event Edits", id: "pb:file:save", command: "Ctrl+S" },
    { separator: true, label: "" },
    { label: "Export Runtime Package…", id: "pb:file:export-runtime" },
    { label: "Export Ink…", id: "pb:file:export-ink" },
    { label: "Export SINPO GameData…", id: "pb:file:export-game-data" },
  ] },
  { label: "Edit", items: [
    { label: "Undo", id: "pb:edit:undo", command: "Ctrl+Z" },
    { label: "Redo", id: "pb:edit:redo", command: "Ctrl+Shift+Z" },
    { separator: true, label: "" },
    { label: "Cut", command: "cut" }, { label: "Copy", command: "copy" },
    { label: "Paste", command: "paste" }, { label: "Select All", command: "selectAll" },
  ] },
  { label: "View", items: [
    { label: "Workspace", id: "pb:view:workspace", command: "Ctrl+2" },
    { label: "Reload View", id: "pb:view:reload", command: "Ctrl+R" },
    { separator: true, label: "" },
    { label: "Toggle Assets", id: "pb:view:toggle-assets" },
    { label: "Toggle Stories", id: "pb:view:toggle-outline" },
    { label: "Toggle Logic", id: "pb:view:toggle-logic" },
    { label: "Toggle Export & Import", id: "pb:view:toggle-export" },
    { label: "Toggle Connect", id: "pb:view:toggle-connect" },
    { label: "Reset Layout", id: "pb:view:reset-layout" },
    { separator: true, label: "" },
    { label: "Everend Forge Theme", id: "pb:style:forge-mono" },
    { label: "WorldNotion Theme", id: "pb:style:worldnotion" },
    { label: "GitHub Theme", id: "pb:style:github" },
    { label: "One Pro Theme", id: "pb:style:one" },
    { label: "Dracula Theme", id: "pb:style:dracula" },
    { label: "Night Owl Theme", id: "pb:style:owl" },
    { label: "Material Theme", id: "pb:style:material" },
    { label: "Toggle Light/Dark", id: "pb:style:toggle-mode", command: "Ctrl+Shift+T" },
  ] },
  { label: "Help", items: [
    { label: "About Everend PathBranching", id: "pb:help:about" },
    { label: "Documentation", id: "pb:help:docs" },
  ] },
];

export function DesktopMenuBar({ onHome }: { onHome?: () => void }) {
  const locale = useInterfaceLocale();
  const [openGroup, setOpenGroup] = useState<string>();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const homeItemRef = useRef<HTMLButtonElement>(null);
  const homeTriggerRef = useRef<HTMLButtonElement>(null);
  const spanish = locale === "es";
  const desktopMenuAvailable = isTauriRuntime() && !/Mac|iPhone|iPad/.test(navigator.platform);

  useApplicationEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setOpenGroup(undefined);
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setOpenGroup(undefined);
        homeTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  useApplicationEffect(() => {
    if (open) homeItemRef.current?.focus();
  }, [open]);

  const invoke = async (item: MenuItem) => {
    if (item.command && !item.id) {
      document.execCommand(item.command);
    } else if (item.id) {
      await emit("pathbranching-menu", item.id);
    }
    setOpen(false);
    setOpenGroup(undefined);
  };

  const goHome = async () => {
    if (onHome) onHome();
    else await emit("pathbranching-menu", "pb:view:home");
    setOpen(false);
    setOpenGroup(undefined);
  };

  return (
    <nav className="pb-desktop-menu" aria-label={spanish ? "Menú de la aplicación" : "Application menu"} ref={menuRef}>
      <button
        ref={homeTriggerRef}
        type="button"
        className={`dock-icon-button pb-home-menu-trigger ${open ? "active" : ""}`}
        title={spanish ? "Inicio y menú de la aplicación" : "Home and application menu"}
        aria-label={spanish ? "Inicio y menú de la aplicación" : "Home and application menu"}
        aria-haspopup={desktopMenuAvailable ? "menu" : undefined}
        aria-expanded={desktopMenuAvailable ? open : undefined}
        onClick={() => {
          if (!desktopMenuAvailable) {
            if (onHome) onHome();
            else void emit("pathbranching-menu", "pb:view:home");
            return;
          }
          setOpen(current => !current);
          setOpenGroup(undefined);
        }}
      >
        <Home size={15} />
      </button>
      {desktopMenuAvailable && open ? <div className="pb-home-menu-popover" role="menu" aria-label={spanish ? "Menú de la aplicación" : "Application menu"}>
        <button ref={homeItemRef} className="pb-home-menu-item" type="button" role="menuitem" onClick={() => { void goHome(); }}>
          <Home size={14} aria-hidden="true" />
          <span>{spanish ? "Volver al Home" : "Back to Home"}</span>
        </button>
        <div className="pb-desktop-menu-separator" role="separator" />
        {menuGroups(spanish).map((group) => (
          <div className="pb-desktop-menu-group" key={group.label}>
            <button type="button" className={openGroup === group.label ? "active" : ""} role="menuitem" aria-haspopup="menu" aria-expanded={openGroup === group.label} onClick={() => setOpenGroup(current => current === group.label ? undefined : group.label)}>
              <span>{group.label}</span><ChevronRight size={14} aria-hidden="true" />
            </button>
            {openGroup === group.label ? <div className="pb-desktop-menu-popover pb-desktop-menu-submenu" role="menu" aria-label={group.label}>
              {group.items.map((item, index) => item.separator
                ? <div className="pb-desktop-menu-separator" role="separator" key={`${group.label}-separator-${index}`} />
                : <button type="button" role="menuitem" key={`${group.label}-${item.label}`} onClick={() => { void invoke(item); }}>
                  <span>{item.label}</span><kbd>{item.command?.startsWith("Ctrl+") ? item.command : ""}</kbd>
                </button>)}
            </div> : null}
          </div>
        ))}
      </div> : null}
    </nav>
  );
}
