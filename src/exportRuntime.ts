import { hasInteractions, hasOpposedInteractions } from './interactions.js';
import { hasCompoundDice, hasContextualDice } from './interactionDice.js';
import type {
  BranchingProject,
  EventNode,
  RuntimeChoice,
  RuntimeNode,
  RuntimePackage,
  SceneImageAttachment,
} from "./domain.js";
import { combineConditions, effectiveConditions, orderedTransitions } from "./logic.js";
import { UNKNOWN_SPEAKER_REF } from "./speakerRoles.js";
import { modularExportDiagnostics } from "./exportCompatibility.js";

function eventChoices(project: BranchingProject, event: EventNode, routers: RuntimeNode[]): RuntimeChoice[] | undefined {
  const outcomeChoices: RuntimeChoice[] = (event.decisions ?? []).flatMap((decision) =>
    decision.outcomes.map((outcome) => {
      const outcomeNodeId = `outcome:${event.id}:${decision.id}:${outcome.id}`;
      const routes = orderedTransitions((event.transitions ?? []).filter(candidate => candidate.from === outcomeNodeId));
      const direct = routes.length === 1 && !effectiveConditions(routes[0]) && !routes[0].consequences?.length && !routes[0].logic;
      const routerId = `route:${outcomeNodeId}`;
      if (!direct) routers.push({id:routerId,type:'route',canonRefDetails:[],automaticTransitions:routes.map(route=>({...route,conditions:effectiveConditions(route),consequences:route.logic?.then ?? route.consequences}))});
      const unavailableText = project.logicFormats?.unavailableText?.trim() ? project.logicFormats.unavailableText : outcome.unavailableText?.content;
      const lockText = project.logicFormats?.lockText?.trim() ? project.logicFormats.lockText : outcome.lockText?.content;
      return {
        id: outcome.id,
        textKey: `outcome.${outcome.id}.text`,
        targetNodeId: direct ? routes[0].to : routerId,
        conditions: combineConditions(effectiveConditions(decision), effectiveConditions(outcome)),
        consequences: [...(decision.logic?.then ?? []), ...(outcome.logic?.then ?? outcome.consequences ?? [])],
        containerLogic: decision.logic,
        logic: outcome.logic,
        unavailableBehavior: project.logicFormats?.unavailableBehavior ?? outcome.unavailableBehavior ?? "locked",
        unavailableTextKey: unavailableText ? project.logicFormats?.unavailableText?.trim() ? "logicFormats.unavailableText" : `outcome.${outcome.id}.unavailable` : undefined,
        lockTextKey: lockText ? project.logicFormats?.lockText?.trim() ? "logicFormats.lockText" : `outcome.${outcome.id}.lock` : undefined,
      };
    }),
  );

  return outcomeChoices.length ? outcomeChoices : undefined;
}

