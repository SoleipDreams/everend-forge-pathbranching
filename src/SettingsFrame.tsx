import { Children, Fragment, cloneElement, createContext, isValidElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { Search, X, ArrowLeft } from "lucide-react";
import { findSettings, normalizeSettingsSearch, settingsText, type SettingsDraft, type SettingsHost, type SettingsPage } from "./settingsIntegration";
import { translateSettings } from "./settingsCopy";
import "./settingsFrame.css";

const DraftContext = createContext<((id: string, draft: SettingsDraft) => () => void) | undefined>(undefined);
export function useSettingsDraft(id: string, draft: SettingsDraft) {
  const register = useContext(DraftContext);
  const current = useRef(draft);
  current.current = draft;
  useEffect(() => register?.(id, {
    dirty: draft.dirty, busy: draft.busy,
    save: () => current.current.save(), discard: () => current.current.discard(),
  }), [register, id, draft.dirty, draft.busy]);
}
/** Translate static legacy presentation without changing control values, IDs, or callbacks. */
export function settingsContent(node: ReactNode, locale: "en" | "es"): ReactNode {
  return Children.map(node, child => {
    if (typeof child === "string") return translateSettings(child, locale);
    if (!isValidElement(child) || (typeof child.type !== "string" && child.type !== Fragment)) return child;
    const element = child as ReactElement<Record<string, unknown>>;
    const props: Record<string, unknown> = {};
    for (const key of ["title", "placeholder", "aria-label"]) {
      if (typeof element.props[key] === "string") props[key] = translateSettings(element.props[key] as string, locale);
    }
    return cloneElement(element, props, settingsContent(element.props.children as ReactNode, locale));
  });
}
const focusSelector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]';
function available(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(focusSelector)).filter(item => item.getClientRects().length && !item.closest("[hidden], [inert]"));
}
export function SettingsDraftBar({ draft, locale }: { draft: SettingsDraft; locale: "en" | "es" }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const es = locale === "es";
  if (!draft.dirty && !draft.busy && !saving && !error) return null;
  return <div className="ef-settings-draft">
    <span role="status">{draft.busy || saving ? es ? "Guardando…" : "Saving…" : es ? "Cambios sin guardar" : "Unsaved changes"}</span>
    <button type="button" disabled={draft.busy || saving} onClick={() => { draft.discard(); setError(""); }}>{es ? "Descartar" : "Discard"}</button>
    <button type="button" disabled={draft.busy || saving} onClick={async () => { setSaving(true); setError(""); try { await draft.save(); } catch (cause) { setError(String(cause)); } finally { setSaving(false); } }}>{es ? "Guardar" : "Save"}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
export function SettingsFrame({
  title, locale, pages, page, onPage, visible = true, onClose, children, host,
  hasUniverse = true, draft, onHelp, restoreFocusTarget, contentClassName = "", footer, requestExitRef, helpPage,
}: {
  title: string; locale: "en" | "es"; pages: SettingsPage[]; page: string;
  onPage: (page: string, control?: string) => void; visible?: boolean; onClose: () => void;
  children?: ReactNode; host?: SettingsHost; hasUniverse?: boolean; draft?: SettingsDraft;
  onHelp?: () => void; restoreFocusTarget?: HTMLElement; contentClassName?: string; footer?: ReactNode; helpPage?: string; requestExitRef?: MutableRefObject<((after?: () => void) => void) | null>;
}) {
  const es = locale === "es";
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const nested = useRef(new Map<string, SettingsDraft>());
  const [revision, setRevision] = useState(0);
  const registerNested = useRef((id: string, value: SettingsDraft) => {
    nested.current.set(id, value); setRevision(value => value + 1);
    return () => { if (nested.current.get(id) === value) { nested.current.delete(id); setRevision(value => value + 1); } };
  }).current;
  const [query, setQuery] = useState("");
  const [focusControl, setFocusControl] = useState<string>();
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (confirmClose) dialog.current?.querySelector<HTMLElement>(".ef-settings-confirm button")?.focus(); }, [confirmClose]);
  const currentPage = pages.find(candidate => candidate.id === page);
  const active = host ? host.visible && Boolean(currentPage) : visible;
  const owner = pages[0]?.owner ?? title;
  const dirtyDrafts = () => [draftRef.current, ...nested.current.values()].filter((item): item is SettingsDraft => Boolean(item?.dirty || item?.busy));
  const currentDrafts = dirtyDrafts();
  const hasDrafts = Boolean(currentDrafts.length);
  const busy = currentDrafts.some(item => item.busy) || saving;
  useEffect(() => host?.register(owner, pages), [host?.register, owner, pages]);
  useEffect(() => {
    if (!host) return;
    return host.registerDraft(owner, {
      dirty: hasDrafts, busy,
      save: async () => { for (const item of dirtyDrafts()) await item.save(); },
      discard: () => { for (const item of dirtyDrafts()) item.discard(); },
    });
  }, [host?.registerDraft, owner, hasDrafts, busy, revision]);
  const pendingExit = useRef<(() => void) | undefined>(undefined);
  const completeClose = () => { closeRef.current(); const action = pendingExit.current; pendingExit.current = undefined; if (action) queueMicrotask(action); };
  const requestClose = (after?: () => void) => {
    pendingExit.current = after;
    if (dirtyDrafts().length) { setConfirmClose(true); setError(""); }
    else completeClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useLayoutEffect(() => { if (!requestExitRef) return; requestExitRef.current = after => requestCloseRef.current(after); return () => { requestExitRef.current = null; }; }, [requestExitRef]);
  useEffect(() => {
    if (host || !visible) return;
    const element = dialog.current;
    if (!element) return;
    const opener = restoreFocusTarget ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
    available(element)[0]?.focus();
    const trap = (event: FocusEvent) => { if (!element.contains(event.target as Node)) (available(element)[0] ?? element).focus(); };
    document.addEventListener("focusin", trap);
    return () => {
      document.removeEventListener("focusin", trap);
      queueMicrotask(() => {
        if (!element.isConnected || element.closest("[hidden]")) {
          if (opener?.isConnected && !opener.closest("[inert], [hidden]")) opener.focus();
        }
      });
    };
  }, [visible, host !== undefined, restoreFocusTarget]);
  useEffect(() => { if (!active) { setQuery(""); setConfirmClose(false); setError(""); } }, [active]);
  useLayoutEffect(() => {
    const root = content.current;
    if (!root || !active || !currentPage || (query && !host)) return;
    for (const control of currentPage.controls) {
      const names = [control.label.en, control.label.es, ...(control.match ?? [])].map(normalizeSettingsSearch);
      const labels = [...root.querySelectorAll<HTMLElement>("label, button, summary, h3, h4, [aria-label]")].filter(item => item.getClientRects().length && !item.closest("[hidden], [inert]"));
      labels.sort((a,b) => (a.tagName === "LABEL" ? 0 : /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) ? 1 : a.tagName === "BUTTON" ? 2 : 3) - (b.tagName === "LABEL" ? 0 : /^(INPUT|SELECT|TEXTAREA)$/.test(b.tagName) ? 1 : b.tagName === "BUTTON" ? 2 : 3));
      const label = labels.find(item => {
        const text = item.tagName === "LABEL" ? item.querySelector("span, strong")?.textContent ?? item.textContent : item.getAttribute("aria-label") ?? item.textContent;
        return names.includes(normalizeSettingsSearch(text ?? ""));
      });
      if (label) label.dataset.settingId = control.id;
    }
    const id = host?.focusControl ?? focusControl;
    if (!id) { root.scrollTop = 0; return; }
    const target = [...root.querySelectorAll<HTMLElement>("[data-setting-id]")].find(item => item.dataset.settingId === id && item.getClientRects().length && !item.closest("[hidden], [inert]"));
    if (!target) return;
    for (let parent = target.parentElement; parent && parent !== root; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    target.scrollIntoView?.({ block: "center", behavior: "instant" });
    const input = target.matches(focusSelector) ? target : target.querySelector<HTMLElement>(focusSelector);
    if (!input) target.tabIndex = -1;
    (input ?? target).focus();
    target.classList.add("ef-setting-found");
    const timeout = window.setTimeout(() => target.classList.remove("ef-setting-found"), 1800);
    return () => window.clearTimeout(timeout);
  }, [page, active, host?.focusControl, focusControl, locale, query]);
  const body = <DraftContext.Provider value={host?.registerDraft ?? registerNested}>
    <div ref={content} className={`ef-settings-content ${contentClassName}`} hidden={Boolean(host && !active)} data-settings-page={page}>
      {currentPage?.requiresUniverse && !hasUniverse ? <p className="ef-settings-empty" role="status">{es ? "Abre un universo para modificar estos ajustes." : "Open a universe to edit these settings."}</p> : <>
        {currentPage && !host && <div className="ef-settings-page-heading"><h3>{settingsText(currentPage.title, locale)}</h3>{currentPage.description && <p>{settingsText(currentPage.description, locale)}</p>}</div>}
        {settingsContent(children, locale)}
        {draft && !host && <SettingsDraftBar draft={draft} locale={locale} />}
      </>}
    </div>
  </DraftContext.Provider>;
  if (host) return host.target ? createPortal(body, host.target) : null;
  const groups = [...new Set(pages.filter(item => item.group.en !== "Help").map(item => settingsText(item.group, locale)))];
  const results = findSettings(pages, query);
  return <div className="ef-settings-backdrop" hidden={!visible} onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
    <section ref={dialog} className="ef-settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={event => {
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); if (confirmClose) { setConfirmClose(false); pendingExit.current = undefined; } else requestCloseRef.current(); }
      if (event.key === "Tab" && dialog.current) {
        const controls = available(confirmClose ? dialog.current.querySelector<HTMLElement>(".ef-settings-confirm") ?? dialog.current : dialog.current);
        const first = controls[0], last = controls.at(-1);
        if (!controls.length || (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement)))) { event.preventDefault(); (last ?? dialog.current).focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); (first ?? dialog.current).focus(); }
      }
    }}>
      <header className="ef-settings-header" inert={confirmClose}><div><p>Everend Forge</p><h2 id={titleId}>{title}</h2></div><button type="button" className="dialog-close" aria-label={es ? "Cerrar ajustes" : "Close settings"} onClick={() => requestClose()}><X size={18} /></button></header>
      <div className="ef-settings-layout" inert={confirmClose}>
        <aside className="ef-settings-sidebar">
          <label className="ef-settings-search"><Search size={16} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={es ? "Buscar ajustes…" : "Search settings…"} aria-label={es ? "Buscar ajustes" : "Search settings"} /></label>
          <label className="ef-settings-mobile"><span>{es ? "Sección" : "Section"}</span><select value={page} onChange={event => { setQuery(""); setFocusControl(undefined); onPage(event.target.value); }}>{groups.map(group => <optgroup key={group} label={group}>{pages.filter(item => settingsText(item.group, locale) === group).map(item => <option key={item.id} value={item.id}>{settingsText(item.title, locale)}</option>)}</optgroup>)}</select></label>
          <nav aria-label={es ? "Secciones de ajustes" : "Settings sections"}>{groups.map(group => <div className="ef-settings-nav-group" key={group}><p>{group}</p>{pages.filter(item => settingsText(item.group, locale) === group).map(item => <button type="button" key={item.id} aria-current={page === item.id && !query ? "page" : undefined} onClick={() => { setQuery(""); setFocusControl(undefined); onPage(item.id); }}>{settingsText(item.title, locale)}</button>)}</div>)}</nav>
          {onHelp && <button className="ef-settings-help" type="button" onClick={() => { if (helpPage) { setQuery(""); onPage(helpPage); } else requestClose(onHelp); }}>{es ? "Ayuda y tutoriales" : "Help and tutorials"}</button>}
          {footer}
        </aside>
        <div className="ef-settings-main">
          {query ? <div className="ef-settings-results"><h3>{es ? "Resultados" : "Results"}</h3><p role="status">{results.length ? `${results.length} ${es ? "ajustes encontrados" : "settings found"}` : es ? "No se encontraron ajustes." : "No settings found."}</p>{pages.filter(item => results.some(result => result.page.id === item.id)).map(item => <section key={item.id}><h4>{settingsText(item.group, locale)} · {settingsText(item.title, locale)}</h4>{results.filter(result => result.page.id === item.id).map(({ control }) => <button type="button" key={control.id} aria-label={settingsText(control.label, locale)} onClick={() => { setQuery(""); setFocusControl(control.id); onPage(item.id, control.id); }}><strong>{settingsText(control.label, locale)}</strong>{control.description && <small>{settingsText(control.description, locale)}</small>}{item.requiresUniverse && !hasUniverse && <small>{es ? "Requiere un universo abierto" : "Requires an open universe"}</small>}</button>)}</section>)}</div> : null}<div hidden={Boolean(query)} className="ef-settings-page-slot">{body}</div>
        </div>
      </div>
      {confirmClose && <div className="ef-settings-confirm" role="alertdialog" aria-label={es ? "Cambios sin guardar" : "Unsaved changes"}><strong>{es ? "Hay cambios sin guardar." : "You have unsaved changes."}</strong><p>{es ? "Guarda o descarta los borradores antes de cerrar." : "Save or discard your drafts before closing."}</p>{error && <p role="alert">{error}</p>}<div><button type="button" disabled={busy} onClick={() => { setConfirmClose(false); pendingExit.current = undefined; }}><ArrowLeft size={14} />{es ? "Seguir editando" : "Keep editing"}</button><button type="button" disabled={busy} onClick={() => { for (const item of dirtyDrafts()) item.discard(); setConfirmClose(false); completeClose(); }}>{es ? "Descartar y cerrar" : "Discard and close"}</button><button type="button" disabled={busy} onClick={async () => { setSaving(true); setError(""); try { for (const item of dirtyDrafts()) await item.save(); await new Promise<void>(resolve => window.setTimeout(resolve, 0)); if (dirtyDrafts().length) { setError(es ? "Hay nuevos cambios pendientes. Revisa el formulario antes de cerrar." : "There are new pending changes. Review the form before closing."); return; } setConfirmClose(false); completeClose(); } catch (cause) { setError(String(cause)); } finally { setSaving(false); } }}>{busy ? es ? "Guardando…" : "Saving…" : es ? "Guardar y cerrar" : "Save and close"}</button></div></div>}
    </section>
  </div>;
}

