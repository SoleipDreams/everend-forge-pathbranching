import assert from "node:assert/strict";

const saved = new Map();
globalThis.localStorage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: key => saved.delete(key),
};
const first = await import("../lib/authoringDrafts.js?first-session");
const field = first.authoringDraftKey("story:a", "beat:a", "text");
const other = first.authoringDraftKey("story:b", "beat:a", "text");
let notifications = 0;
const unsubscribe = first.subscribeAuthoringDrafts(() => notifications++);
first.setAuthoringDraft(field, "Incomplete input survives closing the panel");
first.setAuthoringDraft(other, "Another story");
assert.equal(first.authoringDraftCount("story:a"), 1);
assert.equal(notifications, 2);
unsubscribe();

// A fresh module represents reopening the native app against its persisted session store.
const reopened = await import("../lib/authoringDrafts.js?reopened-session");
assert.equal(reopened.getAuthoringDraft(field), "Incomplete input survives closing the panel");
assert.deepEqual(reopened.authoringDraftEntries("story:a"), [[field, "Incomplete input survives closing the panel"]]);
reopened.setAuthoringDraft(field, undefined);
assert.equal(reopened.authoringDraftCount("story:a"), 0);
assert.equal(reopened.getAuthoringDraft(other), "Another story");

const project = { projectId: "story:a", name: "Unsaved edit", events: [{ id: "event:a", name: "Retained" }] };
reopened.storeAuthoringRecovery("vault", "story:a", { project, modifiedMs: 20, savedAt: 30 });
project.events[0].name = "Changed after the recovery snapshot";
assert.equal(reopened.readAuthoringRecovery("vault", "story:a").project.events[0].name, "Retained");
assert.equal(reopened.readAuthoringRecovery("vault", "story:b"), undefined);
reopened.clearAuthoringRecovery("vault", "story:a");
assert.equal(reopened.readAuthoringRecovery("vault", "story:a"), undefined);

saved.set("pathbranching:authoring-drafts:v1", JSON.stringify({ [field]: "valid", broken: 42 }));
const sanitized = await import("../lib/authoringDrafts.js?corrupt-session");
assert.equal(sanitized.getAuthoringDraft(field), "valid");
assert.equal(sanitized.getAuthoringDraft("broken"), undefined);
globalThis.localStorage.setItem = () => { throw new Error("Disk quota exhausted"); };
sanitized.setAuthoringDraft(field, "Still retained in memory");
assert.equal(sanitized.getAuthoringDraft(field), "Still retained in memory");
console.log("Authoring drafts: reopen, isolation, snapshot recovery and storage failure passed.");
