<p align="center">
  <img src="src/assets/pathbranching-icon.png" width="120" alt="Everend PathBranching icon" />
</p>

<h1 align="center">Everend PathBranching</h1>
<p align="center">
  Free, open-source visual editor for interactive branching stories.<br />
  Author narrative graphs and export portable runtime packages.
</p>

<p align="center">
  <a href="README.es.md">Español</a> · <a href="https://github.com/SoleipDreams/everend-forge-pathbranching/releases/latest">Download free</a> · <a href="https://website-everend-forge.pages.dev/">Explore the integrated Suite</a>
</p>

<p align="center">
  <a href="https://github.com/SoleipDreams/everend-forge-pathbranching/actions/workflows/ci.yml"><img src="https://github.com/SoleipDreams/everend-forge-pathbranching/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/SoleipDreams/everend-forge-pathbranching/releases/latest"><img src="https://img.shields.io/github/v/release/SoleipDreams/everend-forge-pathbranching?label=latest%20release" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/code-MIT%20OR%20Apache--2.0-blue.svg" alt="Code license"></a>
  <img src="https://img.shields.io/badge/built%20with-Tauri%20%2B%20React%20Flow%20%2B%20TypeScript-1e2a4a.svg" alt="Built with Tauri, React Flow, TypeScript">
</p>

<p align="center">PathBranching is free to use on its own. The paid Suite is a separate integrated product; buying it does not change this app's open-source rights.</p>

---

Everend PathBranching is the visual branching narrative editor for Everend Forge. It creates interactive narrative graphs and exports runtime packages and narrative format projections defined by Everend Spec.

PathBranching references canon entities by stable IDs from WorldNotion-compatible vaults, but it does not replace the canon vault.

## Product direction

PathBranching is the narrative structure and branching layer of Everend Forge. Its direction covers connected story creation for video games, roleplaying, and literature, with WorldNotion as canon and Compendium as a reading/publication surface. See [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md) for the milestones and PathBranching's role in each one.

## Current Status

The active milestone is [authoring cycle closure](docs/AUTHORING_CLOSURE.md):
verify editing, save/reopen, validation and offline exports as one workflow.
Unity live synchronization is deferred while this cycle is completed.

This repository currently contains design documentation, runtime examples, a TypeScript core, a React + React Flow story canvas, and a Tauri desktop shell. The UI opens the same universe folder used by WorldNotion, previews Markdown canon as references, stores branching metadata under `.everend/.pathbranching`, keeps the narrative canvas always open, validates modular conditions and rules, and previews runtime export.

The near-term export target is the SINPO-style Unity ecosystem: Ink-centered narrative output plus GameData-compatible runtime structures. Longer term, PathBranching should support additional narrative exports such as Twine and other engine/story formats without making those formats the authoring source of truth.

## V1 Authoring Contract

PathBranching v1 treats `BranchingProject` as the document source of truth. React Flow nodes, panel sizes, focus mode, preview drawers, and workspace sessions are authoring UI state; engine exports must be generated from the document model and must not depend on canvas layout.

The first complete authoring loop is:

1. Open a WorldNotion universe folder.
2. Preview canon read-only and create PathBranching data objects from selected canon refs when needed.
3. Reference WorldNotion files dynamically from events through stable canon refs; PathBranching refreshes labels, paths, warnings, and preview metadata from the current universe index.
4. Create safe WorldNotion edit suggestions from PathBranching when story authoring exposes canon changes. Suggestions are stored in the PathBranching story and remain `worldnotion-review-required`; they do not overwrite source Markdown.
5. Author a sequence as a branching map with Start, Event, Branch, and Final nodes.
6. Edit event text, decisions, outcomes, conditions, consequences, rule sets, Ink refs, and project data.
7. Save the story under `.everend/.pathbranching/stories`.
8. Export Runtime JSON, Ink, or SINPO GameData from the same `BranchingProject`.

Twine/Twee/Harlowe/SugarCube remain planned format projections. They should not become alternate authoring sources before the SINPO/Ink/GameData pipeline is stable.

