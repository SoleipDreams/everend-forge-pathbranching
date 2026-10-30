import { useEffect } from "react";
import type { Selection } from "../appTypes.js";
import type { BranchingProject } from "../domain.js";
import { authoringNodeOptions } from "../authoringMutations.js";
import { narrativeInspectorModules } from "../inspectorModules.js";
import { useInterfaceLocale } from "../i18n.js";
import { ActionsEditor, EntityUsesEditor, RulesEditor, type AuthoringMutation } from "./AuthoringStudio.js";
import { NarrativeInspectorSection, type NarrativeEditorProps } from "./NarrativeEditor.js";
import { EvpathEditor, type EvpathApplyOutcome } from "./EvpathEditor.js";
import { GroupedConversationEditor } from './GroupedConversationEditor.js';
import { useSurfaceMotion } from "../useSurfaceMotion.js";
import { InspectorPanel } from "./InspectorPanel.js";
import { scrollInspectorContent } from './scrollInspectorContent.js';

/** Section content only: every entry point uses the shared inspector dock and tabs. */
export function UnifiedAuthoringInspector({ project, selection, section, eventId, dialogueId, selectedNodeId, highlightedNodeId, focusId, navigationRequest, propertiesConfig, onMutation, onSelect, onHighlight, onSectionChange, onOpenSection, onOpenReference, onApplyEvpath }: {
  project: BranchingProject;
  selection?: Selection;
  section: string;
  eventId?: string;
  dialogueId?: string;
  selectedNodeId?: string;
  highlightedNodeId?: string;
  focusId?: string;
  navigationRequest?: NarrativeEditorProps["navigationRequest"];
  propertiesConfig?: Record<string, unknown>;
  onMutation: AuthoringMutation;
  onSelect: (id: string) => void;
  onHighlight?: (id: string) => void;
  onSectionChange?: (section: string) => void;
  onOpenSection?: (nodeId: string, section: string) => void;
  onOpenReference?: (selection: Selection) => void;
  onApplyEvpath: (eventId: string, text: string) => EvpathApplyOutcome;
}) {
  const es = useInterfaceLocale() === "es";
  const surface = useSurfaceMotion<HTMLDivElement>(section);
  useEffect(() => {
    if (!focusId) return;
    if (section === "narrativeDecision" && ["conditions", "consequences", "interactions"].includes(navigationRequest?.section ?? "")) return;
    const frame = requestAnimationFrame(() => {
      const target = surface.current?.querySelector<HTMLElement>(`[data-authoring-id="${CSS.escape(focusId)}"]`);
      if(target)scrollInspectorContent(target,'nearest');
      target?.focus({preventScroll:true});
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId, section, selection?.type, selection?.id, navigationRequest?.section]);
  if (section === "interactions") return null;
  const targets = authoringNodeOptions(project);
  const isOption = selection?.type === "node" && project.events.some(event => event.decisions?.some(decision => decision.outcomes.some(outcome => `outcome:${event.id}:${decision.id}:${outcome.id}` === selection.id)));
  const hasConsequences = selection?.type === "node" && narrativeInspectorModules(project, selection.id)?.some(module => module.id === "consequences");
  const resolvedSection = section === "consequences" && !hasConsequences ? "conditions" : section;
  const studioSection = ["overview", "conditions", "connections"].includes(resolvedSection) ? resolvedSection as "overview" | "conditions" | "connections" : "overview";
  let content;
  if (selection?.type === "narrativeAction") content = <ActionsEditor project={project} context={{ eventId, dialogueId }} focused initialId={selection.id} section={studioSection} targets={targets} onMutation={onMutation} />;
  else if (selection?.type === "narrativeRule") content = <RulesEditor project={project} focused initialId={selection.id} section={studioSection} targets={targets} eventId={eventId} dialogueId={dialogueId} onMutation={onMutation} />;
  else if (selection?.type === "entityInstance") {
    const copy = project.entityInstances?.find(item => item.id === selection.id);
    content = copy ? <EntityUsesEditor project={project} focused initialEntityId={copy.entityId} initialCopyId={copy.id} section={section === "connections" ? "connections" : "copies"} onMutation={onMutation} onLocate={onSelect} /> : <p className="authoring-field-error">{es ? "Esta copia ya no existe." : "This copy no longer exists."}</p>;
  } else if (selection?.type === "canon" || selection?.type === "explorerEntity") {
    content = <EntityUsesEditor project={project} focused initialEntityId={selection.id} section={section === "copies" ? "copies" : section === "connections" ? "connections" : "uses"} onMutation={onMutation} onLocate={onSelect} />;
  } else if (eventId) {
    const narrativeSection = (resolvedSection === "narrativeSequence" ? "path" : resolvedSection === "narrativeDecision" ? "choices" : resolvedSection) as NonNullable<NarrativeEditorProps["section"]>;
    content = <>
      {narrativeSection === 'path' ? <GroupedConversationEditor key={JSON.stringify([project.projectId, eventId, dialogueId])} project={project} eventId={eventId} dialogueId={dialogueId} selectedNodeId={highlightedNodeId ?? selectedNodeId} propertiesConfig={propertiesConfig} onMutation={onMutation} onHighlight={onHighlight ?? onSelect} onOpenSection={onOpenSection} onOpenReference={onOpenReference} /> : <NarrativeInspectorSection project={project} eventId={eventId} dialogueId={dialogueId} selectedNodeId={selectedNodeId} focusId={focusId} navigationRequest={navigationRequest} section={narrativeSection} onMutation={onMutation} onSelect={onSelect} onSectionChange={onSectionChange} onOpenSection={onOpenSection} />}
      {narrativeSection === "path" ? <details className="inspector-source-advanced"><summary>{es ? "Source · avanzado" : "Source · advanced"}</summary><p className="narrative-muted">{es ? "El código conserva su propio borrador recuperable. Aplícalo explícitamente para incorporarlo al documento." : "Source keeps its own recoverable draft. Apply it explicitly to update the document."}</p><EvpathEditor sourceOnly project={project} eventId={eventId} onApply={onApplyEvpath} /></details> : null}
    </>;
  } else content = <p>{es ? "Selecciona contenido, una entidad, una acción o una regla para editarlo." : "Select content, an entity, an action or a rule to edit it."}</p>;
  const titles: Record<string, string> = es
    ? { overview: "Resumen", content: "Contenido", narrativeDecision: "Opciones", decisionSettings: "Decisiones", conditions: "Condiciones", consequences: "Consecuencias", copies: "Copias", uses: "Usos" }
    : { overview: "Overview", content: "Content", narrativeDecision: "Options", decisionSettings: "Decisions", conditions: "Conditions", consequences: "Consequences", copies: "Copies", uses: "Uses" };
  const panelTitle = (isOption && resolvedSection === "content" ? es ? "Opción" : "Option" : titles[resolvedSection]) ?? (resolvedSection === "connections" && selection && selection.type !== "node" ? (es ? "Conexiones" : "Connections") : undefined);
  return <div ref={surface} className={`unified-authoring-inspector${resolvedSection !== "connections" || panelTitle ? " inspector-uniform-content" : ""}`} data-inspector-section={resolvedSection}>{panelTitle ? <InspectorPanel title={panelTitle}>{content}</InspectorPanel> : content}</div>;
}
