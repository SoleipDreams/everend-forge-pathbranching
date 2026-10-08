import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./app.css";
import { StoryTestDetached, storyTestWindowKind } from "./components/StoryTestDetached.js";

const App = lazy(async () => ({ default: (await import("./App.js")).App }));
const storyTestKind = storyTestWindowKind();

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("Missing React root.");
}

createRoot(root).render(
  <StrictMode>
    {storyTestKind ? <StoryTestDetached kind={storyTestKind} /> : <Suspense fallback={null}><App /></Suspense>}
  </StrictMode>,
);