## Development

~~~bash
npm install
npm run typecheck
npm run build
npm run verify:core
npm run verify:persistence
~~~

## Desktop Shell

PathBranching uses the same React/Vite frontend in web and desktop modes. Tauri is the desktop packaging/runtime layer and keeps the app aligned with Everend Forge Suite.

~~~bash
npm run dev
npm run tauri:dev
npm run tauri:build
~~~

The Tauri shell supports Windows and macOS development and packaging with the same local-folder workflow as WorldNotion: open universe, save branching story into `.everend/.pathbranching`, runtime export, window-state restore, and desktop dialog permissions.

## Everend Forge Suite Compatibility

PathBranching remains a standalone app, and its core modules are exported so Everend Forge Suite can mount it as the Branch workspace. Suite code uses the public exports from `src/index.ts` for domain types, project serialization, workspace loading, validation, runtime export, canvas modeling, environment helpers, and the `PathBranchingApp` component. It does not read private React state or Tauri command internals.

The Suite shares the same active universe folder that WorldNotion edits by default. PathBranching treats canon Markdown as read-mostly source data and stores branching authoring state under `.everend/.pathbranching`.

Until WorldNotion and PathBranching reach beta-quality integration surfaces, Everend Forge should pin compatible releases or commits for suite integration rather than tracking every latest app change automatically.

## Implementation Starting Point

- [Docs Index](docs/README.md): recommended reading order.
- [Evpath Format](docs/EVPATH_FORMAT.md): the native `.evpath` text projection of events, editable from the inspector's Path tab.
- [Integration Architecture](docs/INTEGRATION_ARCHITECTURE.md): communication contracts between WorldNotion, PathBranching, and engine adapters.
- [Ontology and Projection Reanalysis](docs/ONTOLOGY_PROJECTION_REANALYSIS.md): revised model separating WorldNotion canon, PathBranching data classes, and engine runtime projections.
- [MVP](docs/MVP.md): first build boundary.
- [Unity Ink Adapter Notes](docs/UNITY_INK_ADAPTER_NOTES.md): practical notes for the first Unity + Ink engine adapter.
- [WorldNotion Bridge Fixture](examples/worldnotion-bridge-demo-project.json): generic bridge fixture for tests and documentation.
- [Unity Ink Runtime Package Example](examples/unity-ink-runtime-package.json): extended v0.1-compatible package example for Unity Ink import.

## Core Concepts

- Playable story flow
- Sequences
- Events
- Decisions
- Outcomes
- Variables
- Conditions
- Consequences
- Condition sets
- Rule sets
- Canon references
- Project data objects
- Ink script references and Ink-oriented export
- Data classes
- Projection rules
- Graph modules
- Localization keys

## Output

PathBranching exports JSON/YAML runtime packages that engine plugins can execute without the authoring app installed. The first practical adapter should also produce SINPO-compatible Ink/GameData output. Future exporters may target Twine and other branching narrative formats as projections from the same story graph.

~~~mermaid
flowchart LR
  A[WorldNotion canon] --> B[PathBranching story graph]
  B --> C[Validate and preview]
  C --> D[Portable runtime package]
  D --> E[Engine adapters]
~~~

## Related Repositories

- [Everend Forge portal](https://github.com/SoleipDreams/everend-forge)
- [Everend Spec](https://github.com/SoleipDreams/everend-forge-specs)
- [Everend WorldNotion](https://github.com/SoleipDreams/everend-forge-worldnotion)

## License

Code is licensed under either MIT or Apache-2.0; documentation is CC BY 4.0. Preserve required legal notices when redistributing. See [license scope](LICENSE), [MIT](LICENSE-MIT), [Apache-2.0](LICENSE-APACHE), [CC BY 4.0](LICENSE-CC-BY-4.0), and the separate [brand policy](TRADEMARKS.md).

## Support

If Everend Forge is useful to you, you can support its development on [Ko-fi](https://ko-fi.com/heinzdbv).
