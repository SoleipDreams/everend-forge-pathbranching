import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { Bug, ChevronDown, ClipboardList, Pause, Play, RotateCcw, Square, X } from "lucide-react";
import type { Locale } from "../i18n.js";
import type { StoryTestSnapshot, StoryTestUiCommand } from "../storyTestController.js";
import { useApplicationEffect } from "./useApplicationActivity.js";
import "../storyTest.css";

export type StoryTestViewProps = {
  snapshot: StoryTestSnapshot;
  dispatch: (command: StoryTestUiCommand) => void;
  locale?: Locale;
};

const StoryTestPlaybackSettings = lazy(async () => {
  const module = await import("./StoryTestViews.js");
  return { default: module.StoryTestPlaybackSettings };
});

export function storyTestPlayTitle(snapshot: StoryTestSnapshot, locale: Locale = snapshot.locale): string {
  return `Play Mode [${snapshot.storyName.trim() || (locale === "es" ? "Historia sin título" : "Untitled story")}]`;
}

/** Toolbar buttons intentionally have no layer/tab semantics. */
export function StoryTestControls({ snapshot, dispatch, locale = snapshot.locale, compact = false, onOpenPlay, showOptions = true, showScenarioManager = false }: StoryTestViewProps & { compact?: boolean; onOpenPlay?: () => void; showOptions?: boolean; showScenarioManager?: boolean }) {
  const es = locale === "es";
  const [revealed, setRevealed] = useState(false);
  const expanded = !compact || revealed || snapshot.active || snapshot.debugOpen;
  useEffect(() => { if (!snapshot.active && !snapshot.debugOpen) setRevealed(false); }, [snapshot.active, snapshot.debugOpen]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scenarioManagerOpen, setScenarioManagerOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useApplicationEffect(() => {
    if (!menuOpen && !scenarioManagerOpen) return;
    if (menuOpen) controls.current?.querySelector<HTMLSelectElement>("select")?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !controls.current?.contains(event.target)) { setMenuOpen(false); setScenarioManagerOpen(false); } };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuOpen, scenarioManagerOpen]);
  const playbackLabel = !snapshot.active ? storyTestPlayTitle(snapshot, locale) : snapshot.paused ? es ? "Reanudar recorrido" : "Resume run" : es ? "Pausar recorrido" : "Pause run";
  const closeMenu = () => { setMenuOpen(false); menuButton.current?.focus(); };
  return <div ref={controls} className={`story-test-controls nodrag nopan${compact ? " compact" : ""}${expanded ? " expanded" : ""}`} role="group" aria-label={es ? "Controles de Play Mode" : "Play Mode controls"} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape" && (menuOpen || scenarioManagerOpen)) { event.preventDefault(); event.stopPropagation(); closeMenu(); setScenarioManagerOpen(false); } }}>
    <button type="button" className="story-test-icon story-test-play-trigger" aria-label={playbackLabel} title={playbackLabel} aria-expanded={compact ? expanded : undefined} disabled={snapshot.changed || snapshot.status === "ended"} onClick={() => { setRevealed(true); if (!snapshot.active || snapshot.paused) onOpenPlay?.(); dispatch({ type: snapshot.active && !snapshot.paused ? "pause" : "play" }); }}>{snapshot.active && !snapshot.paused ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button>
    {showScenarioManager ? <button type="button" className="story-test-icon story-test-scenario-manager-trigger" aria-label={es ? "Gestionar escenarios" : "Manage scenarios"} title={es ? "Gestionar escenarios" : "Manage scenarios"} aria-expanded={scenarioManagerOpen} onClick={() => { setMenuOpen(false); setScenarioManagerOpen(open => !open); }}><ClipboardList size={15} aria-hidden="true" /></button> : null}
    <span className="story-test-extra-controls" inert={!expanded} aria-hidden={!expanded}>
    <button type="button" className="story-test-icon" aria-label={es ? "Detener y cerrar recorrido" : "Stop and close run"} title={es ? "Detener y cerrar recorrido" : "Stop and close run"} disabled={!snapshot.active && !snapshot.debugOpen} onClick={() => { setRevealed(false); setMenuOpen(false); dispatch({ type: "stop" }); }}><Square size={14} aria-hidden="true" /></button>
    {showOptions ? <button ref={menuButton} type="button" className="story-test-icon" aria-label={es ? "Opciones de Play Mode" : "Play Mode options"} title={es ? "Opciones de Play Mode" : "Play Mode options"} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}><ChevronDown size={13} aria-hidden="true" /></button> : null}
    </span>
    {showOptions && menuOpen ? <div id={menuId} className="story-test-settings" role="dialog" aria-label={es ? "Opciones de Play Mode" : "Play Mode options"}>
      <label className="field-label">{es ? "Escenario inicial" : "Initial scenario"}<select value={snapshot.scenarioId} onChange={event => dispatch({ type: "scenario", id: event.target.value })}><option value="">{es ? "Valores del proyecto" : "Project values"}</option>{snapshot.scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
      <div className="story-test-row"><button type="button" onClick={() => { onOpenPlay?.(); dispatch({ type: "start" }); closeMenu(); }}>{es ? "Desde la entrada" : "From story entry"}</button><button type="button" disabled={!snapshot.selectedNodeId} onClick={() => { onOpenPlay?.(); dispatch({ type: "start", fromSelection: true }); closeMenu(); }}>{es ? "Desde selección" : "From selection"}</button></div>
      {snapshot.active ? <p><button type="button" onClick={() => { onOpenPlay?.(); dispatch({ type: "restart" }); closeMenu(); }}><RotateCcw size={13} aria-hidden="true" /> {snapshot.changed ? es ? "Reiniciar con la nueva revisión" : "Restart with the new revision" : es ? "Reiniciar recorrido" : "Restart run"}</button></p> : null}
      <p><button type="button" onClick={() => { dispatch({ type: "debug", open: true }); closeMenu(); }}><Bug size={13} aria-hidden="true" /> {es ? "Debug y escenarios" : "Debug and scenarios"}</button></p>
      <small>{es ? "El recorrido avanza con Continuar, respuestas y acciones." : "Advance using Continue, responses and actions."}</small>
    </div> : null}
    {showScenarioManager && scenarioManagerOpen ? <section className="story-test-scenario-manager" role="dialog" aria-modal="false" aria-label={es ? "Gestionar escenarios" : "Manage scenarios"}>
      <header><strong>{es ? "Gestionar escenarios" : "Manage scenarios"}</strong><button type="button" className="story-test-icon" aria-label={es ? "Cerrar gestión de escenarios" : "Close scenario manager"} onClick={() => setScenarioManagerOpen(false)}><X size={14} aria-hidden="true" /></button></header>
      <div className="story-test-scenario-manager-content"><Suspense fallback={<p role="status">{es ? "Cargando configuración del escenario…" : "Loading scenario settings…"}</p>}><StoryTestPlaybackSettings snapshot={snapshot} dispatch={dispatch} locale={locale} /></Suspense></div>
    </section> : null}
  </div>;
}
