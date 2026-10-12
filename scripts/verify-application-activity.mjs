import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the production hooks with deterministic ref/effect lifecycles and a
// tiny DOM surface. This checks listener ownership, not native keyboard input.
function hookHarness() {
  const slots = [], pending = [];
  let cursor = 0, activity;
  const react = {
    createContext: value => ({ defaultValue: value }),
    useContext: context => activity ?? context.defaultValue,
    useRef: value => slots[cursor++] ?? (slots[cursor - 1] = { current: value }),
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        pending.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const document = new EventTarget();
  const originalAdd = document.addEventListener.bind(document), originalRemove = document.removeEventListener.bind(document);
  // Node EventTarget removal treats boolean capture differently from the DOM.
  const optionsObject = options => typeof options === "boolean" ? { capture: options } : options;
  document.addEventListener = (type, listener, options) => originalAdd(type, listener, optionsObject(options));
  document.removeEventListener = (type, listener, options) => originalRemove(type, listener, optionsObject(options));
  class Element {
    constructor(children = []) { this.children = children; this.tagName = "BUTTON"; this.isConnected = true; this.focusCalls = 0; children.forEach(child => { child.parentElement = this; }); }
    contains(target) { return target === this || this.children.some(child => child.contains(target)); }
    querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll()]).filter(child => child.tagName !== "DETAILS"); }
    querySelector(selector) { return selector === ":scope > summary" ? this.children.find(child => child.tagName === "SUMMARY") : this.querySelectorAll().find(child => child.preferred) ?? this.children[0]; }
    closest() { for (let node = this; node; node = node.parentElement) { if (node.hidden) return node; } return null; }
    getClientRects() { return [1]; }
    getAttribute() { return null; }
    focus() { this.focusCalls++; document.activeElement = this; const event = new Event("focusin"); Object.defineProperty(event, "target", { value: this }); document.dispatchEvent(event); }
  }
  class Details extends Element { constructor(children) { super(children); this.tagName = "DETAILS"; this.open = false; } }
  const modules = new Map();
  const load = relative => {
    if (modules.has(relative)) return modules.get(relative);
    const source = readFileSync(new URL(`../src/components/${relative}`, import.meta.url), "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(output, { exports: module.exports, module, require: id => id === "react" ? react : load(id.replace(/^\.\//, "").replace(/\.js$/, ".tsx")), document, HTMLElement: Element, HTMLDetailsElement: Details, Node: Element });
    modules.set(relative, module.exports);
    return module.exports;
  };
  return {
    document, Element, Details, load,
    render(callback, active) { activity = active; cursor = 0; callback(); pending.splice(0).forEach(commit => commit()); },
    unmount() { slots.forEach(slot => slot.cleanup?.()); slots.length = 0; },
    key(key, shiftKey = false) { const event = new Event("keydown", { cancelable: true }); Object.assign(event, { key, shiftKey }); document.dispatchEvent(event); return event; },
  };
}

test("global application effects suspend, resume once and preserve hook state", () => {
  const harness = hookHarness();
  const { useApplicationEffect } = harness.load("useApplicationActivity.tsx");
  let calls = 0, mounts = 0, cleanups = 0;
  const render = () => useApplicationEffect(() => {
    mounts++; const handler = () => calls++;
    harness.document.addEventListener("probe", handler);
    return () => { cleanups++; harness.document.removeEventListener("probe", handler); };
  }, []);
  const emit = () => harness.document.dispatchEvent(new Event("probe"));
  harness.render(render, false); emit(); assert.equal(calls, 0);
  harness.render(render, true); emit(); assert.equal(calls, 1);
  harness.render(render, true); emit(); assert.equal(mounts, 1); assert.equal(calls, 2);
  harness.render(render, false); emit(); assert.equal(calls, 2); assert.equal(cleanups, 1);
  harness.render(render, true); emit(); assert.equal(calls, 3); assert.equal(mounts, 2);
  harness.unmount(); emit(); assert.equal(calls, 3); assert.equal(cleanups, 2);
  // Omitting the embedding provider keeps standalone and detached windows active.
  harness.render(render); emit(); assert.equal(calls, 4);
  harness.unmount();
});

test("a hidden overlay cannot consume Escape/Tab, trap focus or restore its old trigger", () => {
  const harness = hookHarness();
  const { useOverlayFocus } = harness.load("useOverlayFocus.ts");
  const trigger = new harness.Element(), otherApp = new harness.Element();
  const first = new harness.Element(), last = new harness.Element();
  const container = { current: new harness.Element([first, last]) };
  harness.document.activeElement = trigger;
  let dismissals = 0;
  const render = () => useOverlayFocus(container, true, () => dismissals++);
  harness.render(render, false);
  assert.equal(harness.key("Escape").defaultPrevented, false);
  assert.equal(first.focusCalls, 0);
  harness.render(render, true);
  assert.equal(harness.document.activeElement, first);
  last.focus(); assert.equal(harness.key("Tab").defaultPrevented, true);
  assert.equal(harness.document.activeElement, first);
  assert.equal(harness.key("Escape").defaultPrevented, true); assert.equal(dismissals, 1);
  harness.render(render, false);
  assert.equal(trigger.focusCalls, 0, "deactivation must not restore focus from the hidden application");
  otherApp.focus();
  assert.equal(harness.document.activeElement, otherApp);
  assert.equal(harness.key("Tab").defaultPrevented, false);
  assert.equal(harness.key("Escape").defaultPrevented, false); assert.equal(dismissals, 1);
  harness.render(render, true);
  assert.equal(harness.document.activeElement, first);
  harness.unmount();
  assert.equal(harness.document.activeElement, otherApp, "ordinary modal cleanup restores the current app trigger");
  assert.equal(harness.key("Escape").defaultPrevented, false);
});

