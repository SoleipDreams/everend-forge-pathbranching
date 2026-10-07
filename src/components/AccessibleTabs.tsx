import { useId, useRef, type ReactNode } from "react";
import "../accessibleUi.css";

export type AccessibleTab = { id: string; label: ReactNode; disabled?: boolean };

/** Automatic-activation tabs: one tab stop, arrow keys, Home and End. */
export function AccessibleTabs({
  value, tabs, onChange, ariaLabel, className, panelId,
}: {
  value: string;
  tabs: readonly AccessibleTab[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  panelId?: string;
}) {
  const id = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const enabled = tabs.filter((tab) => !tab.disabled);
  const selected = enabled.some((tab) => tab.id === value) ? value : enabled[0]?.id;
  return (
    <nav className={className} role="tablist" aria-label={ariaLabel} aria-orientation="horizontal">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${id}-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={selected === tab.id}
          aria-controls={panelId}
          tabIndex={selected === tab.id ? 0 : -1}
          disabled={tab.disabled}
          className={selected === tab.id ? "active" : ""}
          ref={(element) => {
            if (element) tabRefs.current.set(tab.id, element);
            else tabRefs.current.delete(tab.id);
          }}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (!enabled.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const index = enabled.findIndex((candidate) => candidate.id === tab.id);
            const nextIndex = event.key === "Home" ? 0
              : event.key === "End" ? enabled.length - 1
              : (index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length;
            const next = enabled[nextIndex];
            tabRefs.current.get(next.id)?.focus();
            onChange(next.id);
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
