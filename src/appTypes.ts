export type Selection =
  | { type: "story"; id: string }
  | { type: "narrativeAction"; id: string }
  | { type: "narrativeRule"; id: string }
  | { type: "entityInstance"; id: string }
  | { type: "storyDebug"; id: string }
  | { type: "storyPlay"; id: string }
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | { type: "canon"; id: string }
  | { type: "file"; id: string }
  | { type: "dataObject"; id: string }
  | { type: "canonSuggestion"; id: string }
  | { type: "explorerEntity"; id: string }
  | { type: "explorerType"; id: string; source: "canon" | "local" }
  | { type: "explorerProperty"; id: string; source: "canon" | "local" };

export type InspectorTab = {
  id: string;
  selection: Selection;
  title: string;
  mode?: "normal" | "debug" | "play";
};

export type InspectorRequest = {
  selectionKey: string;
  section: string;
  focusId?: string;
  requestId?: number;
};

export function inspectorSelectionKey(selection: Selection) {
  return `${selection.type}:${selection.id}${"source" in selection ? `:${selection.source}` : ""}`;
}

export type CanvasMode = "branching" | "focus";
export type AppView = "home" | "workspace";
export type MarkdownDraftFormat =
  "markdown" | "ink" | "gameData" | "frontmatter";

export type MarkdownEditorTab = {
  id: string;
  canonRefId: string;
  title: string;
  sourcePath?: string;
  workingCopyPath?: string;
  format: MarkdownDraftFormat;
  content: string;
  dirty: boolean;
  saving?: boolean;
  lastSavedAt?: number;
  modifiedMs?: number;
};