test("modal focus skips a preferred field in a folded group and can reach it after expansion", () => {
  const harness = hookHarness();
  const { useOverlayFocus } = harness.load("useOverlayFocus.ts");
  const trigger = new harness.Element(), close = new harness.Element();
  const summary = new harness.Element(), field = new harness.Element();
  summary.tagName = "SUMMARY"; field.tagName = "INPUT"; field.preferred = true;
  const group = new harness.Details([summary, field]);
  const container = { current: new harness.Element([close, group]) };
  harness.document.activeElement = trigger;
  harness.render(() => useOverlayFocus(container, true, () => {}), true);
  assert.equal(harness.document.activeElement, close, "the folded preferred field must not steal initial focus");
  summary.focus(); harness.key("Tab");
  assert.equal(harness.document.activeElement, close, "Tab wraps from the last visible control");
  group.open = true;
  trigger.focus();
  assert.equal(harness.document.activeElement, field, "the preferred field becomes eligible when its group opens");
  harness.unmount();
  assert.equal(harness.document.activeElement, trigger);
});

// Locate the real close-request effect rather than copying its policy into a
// test-only helper. Only its dynamic native-module import is replaced by a spy.
const appSource = ts.createSourceFile("App.tsx", readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
let nativeCloseEffect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(appSource) === "useEffect" && node.arguments[0]?.getText(appSource).includes("nativeWindow.onCloseRequested")) nativeCloseEffect = node.arguments[0].getText(appSource);
  ts.forEachChild(node, visit);
}
visit(appSource);
assert.ok(nativeCloseEffect, "the standalone close-request effect must exist");
const closeCode = ts.transpileModule(`exports.effect = ${nativeCloseEffect.replace('import("@tauri-apps/api/window")', "loadNativeWindow()")};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function closeHarness(suiteChrome, desktop = true, guardAllows = true) {
  const calls = { loads: 0, registered: 0, closed: 0, removed: 0, saves: 0, errors: [] };
  let handler;
  const nativeWindow = { onCloseRequested: async callback => { calls.registered++; handler = callback; return () => calls.removed++; }, close: async () => { calls.closed++; } };
  const exports = {};
  vm.runInNewContext(closeCode, { exports, suiteChrome, isTauriRuntime: () => desktop,
    loadNativeWindow: async () => { calls.loads++; return { getCurrentWindow: () => nativeWindow }; },
    fileStateRef: { current: { dirty: true } }, persistProjectRef: { current: async () => { calls.saves++; } },
    saveQueueRef: { current: Promise.resolve() }, confirmDiscardChanges: async () => { calls.saves++; return guardAllows; }, setError: error => calls.errors.push(error), Error });
  return { calls, effect: exports.effect, request: () => { const event = { prevented: false, preventDefault() { this.prevented = true; } }; handler(event); return event; } };
}

test("only standalone owns native close; Suite never registers a competing listener", async () => {
  for (const embedded of [{ active: true }, { active: false }, { active: true, windowControlsManaged: true }]) {
    const harness = closeHarness(embedded);
    assert.equal(harness.effect(), undefined); await settle();
    assert.equal(harness.calls.loads, 0); assert.equal(harness.calls.registered, 0);
  }
  const browser = closeHarness(undefined, false);
  assert.equal(browser.effect(), undefined); assert.equal(browser.calls.loads, 0);
  const standalone = closeHarness(undefined);
  const cleanup = standalone.effect(); await settle();
  assert.equal(standalone.calls.registered, 1);
  assert.equal(standalone.request().prevented, true); await settle();
  assert.equal(standalone.calls.saves, 1); assert.equal(standalone.calls.closed, 1);
  cleanup(); assert.equal(standalone.calls.removed, 1);
  const draftBlocked = closeHarness(undefined, true, false);
  const blockedCleanup = draftBlocked.effect(); await settle();
  assert.equal(draftBlocked.request().prevented, true); await settle();
  assert.equal(draftBlocked.calls.closed, 0, 'a pending conversation or inspector draft keeps the native window open');
  blockedCleanup();
  const interrupted = closeHarness(undefined);
  interrupted.effect()(); await settle();
  assert.equal(interrupted.calls.registered, 0, "unmount before the native import resolves cannot leave a listener behind");
});