export type RuntimeExportProfile = 'enhanced' | 'legacy';
export function exportRuntimePackage(project: BranchingProject, options: {profile?: RuntimeExportProfile} = {}): RuntimePackage {
  if (project.events.some(event => event.interactionUses?.some(use => event.interactionDefinitions?.some(definition => definition.id === use.definitionId && definition.mechanicPending)))) throw new Error('Elige una mecánica para cada interacción antes de exportar.');
  const routers: RuntimeNode[] = [];

  const entrySequence = project.entrySequenceId
    ? project.sequences.find((sequence) => sequence.id === project.entrySequenceId)
    : project.sequences[0];
  const entryNodeId = entrySequence?.entryEventId ?? project.events[0]?.id ?? "missing-entry";

  const canonRefDetails = (ids: string[] | undefined) =>
    (ids ?? [])
      .map((id) => project.canonRefs.find((ref) => ref.id === id))
      .filter(Boolean)
      .map((ref) => ({
        id: ref!.id,
        kind: ref!.kind,
        label: ref!.label,
        canonSourcePath: ref!.canonSourcePath,
        missingIdentity: ref!.missingIdentity,
        identityWarning: ref!.identityWarning,
      }));

  const runtimeImage = (attachment: SceneImageAttachment | undefined) => {
    if (!attachment) return undefined;
    const asset = project.assets?.find(
      (candidate) => candidate.id === attachment.assetId && candidate.kind === "image",
    );
    return asset
      ? {
          id: attachment.id,
          assetId: asset.id,
          path: asset.path,
          name: asset.name,
          extension: asset.extension,
        }
      : undefined;
  };

  const eventNodes: RuntimeNode[] = project.events.map((event) => ({
    id: event.id,
    type: "event",
    textKey: `event.${event.id}.name`,
    choices: eventChoices(project, event, routers),
    decisionOptionStyle: project.logicFormats?.decisionOptionStyle,
    conditions: combineConditions(
      ...project.sequences.filter(s=>s.eventIds.includes(event.id)).map(effectiveConditions),
      ...project.branches.filter(b=>b.eventIds.includes(event.id)).map(effectiveConditions), effectiveConditions(event)),
    canonRefs: event.canonRefs,
    canonRefDetails: canonRefDetails(event.canonRefs),
    storyText: event.text,
    script: event.script,
    ...(runtimeImage(event.coverImage)
      ? { coverImage: runtimeImage(event.coverImage) }
      : {}),
    legacyId: event.legacyId,
    decisions: event.decisions,
    transitions: event.transitions,
    automaticTransitions: orderedTransitions(
      (event.transitions ?? []).filter((transition) => transition.from === event.id),
    ),
    consequences: event.logic?.then ?? event.consequences,
    logic: event.logic,
  }));
  const scriptBlocks = new Map(
    (project.scriptDocuments ?? []).flatMap((script) =>
      script.blocks.map((block) => [`${script.id}:${block.id}`, block] as const),
    ),
  );
  const speakerMappings = (Object.values(project.engineTargets ?? {})[0]?.speakerMappings ?? {}) as Record<string, string>;
  const runtimeBeat = (event: EventNode, beat: NonNullable<EventNode["dialogueBeats"]>[number], dialogueId?: string): RuntimeNode => {
    const id = `beat:${event.id}:${beat.id}`;
    const block = scriptBlocks.get(`${beat.blockRef.scriptId}:${beat.blockRef.blockId}`);
    const characterRef = block?.characterRef ?? block?.speakerRef;
    const sceneImage = beat.kind === "speech" && beat.sceneImage
      ? (() => {
          const asset = project.assets?.find((candidate) => candidate.id === beat.sceneImage?.assetId && candidate.kind === "image");
          return asset ? {
            id: beat.sceneImage.id,
            assetId: asset.id,
            path: asset.path,
            name: asset.name,
            extension: asset.extension,
          } : undefined;
        })()
      : undefined;
    return {
      id,
      type: beat.kind === "speech" ? "dialogueBeat" : "directionBeat",
      textKey: block?.textKey ?? `script.${beat.blockRef.scriptId}.${beat.blockRef.blockId}`,
      characterRef: characterRef === UNKNOWN_SPEAKER_REF ? undefined : characterRef,
      characterVariantId: characterRef === UNKNOWN_SPEAKER_REF ? undefined : block?.characterVariantId,
      speakerRef: characterRef === UNKNOWN_SPEAKER_REF ? "unknown" : characterRef ? speakerMappings[characterRef] || characterRef : undefined,
      conditions: beat.logic?.when ?? beat.displayCondition,
      consequences: beat.logic?.then ?? beat.consequences,
      logic: beat.logic,
      automaticTransitions: orderedTransitions((event.transitions ?? []).filter((transition) => transition.from === id)),
      dialogueId,
      ...(sceneImage ? { sceneImage } : {}),
    };
  };
  const dialogueNodes: RuntimeNode[] = project.events.flatMap((event) =>
    (event.dialogues ?? []).flatMap((dialogue) => {
      const containerId = `dialogue:${event.id}:${dialogue.id}`;
      const container: RuntimeNode = {
        id: containerId,
        type: "dialogue",
        textKey: `dialogue.${dialogue.id}.title`,
        entryNodeId: dialogue.entryBeatId
          ? `beat:${event.id}:${dialogue.entryBeatId}`
          : undefined,
        automaticTransitions: orderedTransitions(
          (event.transitions ?? []).filter((transition) => transition.from === containerId),
        ),
        conditions: dialogue.logic?.when ?? dialogue.availability,
        consequences: dialogue.logic?.then ?? dialogue.consequences,
        logic: dialogue.logic,
      };
      const beats = (dialogue.beats ?? []).map((beat) => runtimeBeat(event, beat, dialogue.id));
      return [container, ...beats];
    }),
  );
  const directBeatNodes = project.events.flatMap((event) => (event.dialogueBeats ?? []).map((beat) => runtimeBeat(event, beat)));
  const dialogueStartNodes: RuntimeNode[] = project.events.flatMap((event) => (event.dialogueStarts ?? []).map((start) => ({
    id: `dialogue-start:${event.id}:${start.id}`,
    type: "dialogueTrigger",
    source: start.source,
    conditions: start.logic?.when ?? start.availability,
    consequences: start.logic?.then,
    logic: start.logic,
    automaticTransitions: orderedTransitions(
      (event.transitions ?? []).filter((transition) => transition.from === `dialogue-start:${event.id}:${start.id}`),
    ),
  })));
  const nodes = [...eventNodes, ...dialogueNodes, ...directBeatNodes, ...dialogueStartNodes, ...routers];
  if (new Set(nodes.map(n=>n.id)).size !== nodes.length) throw Error("Runtime: duplicate node or generated route ID");
  const withoutInteractionResults = (state: import('./domain.js').PlayerSimulationState | undefined) => {
    if (!state || !('interactionResults' in state)) return state;
    const { interactionResults: _temporary, ...authored } = state; return authored;
  };
  const modularRequirements = modularExportDiagnostics(project);
  const usesLogicFormats = Boolean(project.logicFormats && Object.values(project.logicFormats).some(value => value !== undefined));
  const modularExecution = modularRequirements.some(requirement => requirement.feature !== "logic-formats-v1") || project.events.some(event =>
    event.dialogues?.length || event.dialogueBeats?.length || event.dialogueStarts?.length ||
    event.parentEventId || event.childEventIds?.length || event.boundaryBindings?.length ||
    event.transitions?.some(route => /^(boundary|beat|dialogue|dialogue-start|decision):/.test(route.from) || /^(boundary|beat|dialogue|dialogue-start|decision|outcome):/.test(route.to)));
  const requiredFeatures = [...(hasInteractions(project) ? ["interactions-v1"] : []), ...(hasOpposedInteractions(project) ? ["opposed-interactions-v1"] : []), ...(hasCompoundDice(project) ? ["compound-dice-v1"] : []), ...(hasContextualDice(project) ? ["contextual-dice-v1"] : []), ...(usesLogicFormats ? ["logic-formats-v1"] : []), "typed-condition-tree-v1", "ordered-routes-v1", "logic-rules-v1", ...(routers.length ? ["dynamic-choice-routing-v1"] : []), ...(modularExecution ? ["modular-authoring-v1"] : [])];
  if (options.profile === "legacy" && modularExecution) throw Error("Legacy runtime cannot preserve modular authoring; use the enhanced profile.");
  if (options.profile === "legacy" && usesLogicFormats) throw Error("Legacy runtime cannot preserve project-wide logic formats; use the enhanced profile.");
  if (options.profile === "legacy" && (routers.length || JSON.stringify(project).includes('"logic"') || project.events.some(e=>e.transitions?.some(t=>effectiveConditions(t))))) throw Error("Legacy runtime cannot preserve conditional logic; use the enhanced profile.");

  const legacyPrimary = {
    ...Object.fromEntries(project.events.flatMap((event) => [
      [`event.${event.id}.name`, event.name],
      ...(event.text?.content ? [[`event.${event.id}.text`, event.text.content] as const] : []),
      ...(event.decisions ?? []).flatMap((decision) => [
        [`decision.${decision.id}.prompt`, decision.name] as const,
        ...decision.outcomes.flatMap((outcome) => [
          [`outcome.${outcome.id}.text`, outcome.visibleText?.trim() || outcome.name] as const,
          ...(outcome.unavailableText?.content ? [[`outcome.${outcome.id}.unavailable`, outcome.unavailableText.content] as const] : []),
          ...(outcome.lockText?.content ? [[`outcome.${outcome.id}.lock`, outcome.lockText.content] as const] : []),
        ]),
      ]),
      ...(event.dialogues ?? []).flatMap((dialogue) => [[`dialogue.${dialogue.id}.title`, dialogue.title] as const]),
    ])),
    ...Object.fromEntries((project.scriptDocuments ?? []).flatMap((script) => script.blocks.map((block) => [block.textKey ?? `script.${script.id}.${block.id}`, block.content] as const))),
  };
  const primaryLocale = project.localizationCatalog?.primaryLocale ?? "und";
  if (project.logicFormats?.unavailableText) legacyPrimary["logicFormats.unavailableText"] = project.logicFormats.unavailableText;
  if (project.logicFormats?.lockText) legacyPrimary["logicFormats.lockText"] = project.logicFormats.lockText;
  const locales = project.localizationCatalog?.locales ?? [primaryLocale];
  const localizations = Object.fromEntries(locales.map((locale) => [locale, {
    ...(locale === primaryLocale ? legacyPrimary : {}),
    ...Object.fromEntries(Object.entries(project.localizationCatalog?.entries ?? {}).flatMap(([key, entry]) => entry.values[locale] !== undefined ? [[key, entry.values[locale]]] : [])),
  }]));

  return {
    specVersion: "0.1",
    packageId: project.projectId,
    entryNodeId,
    canonRefs: project.canonRefs,
    variables: project.variables,
    localization: localizations[primaryLocale],
    primaryLocale,
    localizations,
    nodes,
    pathBranching: {
      profile: options.profile ?? "enhanced",
      requiredFeatures,
      // Consumers of modular stories must execute this source model, including
      // its initial state. The flattened nodes alone are not an equivalent run.
      ...(modularExecution ? { authoringModelVersion: "0.5" } : {}),
      storyId: project.storyId,
      name: project.name,
      logicFormats: project.logicFormats,
      logicVariables: project.logicVariables,
      localExplorerEntities: project.localExplorerEntities,
      localExplorerTypes: project.localExplorerTypes,
      localExplorerProperties: project.localExplorerProperties,
      canonPropertyDescriptors: project.canonPropertyDescriptors,
      logicPropertyOverrides: project.logicPropertyOverrides,
      logicTypeOverrides: project.logicTypeOverrides,
      entityInstances: project.entityInstances,
      entityOverrides: project.entityOverrides,
      narrativeActions: project.narrativeActions,
      narrativeRules: project.narrativeRules,
      playerSimulation: withoutInteractionResults(project.playerSimulation),
      playerProfiles: project.playerProfiles?.map(p => ({ ...p, simulation: withoutInteractionResults(p.simulation)! })),
      activePlayerProfileId: project.activePlayerProfileId,
      authoringScenarios: project.authoringScenarios?.map(s => ({ ...s, state: withoutInteractionResults(s.state) })),
      assets: project.assets,
      localizationCatalog: project.localizationCatalog,
      resolutionPolicy: "first-satisfied-then-else; stop-on-unresolved-or-invalid",
      formatLimitations: ["Twine and GameData do not guarantee condition/consequence equivalence"],
      projectId: project.projectId,
      sourceVault: project.sourceVault,
      dataClasses: project.dataClasses,
      projectDataObjects: project.projectDataObjects,
      canonEditSuggestions: project.canonEditSuggestions,
      projectionRules: project.projectionRules,
      graphModules: project.graphModules,
      eventCategories: project.eventCategories,
      entrySequenceId: project.entrySequenceId,
      sequences: project.sequences,
      branches: project.branches,
      events: project.events,
      scripts: project.scripts,
      scriptDocuments: project.scriptDocuments,
      integrationConfig: project.integrationConfig,
      integrationConfigOverride: project.integrationConfigOverride,
      externalFunctions: project.externalFunctions,
    },
    engineTargets: project.engineTargets,
  };
}
