import { hasInteractions } from '../interactions.js';
import { AlertTriangle, CheckCircle2, Download, Eye, FileCode2, FileUp, LocateFixed, OctagonAlert, Package } from "lucide-react";
import { memo, useId, useMemo, useRef, useState, type ChangeEvent, type ComponentType, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { exportRuntimePackage } from "../exportRuntime.js";
import { modularExportDiagnostics } from "../exportCompatibility.js";
import { buildExportPreview, type ExportPreviewMode } from "../exportPreview.js";
import type { BranchingProject } from "../domain.js";
import { authoringDiagnosticTarget, diagnosticSelection } from "../diagnosticPresentation.js";
import { useInterfaceLocale } from "../i18n.js";
import { inspectTwineHtml, TWINE_FORMAT, TWINE_FORMAT_VERSION } from "../twineFormat.js";
import { ExplorerPane } from "./ExplorerPresentation.js";
import { WorkspaceSidePanel } from "./WorkspaceSidePanel.js";
import "../authoringControls.css";

type ExportDiagnostic = { location?: string; message: string; label?: string; technical?: string; canLocate?: boolean };
type ExportStatus = "available" | "limited" | "blocked";

const copy = {
  en: {
    modularRuntimeNote: "Includes the story's copies, actions, rules and saved initial scenarios. Execution requires a consumer that supports modular authoring; reading the event nodes alone is insufficient.",
    modularProjectionNote: "This is a partial projection. It does not preserve modular actions, triggered rules, copy ownership or the full initial state. Use Enhanced to retain the authored model.",
    title: "Export & Import", tabs: "Export and import views", export: "Export", import: "Import", available: "Available", limited: "Limited", blocked: "Blocked", preview: "Review output", download: "Export file", locate: "Locate", enhanced: "Runtime Package · Enhanced", enhancedDescription: "JSON · ordered routes and conditional logic", legacy: "Runtime Package · Legacy", legacyDescription: "JSON · compatibility with earlier consumers", legacySummary: "Earlier runtime profile", inkDescription: "Ink · executable conditions and consequences", twineDescription: "HTML · SugarCube", gameDataDescription: "JSON · SINPO projection", projectionNote: "Full equivalence of conditions and consequences is not guaranteed in this format. Review the output before using it.", legacyBlocked: "This profile cannot preserve the current story's conditional logic. Use Enhanced.", importTwine: "Import Twine 2 / SugarCube", importDescription: "Reads passages, links, tags and canvas positions", choose: "Choose HTML file", importSequence: "Import as new sequence", passage: "passages", entry: "entry", first: "first passage", importNote: "SugarCube macros remain in the passage text.", target: "Target", unsupported: "Coming soon · adapter not installed", moreFormats: "More formats", moreNote: "Coming soon · configurable adapters", expected: "Expected", found: "found", nodes: "nodes", files: "files", formatCause: "Export is blocked", pendingPreview: "Output preview is unavailable.",
  },
  es: {
    modularRuntimeNote: "Incluye las copias, acciones, reglas y escenarios iniciales guardados de la historia. Su ejecución requiere un consumidor compatible con la autoría modular; leer solo los nodos de eventos no basta.",
    modularProjectionNote: "Esta es una proyección parcial. No conserva las acciones modulares, reglas activadas, propiedad de copias ni el estado inicial completo. Usa Ampliado para conservar el modelo de autoría.",
    title: "Exportar e importar", tabs: "Vistas de exportación e importación", export: "Exportar", import: "Importar", available: "Disponible", limited: "Limitado", blocked: "Bloqueado", preview: "Revisar salida", download: "Exportar archivo", locate: "Localizar", enhanced: "Paquete runtime · Ampliado", enhancedDescription: "JSON · rutas ordenadas y lógica condicional", legacy: "Paquete runtime · Anterior", legacyDescription: "JSON · compatibilidad con consumidores anteriores", legacySummary: "Perfil runtime anterior", inkDescription: "Ink · condiciones y consecuencias ejecutables", twineDescription: "HTML · SugarCube", gameDataDescription: "JSON · proyección SINPO", projectionNote: "Este formato no garantiza la equivalencia completa de condiciones y consecuencias. Revisa la salida antes de utilizarla.", legacyBlocked: "Este perfil no puede conservar la lógica condicional de la historia actual. Usa el perfil Ampliado.", importTwine: "Importar Twine 2 / SugarCube", importDescription: "Lee pasajes, enlaces, etiquetas y posiciones del canvas", choose: "Elegir archivo HTML", importSequence: "Importar como nueva secuencia", passage: "pasajes", entry: "inicio", first: "primer pasaje", importNote: "Las macros de SugarCube permanecen en el texto del pasaje.", target: "Destino", unsupported: "Próximamente · adaptador no instalado", moreFormats: "Más formatos", moreNote: "Próximamente · adaptadores configurables", expected: "Se esperaba", found: "se encontró", nodes: "nodos", files: "archivos", formatCause: "La exportación está bloqueada", pendingPreview: "La vista previa de salida no está disponible.",
  },
} as const;

const modularCauseCopy: Record<string, [string, string]> = {
  'interactions-v1': ['This format cannot execute interactions, their results or wait barriers. Use Enhanced JSON or YAML.', 'Este formato no puede ejecutar interacciones, sus resultados ni barreras de espera. Usa Ampliado JSON o YAML.'],
  "narrative-actions": ["This Ink profile cannot execute narrative actions, calls or returns. Use Enhanced to retain them.", "Este perfil de Ink no puede ejecutar acciones narrativas, llamadas ni retornos. Usa Ampliado para conservarlos."],
  "narrative-rules": ["This Ink profile cannot execute triggered narrative rules or their priorities. Use Enhanced.", "Este perfil de Ink no puede ejecutar reglas narrativas activadas ni sus prioridades. Usa Ampliado."],
  "entity-instances": ["This Ink profile cannot preserve individual copies and their ownership. Use Enhanced.", "Este perfil de Ink no puede conservar las copias individuales ni su propietario. Usa Ampliado."],
  "entity-overrides": ["This Ink profile cannot preserve entity capability exceptions. Use Enhanced.", "Este perfil de Ink no puede conservar las excepciones de capacidad por entidad. Usa Ampliado."],
  "container-capabilities": ["This Ink profile cannot preserve container capabilities. Use Enhanced.", "Este perfil de Ink no puede conservar las capacidades de contenedor. Usa Ampliado."],
  "initial-state": ["This Ink profile cannot preserve the authored initial state. Use Enhanced.", "Este perfil de Ink no puede conservar el estado inicial de la historia. Usa Ampliado."],
  "player-profiles": ["This Ink profile cannot preserve player actors and initial profile values. Use Enhanced.", "Este perfil de Ink no puede conservar los actores y valores iniciales de los perfiles. Usa Ampliado."],
  "authoring-scenarios": ["This Ink profile cannot preserve saved initial scenarios. Use Enhanced.", "Este perfil de Ink no puede conservar los escenarios iniciales guardados. Usa Ampliado."],
  "narrative-effects": ["This Ink profile cannot execute modular narrative effects. Use Enhanced.", "Este perfil de Ink no puede ejecutar las consecuencias narrativas modulares. Usa Ampliado."],
  "entry-repeat": ["This Ink profile cannot preserve the chosen once/repeat entry behavior. Use Enhanced.", "Este perfil de Ink no puede conservar la repetición de entrada elegida. Usa Ampliado."],
  "effect-order": ["This Ink profile cannot preserve the order of ordinary and copy effects. Use Enhanced.", "Este perfil de Ink no puede conservar el orden de consecuencias ordinarias y de copias. Usa Ampliado."],
  "instance-query": ["This Ink profile cannot evaluate queries over individual copies. Use Enhanced.", "Este perfil de Ink no puede evaluar consultas sobre copias individuales. Usa Ampliado."],
  "instance-effect": ["This Ink profile cannot create, move, modify or remove individual copies. Use Enhanced.", "Este perfil de Ink no puede crear, mover, modificar ni eliminar copias individuales. Usa Ampliado."],
  "instance-subject": ["This Ink profile cannot resolve references to individual copies. Use Enhanced.", "Este perfil de Ink no puede resolver referencias a copias individuales. Usa Ampliado."],
  "context-subject": ["This Ink profile cannot resolve actor, self or recipient context. Use Enhanced.", "Este perfil de Ink no puede resolver el contexto de actor, entidad o destinatario. Usa Ampliado."],
  "cyclic-once-effects": ["This Ink profile would repeat effects when a route returns to this event. The authored effects run once. Use Enhanced.", "Este perfil de Ink repetiría consecuencias al regresar a este evento. Las consecuencias escritas se ejecutan una sola vez. Usa Ampliado."],
  "nested-event-structure": ["This Ink profile cannot execute child events or return to their parent. Use Enhanced to retain the structure.", "Este perfil de Ink no puede ejecutar eventos hijos ni retornar a su padre. Usa Ampliado para conservar la estructura."],
  "boundary-execution": ["This Ink profile cannot execute event boundary bindings. Use Enhanced to retain them.", "Este perfil de Ink no puede ejecutar las conexiones de entrada y salida del evento. Usa Ampliado para conservarlas."],
};

const inkCauseCopy: Record<string, [string, string]> = {
  "Legacy runtime cannot preserve modular authoring; use the enhanced profile.": ["The earlier runtime profile cannot preserve modular actions, rules or initial state. Use Enhanced.", "El perfil runtime anterior no puede conservar acciones, reglas ni estado inicial modulares. Usa Ampliado."],
  "Only event visits are supported in this Ink profile.": ["This Ink profile supports visits to events only.", "Este perfil de Ink admite visitas a eventos; no admite otros tipos de progreso."],
  "External conditions require an Ink binding; export blocked.": ["An external condition needs an Ink binding before it can be exported.", "Una condición externa necesita una conexión con Ink antes de poder exportarse."],
  "List conditions/effects have no faithful Ink representation in this profile.": ["This Ink profile cannot preserve conditions or effects on lists.", "Este perfil de Ink no puede conservar las condiciones o consecuencias sobre listas."],
  "Authored value does not match its declared type.": ["A value does not match its declared type. Check the condition's value.", "Un valor no coincide con su tipo declarado. Revisa el valor de la condición."],
  "Unrecognized legacy condition.": ["A legacy condition cannot be represented in this Ink profile.", "Una condición antigua no puede representarse en este perfil de Ink."],
  "Boolean state required.": ["This condition requires a true or false state.", "Esta condición necesita un estado verdadero o falso."],
  "Comparison reads an undefined value; Ink cannot preserve unresolved routing.": ["A comparison reads an undefined value. Set that value before exporting to Ink.", "Una comparación lee un valor sin definir. Define ese valor antes de exportar a Ink."],
  "Comparison operands have incompatible types.": ["The values in a comparison have incompatible types.", "Los valores de una comparación tienen tipos incompatibles."],
  "Text/list containment is unsupported by this Ink profile.": ["This Ink profile cannot preserve checks for text or list contents.", "Este perfil de Ink no puede conservar las comprobaciones de contenido de textos o listas."],
  "Ordered comparisons require numbers or ISO dates.": ["Greater/less comparisons need numbers or dates in YYYY-MM-DD format.", "Las comparaciones de mayor o menor necesitan números o fechas con formato YYYY-MM-DD."],
  "External/object effects require an unsupported Ink binding.": ["An external or object effect needs a binding that this Ink profile does not support.", "Una consecuencia externa o de objeto necesita una conexión que este perfil de Ink no admite."],
  "Clear effects can make subsequent routing unresolved; Ink export blocked.": ["Clearing this value could leave later routes unresolved. Ink cannot preserve that behavior.", "Borrar este valor puede dejar rutas posteriores sin resolver. Ink no puede conservar ese comportamiento."],
  "Duplicate Else routes.": ["There is more than one Else route. Keep a single fallback route.", "Hay más de una ruta Else. Conserva una sola ruta para los casos restantes."],
  "Dialogue/script execution is unsupported by this Ink profile.": ["This Ink profile cannot execute the story's dialogue or script structure.", "Este perfil de Ink no puede ejecutar la estructura de diálogos o guiones de esta historia."],
  "Competing automatic routes and choices need an explicit execution policy.": ["Choices and automatic routes compete at this event. Their execution order is not supported by Ink.", "Las opciones y rutas automáticas compiten en este evento. Ink no admite su orden de ejecución."],
  "Decision container effects require unsupported execution semantics.": ["This Ink profile cannot preserve effects attached to the decision container.", "Este perfil de Ink no puede conservar las consecuencias del contenedor de la decisión."],
  "Ink cannot display locked choices; choose hidden availability or another export.": ["Ink cannot show unavailable choices as locked. Use hidden availability or another format.", "Ink no puede mostrar las opciones no disponibles como bloqueadas. Usa disponibilidad oculta u otro formato."],
  "Container entry effects are unsupported in Ink.": ["This Ink profile cannot preserve entry effects for a sequence or branch.", "Este perfil de Ink no puede conservar las consecuencias de entrada de una secuencia o rama."],
  "Missing entry event.": ["Choose an entry event for this story before exporting.", "Selecciona un evento inicial para esta historia antes de exportar."],
  "Legacy runtime cannot preserve conditional logic; use the enhanced profile.": ["The earlier runtime profile cannot preserve conditional logic. Use Enhanced.", "El perfil runtime anterior no puede conservar la lógica condicional. Usa el perfil Ampliado."],
  "Runtime: duplicate node or generated route ID": ["Two runtime nodes share an identifier. Resolve the duplicate before exporting.", "Dos nodos runtime comparten un identificador. Resuelve el duplicado antes de exportar."],
};

function presentDiagnostic(project: BranchingProject, diagnostic: { location?: string; message: string; feature?: string }, locale: "en" | "es"): ExportDiagnostic {
  const location = diagnostic.location ?? "";
  const es = locale === "es";
  const match = (id: string) => location === id || location.startsWith(`${id}/`) || location.startsWith(`${id}.`) || location.startsWith(`${id}:`);
  const event = project.events.filter((item) => match(item.id)).sort((a, b) => b.id.length - a.id.length)[0];
  const labels: string[] = [];
  if (event) {
    labels.push(event.name || (es ? "Evento sin nombre" : "Untitled event"));
    const decision = event.decisions?.find((item) => location.includes(`/${item.id}`));
    if (decision) { labels.push(decision.name || (es ? "Decisión" : "Decision")); const outcome = decision.outcomes.find((item) => location.includes(`/${item.id}`)); if (outcome) labels.push(outcome.visibleText || outcome.name || (es ? "Opción" : "Choice")); }
    const route = event.transitions?.find((item) => location.endsWith(`/${item.id}`) || location === item.id);
    if (route) labels.push(route.label || `${es ? "Ruta a" : "Route to"} ${project.events.find((item) => item.id === route.to)?.name || (es ? "destino" : "destination")}`);
  } else {
    const sequence = project.sequences.find((item) => match(item.id));
    const branch = project.branches.find((item) => match(item.id));
    if (sequence) labels.push(sequence.name); else if (branch) labels.push(branch.title);
    else {
      const owner = [...(project.narrativeActions ?? []), ...(project.narrativeRules ?? []), ...(project.entityInstances ?? []), ...(project.playerProfiles ?? []), ...(project.authoringScenarios ?? [])].find(item => match(item.id));
      if (owner) labels.push(owner.name || owner.id);
    }
  }
  const cause = diagnostic.message.split("\n").at(-1)?.replace(/^Error: /u, "") ?? diagnostic.message;
  let message = (diagnostic.feature ? modularCauseCopy[diagnostic.feature]?.[es ? 1 : 0] : undefined) ?? inkCauseCopy[cause]?.[es ? 1 : 0];
  if (!message && cause.startsWith("Missing entity ")) message = es ? "La condición hace referencia a una entidad que ya no existe. Corrige la referencia para exportar a Ink." : "The condition refers to an entity that no longer exists. Fix the reference to export to Ink.";
  if (!message && cause.startsWith("Destination ")) message = es ? "Una ruta apunta a un nodo interno que este perfil de Ink no puede ejecutar." : "A route targets an internal node that this Ink profile cannot execute.";
  if (!message && cause.startsWith("Unsupported operator ")) message = es ? "El operador de esta condición no está admitido por este perfil de Ink." : "This condition's operator is not supported by this Ink profile.";
  if (!message && cause.startsWith("Unsupported or incompatible effect ")) message = es ? "Una consecuencia usa una operación no admitida o incompatible con el tipo del valor." : "An effect uses an unsupported operation or one incompatible with the value type.";
  return { ...diagnostic, label: labels.join(" › ") || (location === "entry" ? es ? "Inicio de la historia" : "Story entry" : es ? "Historia actual" : "Current story"), message: message ?? (es ? "Este formato no puede representar esta parte de la historia. Revisa los detalles para corregirla o utiliza otro formato." : "This format cannot represent this part of the story. Review the details to resolve it or use another format."), technical: diagnostic.message, canLocate: Boolean(authoringDiagnosticTarget(project, diagnostic.location) ?? diagnosticSelection(project, diagnostic.location)) };
}

function ExportCard({ title, description, status, Icon, mode, primary, note, diagnostics = [], locale, onPreview, onExport, onLocateDiagnostic }: {
  title: string; description: string; status: ExportStatus; Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  mode: ExportPreviewMode; primary?: boolean; note?: string; diagnostics?: ExportDiagnostic[]; locale: "en" | "es";
  onPreview?: (mode: ExportPreviewMode) => void; onExport: (mode: ExportPreviewMode) => void; onLocateDiagnostic?: (location: string) => void;
}) {
  const c = copy[locale];
  const id = useId();
  const StatusIcon = status === "available" ? CheckCircle2 : status === "limited" ? AlertTriangle : OctagonAlert;
  return <section className={`pb-export-card ${primary ? "primary" : ""}`} aria-labelledby={`${id}-title`}>
    <header className="pb-export-card-header">
      <div className="pb-export-card-title"><Icon size={17} aria-hidden={true} /><div><strong id={`${id}-title`}>{title}</strong><small>{description}</small></div></div>
      <span className={`pb-export-status ${status}`}><StatusIcon size={12} aria-hidden="true" />{c[status]}</span>
    </header>
    {note ? <p className="pb-export-limitation" id={`${id}-note`}>{note}</p> : null}
    {diagnostics.map((diagnostic, index) => <div key={`${diagnostic.location ?? "format"}-${index}`} className="pb-export-diagnostic">
      {diagnostic.label ? <strong>{diagnostic.label}</strong> : null}
      <p>{diagnostic.message}</p>
      {diagnostic.technical ? <details className="pb-export-technical"><summary>{locale === "es" ? "Detalles técnicos" : "Technical details"}</summary>{diagnostic.location ? <code>{diagnostic.location}</code> : null}<p>{diagnostic.technical}</p></details> : null}
      {diagnostic.location && diagnostic.canLocate && onLocateDiagnostic ? <button type="button" onClick={() => onLocateDiagnostic(diagnostic.location!)} aria-label={`${c.locate}: ${diagnostic.label}`}><LocateFixed size={13} aria-hidden="true" />{c.locate}</button> : null}
    </div>)}
    <div className="pb-export-card-actions" aria-label={title}>
      {onPreview ? <button type="button" onClick={() => onPreview(mode)} disabled={status === "blocked"} aria-label={`${c.preview}: ${title}`}><Eye size={14} aria-hidden="true" />{c.preview}</button> : null}
      <button type="button" className={primary ? "primary" : ""} onClick={() => onExport(mode)} disabled={status === "blocked"} aria-label={`${c.download}: ${title}`} aria-describedby={note ? `${id}-note` : undefined}><Download size={14} aria-hidden="true" />{c.download}</button>
    </div>
  </section>;
}

function ExportPanelContent({ project, collapsed, onCollapsedChange, onContextMenu, onExport, onPreview, onLocateDiagnostic, onImportTwine, locale: localeOverride }: {
  project: BranchingProject; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void; onExport: (mode: ExportPreviewMode) => void;
  onPreview?: (mode: ExportPreviewMode) => void; onLocateDiagnostic?: (location: string) => void;
  onImportTwine: (source: string, fileName: string) => void; locale?: "en" | "es";
}) {
  const interfaceLocale = useInterfaceLocale();
  const locale = localeOverride ?? interfaceLocale;
  const c = copy[locale];
  const id = useId();
  const previewResult = useMemo(() => {
    try { return { preview: buildExportPreview(project, "runtime"), error: undefined }; }
    catch (error) { return { preview: undefined, error: error instanceof Error ? error.message : String(error) }; }
  }, [project]);
  const legacyError = useMemo(() => {
    try { exportRuntimePackage(project, { profile: "legacy" }); return undefined; }
    catch (error) { return error instanceof Error ? error.message : String(error); }
  }, [project]);
  const preview = previewResult.preview;
  const hasModularAuthoring = (preview?.runtimePackage.pathBranching?.requiredFeatures as string[] | undefined)?.includes("modular-authoring-v1") ?? modularExportDiagnostics(project).length > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const exportTabRef = useRef<HTMLButtonElement>(null);
  const importTabRef = useRef<HTMLButtonElement>(null);
  const [twineFile, setTwineFile] = useState<{ name: string; source: string; summary: ReturnType<typeof inspectTwineHtml> }>();
  const [twineError, setTwineError] = useState<string>();
  const [tab, setTab] = useState<"export" | "import">("export");
  const chooseTwineFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      const source = await file.text(); const summary = inspectTwineHtml(source);
      if (summary.format !== TWINE_FORMAT) throw new Error(`${c.expected} ${TWINE_FORMAT}; ${c.found} ${summary.format}.`);
      setTwineFile({ name: file.name, source, summary }); setTwineError(undefined);
    } catch (error) { setTwineFile(undefined); setTwineError(error instanceof Error ? error.message : String(error)); }
  };
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const next = event.key === "Home" ? "export" : event.key === "End" ? "import" : tab === "export" ? "import" : "export";
    setTab(next); (next === "export" ? exportTabRef : importTabRef).current?.focus();
  };
  const cardProps = { locale, onPreview, onExport, onLocateDiagnostic };
  const globalDiagnostics = useMemo(() => previewResult.error ? [presentDiagnostic(project, { message: previewResult.error }, locale)] : [], [project, previewResult.error, locale]);
  const inkDiagnostics = useMemo(() => preview?.inkExport.diagnostics?.map((diagnostic) => presentDiagnostic(project, diagnostic, locale)) ?? globalDiagnostics, [project, preview, locale, globalDiagnostics]);
  const interactionDiagnostics = useMemo(() => modularExportDiagnostics(project).filter(d => d.feature === 'interactions-v1').map(d => presentDiagnostic(project, d, locale)), [project, locale]);
  return <WorkspaceSidePanel onboardingTarget="pathbranching.export" title={c.title} side="left" collapsed={collapsed} onCollapsedChange={onCollapsedChange} onContextMenu={onContextMenu}>
    <div className="explorer-view-tabs export-view-tabs" role="tablist" aria-label={c.tabs}>
      <button id={`${id}-export-tab`} ref={exportTabRef} type="button" role="tab" tabIndex={tab === "export" ? 0 : -1} aria-selected={tab === "export"} aria-controls={`${id}-export-view`} className={tab === "export" ? "active" : ""} onClick={() => setTab("export")} onKeyDown={tabKey}>{c.export}</button>
      <button id={`${id}-import-tab`} ref={importTabRef} type="button" role="tab" tabIndex={tab === "import" ? 0 : -1} aria-selected={tab === "import"} aria-controls={`${id}-import-view`} className={tab === "import" ? "active" : ""} onClick={() => setTab("import")} onKeyDown={tabKey}>{c.import}</button>
    </div>
    <ExplorerPane active={tab === "import"}><div id={`${id}-import-view`} className="export-panel-list pb-export-list" role="tabpanel" aria-labelledby={`${id}-import-tab`}>
      <section className="format-card">
        <div><FileUp size={16} aria-hidden="true" /><span><strong>{c.importTwine}</strong><small>{c.importDescription}</small></span></div>
        <input ref={inputRef} className="visually-hidden" type="file" accept=".html,text/html" tabIndex={-1} onChange={chooseTwineFile} />
        <button type="button" onClick={() => inputRef.current?.click()}>{c.choose}</button>
        {twineFile ? <div className="format-status success"><span>{twineFile.summary.name}</span><small>{twineFile.summary.passageCount} {c.passage} · {c.entry}: {twineFile.summary.startPassageName ?? c.first}</small><button type="button" onClick={() => onImportTwine(twineFile.source, twineFile.name)}>{c.importSequence}</button></div> : null}
        {twineError ? <div className="format-status error" role="alert">{twineError}</div> : null}
        <small className="format-note">{c.target}: Twine 2 HTML · {TWINE_FORMAT} {TWINE_FORMAT_VERSION}. {c.importNote}</small>
      </section>
      <section className="coming-soon-card"><strong>Harlowe</strong><span>{c.unsupported}</span></section>
    </div></ExplorerPane><ExplorerPane active={tab === "export"}><div id={`${id}-export-view`} className="export-panel-list pb-export-list" role="tabpanel" aria-labelledby={`${id}-export-tab`}>
      <ExportCard {...cardProps} primary title={c.enhanced} description={`${preview?.runtimePackage.nodes.length ?? project.events.length} ${c.nodes} · ${c.enhancedDescription}`} status={previewResult.error ? "blocked" : "available"} Icon={Package} mode="runtime" note={hasModularAuthoring ? c.modularRuntimeNote : undefined} diagnostics={globalDiagnostics} />
      <ExportCard {...cardProps} title={`${c.enhanced} · YAML`} description="YAML · interactions-v1" status={previewResult.error ? 'blocked' : 'available'} Icon={Package} mode="runtimeYaml" diagnostics={globalDiagnostics} />
      <ExportCard {...cardProps} title="Ink" description={`${preview?.inkExport.files.length ?? 0} ${c.files} · ${c.inkDescription}`} status={inkDiagnostics.length ? "blocked" : "available"} Icon={FileCode2} mode="ink" diagnostics={inkDiagnostics} />
      <ExportCard {...cardProps} title="Twine 2 / SugarCube" description={c.twineDescription} status={previewResult.error || hasInteractions(project) ? "blocked" : "limited"} Icon={FileCode2} mode="twine" note={hasInteractions(project) ? undefined : hasModularAuthoring ? c.modularProjectionNote : c.projectionNote} diagnostics={hasInteractions(project) ? interactionDiagnostics : globalDiagnostics} />
      <ExportCard {...cardProps} title="SINPO / Game Data" description={c.gameDataDescription} status={previewResult.error || hasInteractions(project) ? "blocked" : "limited"} Icon={FileCode2} mode="gameData" note={hasInteractions(project) ? undefined : hasModularAuthoring ? c.modularProjectionNote : c.projectionNote} diagnostics={hasInteractions(project) ? interactionDiagnostics : globalDiagnostics} />
      <details className="pb-export-legacy"><summary>{c.legacySummary}</summary><ExportCard {...cardProps} title={c.legacy} description={c.legacyDescription} status={legacyError ? "blocked" : "available"} Icon={Package} mode="runtimeLegacy" note={legacyError ? c.legacyBlocked : undefined} diagnostics={legacyError ? [presentDiagnostic(project, { message: legacyError }, locale)] : []} /></details>
      <section className="coming-soon-card"><strong>{c.moreFormats}</strong><span>{c.moreNote}</span></section>
    </div></ExplorerPane>
  </WorkspaceSidePanel>;
}

export const ExportPanel = memo(ExportPanelContent);
