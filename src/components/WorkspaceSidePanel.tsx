import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useInterfaceLocale, authoringUiCopy } from "../i18n.js";

export function WorkspaceSidePanel({
  title,
  side,
  collapsed,
  onCollapsedChange,
  onContextMenu,
  children,
}: {
  title: ReactNode;
  side: "left" | "right";
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const locale = useInterfaceLocale();
  const copy = authoringUiCopy(locale);
  const labels: Record<string, string> = { Assets: copy.assets, Logic: copy.logic, Player: copy.player, Stories: copy.stories, "Export & Import": copy.exportImport, Connect: copy.connect };
  const displayTitle = typeof title === "string" ? labels[title] ?? title : title;
  const openLabel = `${locale === "es" ? "Abrir" : "Open"} ${displayTitle}`;
  const closeLabel = `${locale === "es" ? "Contraer" : "Collapse"} ${displayTitle}`;
  if (collapsed) {
    return (
      <aside className={`side-rail side-rail-${side}`} onContextMenu={onContextMenu}>
        <button type="button" title={openLabel} aria-label={openLabel} aria-expanded="false" onClick={() => onCollapsedChange(false)}>
          <span>{displayTitle}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={`side-panel workspace-side-panel side-panel-${side}`} onContextMenu={onContextMenu}>
      <div className="panel-title">
        <strong>{displayTitle}</strong>
        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          title={closeLabel}
          aria-label={closeLabel}
        >
          {side === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <div className="panel-scroll">{children}</div>
    </aside>
  );
}
