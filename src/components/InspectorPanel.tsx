import type { ReactNode } from "react";

/** Shared section framing for the authoring inspector. */
export function InspectorPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="inspector-panel" aria-label={title}><h2 className="inspector-panel-title">{title}</h2>{children}</section>;
}
