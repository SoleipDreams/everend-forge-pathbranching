import { FileText, GitBranch, Home } from "lucide-react";
import type { BranchingProject } from "../domain.js";
import { serializeEventEvpath, type EvpathParseError } from "../evpathFormat.js";
import { EvpathVisualBuilder } from "./EvpathVisualBuilder.js";

type EvpathApplyOutcome = { errors: EvpathParseError[]; warnings: string[] };

/** Content-only event writing surface. Behaviour and media stay on the canvas. */
export function EventScriptWorkspace({
  project,
  eventId,
  breadcrumb,
  onApplyEvpath,
}: {
  project: BranchingProject;
  eventId: string;
  breadcrumb: Array<{ label: string; onClick: () => void }>;
  onApplyEvpath: (eventId: string, text: string) => EvpathApplyOutcome;
}) {
  const event = project.events.find((candidate) => candidate.id === eventId);
  if (!event) return null;
  const source = serializeEventEvpath(project, eventId);

  return (
    <section className="event-script-workspace event-script-visual-workspace" aria-label={`Event workspace for ${event.name}`}>
      <div className="canvas-modebar event-script-modebar">
        <nav className="canvas-breadcrumb" aria-label="Canvas path">
          {breadcrumb.map((item, index) => (
            <span className="breadcrumb-crumb" key={`${item.label}:${index}`}>
              <button type="button" onClick={item.onClick}>
                {index === 0 ? <Home size={14} /> : <GitBranch size={14} />}
                <span>{item.label}</span>
              </button>
            </span>
          ))}
          <span className="breadcrumb-crumb"><button type="button" className="active" aria-current="page"><FileText size={14} /><span>Visual Builder</span></button></span>
        </nav>
      </div>
      <header className="event-script-header">
        <div><span>{event.name}</span><h2>Visual Builder</h2></div>
        <p>Escribe diálogo, dirección y decisiones. Las notas, imágenes y comportamiento se conservan fuera de este editor.</p>
      </header>
      <EvpathVisualBuilder source={source} onApply={(text) => onApplyEvpath(eventId, text)} />
    </section>
  );
}
