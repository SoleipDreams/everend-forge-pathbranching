export type CanonRef = {
  id: string;
  kind?: string;
  label?: string;
  preview?: string;
  tags?: string[];
  status?: string;
  aliases?: string[];
  parentId?: string;
  childrenIds?: string[];
  properties?: Record<string, unknown>;
  frontmatter?: Record<string, unknown>;
  favorite?: boolean;
  folderDescription?: boolean;
  missingIdentity?: boolean;
  identityWarning?: string;
  source?: "worldnotion" | "engine-legacy" | "manual" | string;
  canonSourcePath?: string;
  canonSourceModifiedMs?: number;
  workingCopyPath?: string;
};

export type CanonChangeSetStatus =
  "draft" | "proposed" | "conflicted" | "applied" | "dismissed";

export type CanonChangeSet = {
  specVersion: "0.1";
  id: string;
  kind: "canon-change-set";
  sourceApp: "pathbranching" | "worldnotion" | string;
  target: { entityId: string; path: string };
  base: {
    content: string;
    modifiedMs?: number;
    contentHash: string;
    capturedAt: string;
  };
  proposed: { content: string; diff?: string };
  status: CanonChangeSetStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  appliedBy?: string;
  note?: string;
};

export type CanonWorkingCopy = {
  canonRefId: string;
  sourcePath: string;
  sourceModifiedMs?: number;
  sourceContent: string;
  draftContent: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  legacy?: boolean;
};

export type LocalExplorerEntity = {
  id: string;
  type: string;
  name: string;
  status: string;
  tags?: string[];
  aliases?: string[];
  properties?: Record<string, unknown>;
  body?: string;
  /** Asset ids attached to this entity's gallery (used by location-flagged types). */
  imageGallery?: string[];
  createdAt: string;
  updatedAt: string;
  exportedPath?: string;
  publishedPath?: string;
  publishedAt?: string;
};

export type LocalExplorerType = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  suggestedFolder?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExplorerPropertyOption = {
  value: string;
  label: string;
  color?: string;
};

export type LocalExplorerPropertyValueType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiselect"
  | "entity-ref"
  | "entity-ref-list"
  | "entity-type"
  | "group";

export type LocalExplorerProperty = {
  id: string;
  label: string;
  valueType: LocalExplorerPropertyValueType;
  description?: string;
  appliesToTypes?: string[];
  required?: boolean;
  options?: ExplorerPropertyOption[];
  /** entity-ref / entity-ref-list: which entity types are eligible targets. */
  targetTypes?: string[];
  /** group: nested child properties. */
  children?: LocalExplorerProperty[];
  /** entity-type: icon used to represent this type of entity. */
  icon?: string;
  /** entity-type: color used to represent this type of entity. */
  color?: string;
  /** entity-type: suggested folder path for entities of this type. */
  suggestedFolder?: string;
  createdAt: string;
  updatedAt: string;
};

/** Read-only schema snapshot from WorldNotion, keyed by stable property ID. */
export type CanonPropertyDescriptor = {
  id: string;
  label: string;
  valueType: string;
  path: string[];
  groupPath?: string[];
  appliesToTypes?: string[];
  min?: number;
  max?: number;
  defaultValue?: unknown;
};

export type AssetKind = "image" | "video" | "audio" | "document" | "other";
export type ProjectAsset = {
  id: string;
  name: string;
  path: string;
  kind: AssetKind;
  origin: "canon" | "uncanon";
  extension?: string;
  size?: number;
  importedAt?: string;
  tags?: string[];
};

/** An ordered visual cue rendered alongside a speech beat. */
export type SceneImageAttachment = {
  id: string;
  assetId: string;
};

export type LogicVariableType = "text" | "number" | "boolean" | "list" | "canonRef";
export type LogicVariableGroup = { id: string; name: string; order: number };
export type LogicVariable = {
  id: string;
  name: string;
  type: LogicVariableType;
  value: string | number | boolean | string[];
  groupId: string;
  description?: string;
};

export type EntityRuntimeStateRole = "owned" | "unlocked" | "discovered" | "present";

export type LogicSubject =
  | { kind: "entity"; entityId: string; source?: "canon" | "local"; variantId?: string }
  | { kind: "instance"; instanceId: string }
  | { kind: "context"; role: "actor" | "self" | "target" }
  | { kind: "dataObject"; objectId: string }
  | { kind: "variable"; variableId: string }
  | {
      kind: "progress";
      targetType: "sequence" | "branch" | "event" | "decision" | "outcome";
      targetId: string;
    }
  | { kind: "external"; functionId: string };

export type LogicComparisonOperator =
  | "=="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "notContains"
  | "exists"
  | "has"
  | "missing";

export type LogicPredicate =
  | {
      type: "state";
      subject: LogicSubject;
      stateId: EntityRuntimeStateRole | "exists" | string;
      operator: "has" | "missing" | "==" | "!=";
      value?: unknown;
    }
  | {
      type: "property";
      subject: LogicSubject;
      propertyId: string;
      operator: LogicComparisonOperator;
      value?: unknown;
    }
  | {
      type: "value";
      subject: LogicSubject;
      operator: LogicComparisonOperator;
      value?: unknown;
    }
  | {
      type: "visited";
      subject: Extract<LogicSubject, { kind: "progress" }>;
      operator: "has" | "missing";
    }
  | {
      type: "external";
      subject: Extract<LogicSubject, { kind: "external" }>;
      operator: "has" | "missing";
      arguments?: unknown[];
    };

export type LogicEffectOperation =
  | "set"
  | "toggle"
  | "add"
  | "subtract"
  | "append"
  | "remove"
  | "clear"
  | "grant"
  | "ungrant"
  | "unlock"
  | "lock"
  | "discover"
  | "hide"
  | "enter"
  | "leave"
  | "call";

export type LogicEffect =
  | {
      type: "state";
      conditions?: ConditionInput;
      subject: LogicSubject;
      stateId: EntityRuntimeStateRole | string;
      operation: LogicEffectOperation;
      value?: unknown;
    }
  | {
      type: "property";
      conditions?: ConditionInput;
      subject: LogicSubject;
      propertyId: string;
      operation: LogicEffectOperation;
      value?: unknown;
    }
  | {
      type: "value";
      conditions?: ConditionInput;
      subject: LogicSubject;
      operation: LogicEffectOperation;
      value?: unknown;
    }
  | {
      type: "external";
      conditions?: ConditionInput;
      subject: Extract<LogicSubject, { kind: "external" }>;
      operation: "call";
      arguments?: unknown[];
    };

export type LogicRule = {
  id: string;
  when: ConditionInput;
  then: LogicEffect[];
};

export type LogicMoment = {
  when?: ConditionInput;
  then?: Consequence[];
  rules?: LogicRule[];
  /** Entry effects fire once per traversal unless explicitly repeated. */
  repeat?: "once" | "each-entry";
  narrativeEffects?: NarrativeEffect[];
  /** Preserve the author-selected order across legacy and copy effect arrays. */
  effectOrder?: ("then" | "narrative")[];
};

export type CanonEditSuggestionStatus =
  | "draft"
  | "proposed"
  | "sent-to-worldnotion"
  | "applied-in-worldnotion"
  | "dismissed"
  | string;

export type CanonEditSuggestion = {
  id: string;
  canonRefId: string;
  targetPath?: string;
  title: string;
  summary?: string;
  proposedContent: string;
  status: CanonEditSuggestionStatus;
  sourceEventId?: string;
  sourceDataObjectId?: string;
  createdAt?: string;
  updatedAt?: string;
  safety: "worldnotion-review-required" | string;
};

export type ScriptRef = {
  id: string;
  format: "ink" | string;
  sourcePath?: string;
  compiledPath?: string;
  entrySection?: string;
};

export type LogicPropertyOverride = {
  propertyId: string;
  source: "canon" | "local";
  conditionReadable?: boolean;
  /** Explicitly follow the nearest group/type instead of legacy compatibility defaults. */
  conditionReadableInherited?: boolean;
  actionWritable?: boolean;
  /** Allows values of this property to be presented as event entities. */
  entityPresentable?: boolean;
  /** Child capability: values may be used as Dialogue Trigger sources. */
  dialogueTrigger?: boolean;
  relationTargetTypes?: string[];
  /** For entity-type properties: entities of this type can be given/removed as a Consequence and checked as runtimeItem. */
  grantable?: boolean;
  /** Child capability: owned entities of this type are inventory items selectable in copy queries and initial inventories. */
  inventoryItem?: boolean;
  /** For entity-type properties: entities of this type can be selected as an Event/DialogueBeat location. */
  location?: boolean;
  container?: boolean;
  /** @deprecated Type capabilities formerly stored on synthetic `type:*` property overrides. */
  runtimeRoles?: EntityRuntimeStateRole[];
};

/** Entity-type-level capability flags: an entity is grantable/a location because its TYPE is marked so. */
export type LogicTypeOverride = {
  typeId: string;
  source: "canon" | "local";
  /** Entities of this type can be given/removed as a Consequence and checked as a runtimeItem Condition. */
  grantable?: boolean;
  /** Child capability: owned entities of this type are inventory items selectable in copy queries and initial inventories. */
  inventoryItem?: boolean;
  /** Entities of this type can be selected as an Event/DialogueBeat location. */
  location?: boolean;
  container?: boolean;
  /** Runtime state roles explicitly enabled for entities of this type. */
  runtimeRoles?: EntityRuntimeStateRole[];
};

export type PlayerSimulationState = {
  interactionResults?: Record<string, {
    executionId: string; resultId: string; resultName?: string; resultKey?: InteractionResult['key']; total?: number; rolls?: number[]; dice?: InteractionDice; skillSource?: InteractionValueSource; skillLabel?: string; skillValue?: number; modifier?: number; modifierBreakdown?: InteractionModifierTrace[]; forced: boolean;
    participantTraces?: InteractionParticipantTrace[];
    participantResults?: Record<string, InteractionParticipantResult>;
  }>;
  inventory?: string[];
  unlockedCanonRefs?: string[];
  variables?: Record<string, unknown>;
  /** editGrantable runtime values, keyed by grantable entity id then property id. */
  grantableProperties?: Record<string, Record<string, unknown>>;
  /** Unified runtime overlay. Canon/local source data remains immutable. */
  entityStates?: Record<
    string,
    {
      states?: Partial<Record<EntityRuntimeStateRole | string, boolean>>;
      properties?: Record<string, unknown>;
    }
  >;
  /** Non-base variants never inherit the mutable state of another variant. */
  entityVariantStates?: Record<string, Record<string, { states?: Partial<Record<string, boolean>>; properties?: Record<string, unknown> }>>;
  visited?: string[];
  activeNodeId?: string;
  activeDecisionId?: string;
  entityInstances?: EntityInstance[];
  dataObjects?: ProjectDataObject[];
  externalResults?: Record<string, boolean>;
  context?: { actor?: LogicSubject; self?: LogicSubject; target?: LogicSubject; profileId?: string };
};

export type EntityOwner =
  | { kind: "entity"; entityId: string }
  | { kind: "instance"; instanceId: string }
  | { kind: "profile"; profileId: string }
  | { kind: "context"; role: "actor" | "self" | "target" };
export type EntityInstance = {
  id: string;
  entityId: string;
  variantId?: string;
  name?: string;
  properties?: Record<string, unknown>;
  states?: Record<string, boolean>;
  owner?: EntityOwner;
};
/** Applied once per owned copy, while carried or explicitly equipped. */
export type InventoryPropertyModifier = {
  id: string;
  propertyId: string;
  amount: number;
  activation: "carried" | "equipped";
};
export type EntityCapabilityOverride = {
  entityId: string;
  grantable?: boolean;
  /** Per-entity exception for the type's inventory-item capability. Requires the entity to be ownable. */
  inventoryItem?: boolean;
  location?: boolean;
  container?: boolean;
  runtimeRoles?: Partial<Record<EntityRuntimeStateRole | string, boolean>>;
  properties?: Record<string, { conditionReadable?: boolean; actionWritable?: boolean }>;
  inventoryModifiers?: InventoryPropertyModifier[];
  itemCatalogIncluded?: boolean;
  itemCatalogEntryId?: string;
};
export type InstanceQuery = {
  type: "instanceQuery";
  entityId?: string;
  owner?: EntityOwner;
  quantifier: "some" | "all" | "count";
  filters?: ConditionInput;
  operator?: LogicComparisonOperator;
  value?: number;
};
export type InstanceEffect = {
  type: "instanceEffect";
  conditions?: ConditionInput;
  operation: "create" | "move" | "modify" | "remove";
  entityId?: string;
  instanceId?: string;
  instanceIds?: string[];
  selection?: "all" | "selected";
  query?: Omit<InstanceQuery, "type" | "quantifier" | "operator" | "value">;
  owner?: EntityOwner | null;
  name?: string;
  properties?: Record<string, unknown>;
  states?: Record<string, boolean>;
};
export type NarrativeEffect = Consequence | InstanceEffect;
export type NarrativeAction = {
  id: string;
  name: string;
  description?: string;
  entityId?: string;
  typeId?: string;
  source?: "canon" | "local";
  /** Individual action replaces this inherited type action, including disabling it. */
  overridesActionId?: string;
  enabled?: boolean;
  requiresTarget?: boolean;
  when?: ConditionInput;
  effects?: NarrativeEffect[];
  targetNodeId?: string;
  navigation?: "call" | "jump";
  repeat?: "once" | "each-entry";
};
export type NarrativeRule = {
  id: string;
  name: string;
  trigger: "enter" | "continue" | "stateChanged";
  scope: { kind: "global" } | { kind: "event" | "dialogue" | "node"; id: string };
  when?: ConditionInput;
  effects?: NarrativeEffect[];
  targetNodeId?: string;
  priority?: number;
  repeat?: "once" | "each-entry";
};
export type AuthoringScenario = {
  id: string;
  name: string;
  actor?: LogicSubject;
  profileId?: string;
  startNodeId?: string;
  state?: PlayerSimulationState;
};

export type PlayerProfile = {
  id: string;
  name: string;
  playableCharacterRef?: string;
  playableVariantId?: string;
  simulation: PlayerSimulationState;
};

export type ScriptBlockKind = "scene" | "direction" | "speech" | "annotation";

export type ScriptBlock = {
  id: string;
  kind: ScriptBlockKind;
  /** Stable key into the story localization catalog. */
  textKey?: string;
  content: string;
  /** Localized alternatives keyed by language code; `content` remains the primary text. */
  translations?: Record<string, string>;
  /** Canon identity selected while authoring. Engine speaker ids are resolved at export time. */
  characterRef?: string;
  /** @deprecated Use `characterRef`; retained for v0.1 project compatibility. */
  speakerRef?: string;
  /** Local speech-beat choice of a named WorldNotion variant. */
  characterVariantId?: string;
};

export type LocalizationEntry = {
  values: Record<string, string>;
};

export type LocalizationCatalog = {
  primaryLocale?: string;
  locales?: string[];
  entries: Record<string, LocalizationEntry>;
};

export type ScriptDocument = {
  id: string;
  name: string;
  format: "forge-script";
  blocks: ScriptBlock[];
  createdAt?: string;
  updatedAt?: string;
};

export type ScriptBlockRef = {
  scriptId: string;
  blockId: string;
};

export type StoryTextBlock = {
  format: "plain" | "ink" | "harlowe" | "sugarcube" | string;
  content: string;
};

export type EventCategoryDefinition = {
  id: string;
  label: string;
  description?: string;
  color?: string;
  terminal?: boolean;
};

export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiSelect"
  | "canonRef"
  | "canonRefList"
  | "dataRef"
  | "dataRefList"
  | "scriptRef"
  | "unknown"
  | string;

export type DataFieldDefinition = {
  name: string;
  type: FieldType;
  label?: string;
  description?: string;
  required?: boolean;
  options?: string[];
  acceptedClasses?: string[];
  acceptedCanonKinds?: string[];
  defaultValue?: unknown;
};

export type DataClassDefinition = {
  id: string;
  label: string;
  description?: string;
  extends?: string;
  category?:
    "canonProjection" | "narrative" | "runtime" | "engineAdapter" | string;
  roles?: string[];
  fields: DataFieldDefinition[];
};

export type ProjectionFieldMapping = {
  targetField: string;
  sourcePath?: string;
  value?: unknown;
  transform?: string;
  required?: boolean;
};

export type ProjectionRule = {
  id: string;
  label?: string;
  from: {
    layer: "worldnotion" | "pathbranching" | "engine" | string;
    type?: string;
    classId?: string;
    role?: string;
  };
  to: {
    layer: "pathbranching" | "engine" | string;
    classId: string;
    adapter?: string;
  };
  fieldMappings: ProjectionFieldMapping[];
  conditions?: ConditionInput;
};

export type GraphPortDefinition = {
  id: string;
  label?: string;
  direction: "input" | "output";
  accepts?: string[];
  required?: boolean;
};

export type GraphModuleDefinition = {
  id: string;
  label: string;
  graph: "narrative" | "script" | "data" | "projection" | "engine" | string;
  nodeType: string;
  description?: string;
  dataClassId?: string;
  ports: GraphPortDefinition[];
  exportAs?: {
    layer: "runtimePackage" | "engineAdapter" | string;
    type: string;
  };
};

export type CanvasScope =
  | {
      kind: "sequence";
      id: string;
    }
  | {
      kind: "event";
      id: string;
    }
  | {
      kind: "dialogue";
      id: string;
      eventId: string;
    };

export type Sequence = {
  id: string;
  name: string;
  /** Canon characters who can lead the sequence across multiple points of view. */
  characterRefs?: string[];
  /** @deprecated Read for projects authored before multiple sequence leads were supported. */
  characterRef?: string;
  entryEventId: string;
  entryLabel?: string;
  eventIds: string[];
  branchIds?: string[];
  logic?: LogicMoment;
  availability?: ConditionInput;
  consequences?: Consequence[];
  legacyUnity?: Record<string, unknown>;
};

export type Branch = {
  id: string;
  title: string;
  description?: string;
  color?: string;
  eventIds: string[];
  logic?: LogicMoment;
  availability?: ConditionInput;
  consequences?: Consequence[];
  legacyUnity?: Record<string, unknown>;
};

export type EventType = "normal" | "exploration" | "final" | string;

export type SpeechBeatLengthTarget = {
  unit: "words" | "characters";
  /** Suggested maximum for every speech beat in this event. */
  target: number;
};

/**
 * Universe-scoped default for the speech-beat length counter. Persisted with
 * the project so the preference travels with the universe instead of living in
 * local application settings. Individual events may still override it through
 * their own {@link SpeechBeatLengthTarget}.
 */
export type SpeechBeatCounterPreference = {
  enabled: boolean;
  unit: "words" | "characters";
  target: number;
};

export type AuthoringPreferences = {
  speechBeatCounter?: SpeechBeatCounterPreference;
};

export type EventNode = {
  id: string;
  legacyId?: string;
  name: string;
  description?: string;
  /** Optional cover image shown on the parent sequence canvas. */
  coverImage?: SceneImageAttachment;
  type: EventType;
  parentEventId?: string;
  childEventIds?: string[];
  text?: StoryTextBlock;
  branchRef?: string | null;
  script?: ScriptRef;
  canonRefs?: string[];
  /** Canon or local location entity where this event takes place (entity type must be marked as a location via LogicTypeOverride). */
  locationRef?: string;
  /** Canon entities configured as present in this event. */
  presentEntityRefs?: string[];
  logic?: LogicMoment;
  availability?: ConditionInput;
  decisions?: Decision[];
  /** Gameplay interactions are authored data, independent of canvas placement. */
  interactionDefinitions?: InteractionDefinition[];
  interactionUses?: InteractionUse[];
  interactionBarriers?: InteractionBarrier[];
  /** Optional pacing target displayed on each speech beat in this event. */
  speechBeatLengthTarget?: SpeechBeatLengthTarget;
  /** Narrative beats authored directly on the event canvas. */
  dialogueBeats?: DialogueBeat[];
  dialogues?: DialogueNode[];
  dialogueStarts?: DialogueStart[];
  boundaryBindings?: BoundaryPortBinding[];
  consequences?: Consequence[];
  transitions?: Transition[];
  legacyUnity?: Record<string, unknown>;
};

export type InteractionValueSource =
  | { kind: "variable"; variableId: string }
  | { kind: "property"; subject: LogicSubject; propertyId: string };
export type InteractionModifierRule = { id: string; name: string; conditions?: ConditionInput; modifier: number };
export type InteractionModifierTrace = { ruleId: string; name: string; modifier: number };
/** A stable role in one local interaction, independent of canon identity. */
export type InteractionParticipant = {
  id: string;
  subject: LogicSubject;
  skill?: InteractionValueSource;
  /** Missing dice uses the opposed check's common dice pool. */
  dice?: InteractionDice;
  modifier: number;
  modifierRules?: InteractionModifierRule[];
  dicePresetId?: string;
};
/** Captured at execution start; rolls and totals are filled once on resolution. */
export type InteractionParticipantTrace = {
  participantId: string;
  subject: LogicSubject;
  variantId?: string;
  skillSource?: InteractionValueSource;
  skillLabel?: string;
  skillValue: number;
  modifier: number;
  dice?: InteractionDice;
  modifierBreakdown?: InteractionModifierTrace[];
  rolls?: number[];
  total?: number;
};
/** Result is from the actor's perspective against this particular rival. */
export type InteractionParticipantResult = {
  resultId: string;
  total: number;
  rolls: number[];
  subject: LogicSubject;
  variantId?: string;
  skillSource?: InteractionValueSource;
  skillLabel?: string;
  skillValue: number;
  modifier: number;
  dice?: InteractionDice;
  modifierBreakdown?: InteractionModifierTrace[];
};
export type InteractionDiceGroup = { id: string; count: number; sides: number; minimum?: number };
/** Without groups this is a homogeneous pool; groups, when present, are authoritative. */
export type InteractionDice = { count: number; sides: number; minimum?: number; groups?: InteractionDiceGroup[] };
export type InteractionMechanic =
  | ({ kind: "dice"; modifier: number; actor?: LogicSubject; skill?: InteractionValueSource; modifierRules?: InteractionModifierRule[]; dicePresetId?: string } & InteractionDice)
  | { kind: "skillcheck"; actor?: LogicSubject; skill?: InteractionValueSource; difficulty: number; difficultyOperator?: ">=" | ">"; modifier: number; modifierRules?: InteractionModifierRule[]; dice?: InteractionDice; dicePresetId?: string }
  | { kind: "opposedcheck"; actor: InteractionParticipant; rivals: InteractionParticipant[]; aggregation: "all" | "any"; commonDice?: InteractionDice; commonDicePresetId?: string }
  | { kind: "qte"; key: string; durationMs: number }
  | { kind: "custom"; description: string; parameters?: Record<string, unknown> };
export type InteractionResult = {
  id: string;
  name: string;
  /** Legacy min/max ranges remain inclusive. Omitted bounds are open; endpoint flags control inclusion. */
  key?: "success" | "failure" | "timeout" | "tie";
  range?: { min?: number; max?: number; minInclusive?: boolean; maxInclusive?: boolean };
  effects?: NarrativeEffect[];
};
export type InteractionPresetOrigin = { presetId: string; revision: number; customized?: boolean; baseline?: InteractionMechanic; resultBaseline?: InteractionResult[] };
export type InteractionDefinition = { id: string; name: string; prompt?: StoryTextBlock & { translations?: Record<string, string> }; mechanic: InteractionMechanic; results: InteractionResult[]; presetOrigin?: InteractionPresetOrigin; mechanicPending?: boolean };
/** Universe authoring catalog. Applied mechanics are copied into each story use. */
export type InteractionMechanicPreset = { id: string; revision: number; name: string; description?: string; previewImageAssetId?: string; /** Pure reusable dice set. Recipe remains readable for existing documents. */ presetKind?: "dice" | "recipe"; mechanic: InteractionMechanic; results: InteractionResult[]; updatedAt?: string; builtIn?: boolean };
export type InteractionMechanicsLibrary = { version: 1; presets: InteractionMechanicPreset[] };
export type InteractionUse = {
  id: string;
  definitionId: string;
  dialogueId?: string;
  /** Absent owner means an independent interaction node. */
  ownerNodeId?: string;
  moment: "before" | "during" | "after";
};
export type InteractionBarrier = { id: string; name: string; dialogueId?: string; useIds: string[] };

export type DecisionType = "dialogue" | "dice" | "qte" | string;
export type OutcomePresentationStyle = "visibleText" | "iconOnly";
/** Optional project-wide presentation overrides. Missing values keep per-node settings. */
export type LogicFormats = {
  decisionOptionStyle?: OutcomePresentationStyle;
  unavailableBehavior?: "locked" | "hidden";
  unavailableText?: string;
  lockText?: string;
};

export type Decision = {
  id: string;
  name: string;
  description?: string;
  type: DecisionType;
  optionStyle?: OutcomePresentationStyle;
  /** @deprecated Legacy grouping only. Decisions now belong directly to the event. */
  dialogueId?: string;
  logic?: LogicMoment;
  availability?: ConditionInput;
  unavailableBehavior?: "locked" | "hidden";
  lockText?: StoryTextBlock;
  outcomes: Outcome[];
};

export type DialogueNode = {
  id: string;
  title: string;
  entryBeatId?: string;
  beats?: DialogueBeat[];
  members?: DialogueMemberRef[];
  speakerRef?: string;
  text: StoryTextBlock;
  logic?: LogicMoment;
  availability?: ConditionInput;
  consequences?: Consequence[];
  canonRefs?: string[];
  /** Characters present in this conversation; independent from its owning event. */
  presentEntityRefs?: string[];
  /** Starting place for this conversation; independent from its owning event. */
  locationRef?: string;
};

export type DialogueMemberRef =
  | { kind: "beat"; id: string }
  | { kind: "decision"; id: string };

export type DialogueStart = {
  id: string;
  logic?: LogicMoment;
  /** @deprecated Migrated to a graph transition targeting the Dialogue node. */
  dialogueId?: string;
  /** @deprecated Automatic starts are represented by the event's normal entry route. */
  mode?: "automatic" | "interaction";
  source?: {
    kind: "canonRef" | "dataObject";
    id: string;
    /** Property on a present canon entity that exposes the interaction. */
    propertyId?: string;
  };
  availability?: ConditionInput;
};

export type DialogueBeat = {
  id: string;
  kind: "speech" | "direction";
  blockRef: ScriptBlockRef;
  /** Optional authoring note attached to a speech beat, not spoken aloud. */
  directorNote?: string;
  /** Optional visual cue shown while this speech beat is active. */
  sceneImage?: SceneImageAttachment;
  /** @deprecated Migrated to the single `sceneImage` attachment. */
  sceneImages?: SceneImageAttachment[];
  logic?: LogicMoment;
  displayCondition?: ConditionInput;
  /** Fires when this beat is reached — e.g. grant/remove a grantable at this exact line. */
  consequences?: Consequence[];
  /** Optional override of the owning event's `locationRef` for this beat. */
  locationRef?: string;
};

export type BoundaryPortBinding = {
  id: string;
  portId: string;
  nodeId: string;
  direction: "input" | "output";
};

export type Outcome = {
  id: string;
  name: string;
  /** Text shown to the player when the decision uses visible text options. */
  visibleText?: string;
  description?: string;
  icon?: string;
  requiredCanonRefs?: string[];
  logic?: LogicMoment;
  availability?: ConditionInput;
  unavailableBehavior?: "locked" | "hidden";
  /** Replaces the response label while unavailable; blank keeps the normal label. */
  unavailableText?: StoryTextBlock;
  /** Optional explanation displayed beneath a locked response. */
  lockText?: StoryTextBlock;
  conditions?: ConditionInput;
  consequences?: Consequence[];
};

export type Condition =
  | LogicPredicate
  | { type: "interactionResult"; useId: string; resultId: string; operator: "==" | "!="; participantId?: string }
  | {
      type: "canonEntryUnlocked";
      ref: string;
      negate?: boolean;
    }
  | {
      type: "canonProperty";
      ref: string;
      property: string;
      operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "exists";
      value?: unknown;
    }
  | {
      type: "canonState";
      ref: string;
      state: string;
      operator: "==" | "!=" | "contains" | "exists";
      value?: unknown;
    }
  | {
      type: "variable";
      name: string;
      operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
      value: unknown;
    }
  | {
      type: "externalFunction";
      name: string;
      arguments?: unknown[];
    }
  | {
      type: "dataObjectExists";
      objectId: string;
    }
  | {
      type: "dataObjectField";
      objectId: string;
      field: string;
      operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "exists";
      value?: unknown;
    }
  | {
      type: "runtimeItem";
      itemId: string;
      operator?: "has" | "missing";
    }
  | {
      type: "visited";
      targetType: "sequence" | "branch" | "event" | "decision" | "outcome";
      targetId: string;
      negate?: boolean;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

export type ConditionSet =
  | {
      all: ConditionExpression[];
      label?: string;
    }
  | {
      any: ConditionExpression[];
      label?: string;
    }
  | {
      not: ConditionExpression;
      label?: string;
    };

export type ConditionExpression = Condition | ConditionSet;

export type ConditionInput = ConditionExpression | ConditionExpression[];

export type Consequence =
  | LogicEffect
  | {
      type: "addGrantable";
      entityId: string;
      conditions?: ConditionInput;
    }
  | {
      type: "removeGrantable";
      entityId: string;
      conditions?: ConditionInput;
    }
  | {
      type: "editGrantable";
      entityId: string;
      propertyId: string;
      value: unknown;
      conditions?: ConditionInput;
    }
  | {
      type: "setVariable";
      name: string;
      value: unknown;
      conditions?: ConditionInput;
    };

export type Transition = {
  id: string;
  from: string;
  to: string;
  role?: "flow" | "route";
  logic?: LogicMoment;
  label?: string;
  order?: number;
  mode?: "conditional" | "fallback";
  conditions?: ConditionInput;
  consequences?: Consequence[];
  source?: "graph" | "inkDivert" | "inkExternalFunction" | "engine" | string;
  function?: string;
  arguments?: unknown[];
};

export type CanonRoleMapping = {
  id: string;
  worldnotionTypes: string[];
  classId: string;
  roles: string[];
  comparableProperties?: string[];
  states?: string[];
};

export type PathBranchingIntegrationConfig = {
  specVersion: "0.1";
  mappings: CanonRoleMapping[];
};

export type ProjectDataObjectScope = {
  sequenceId?: string;
  branchId?: string;
  eventId?: string;
  global?: boolean;
};

export type ProjectDataObject = {
  id: string;
  classId: string;
  name: string;
  canonRefs?: string[];
  fields: Record<string, unknown>;
  tags?: string[];
  scope?: ProjectDataObjectScope;
  logic?: LogicMoment;
  availability?: ConditionInput;
  consequences?: Consequence[];
};

export type ExternalFunction = {
  name: string;
  kind:
    | "condition"
    | "consequence"
    | "transition"
    | "runtimeAction"
    | "engineSignal"
    | string;
  mapsTo?: string;
  arguments?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "unknown" | string;
  }>;
};

export type EngineTarget = {
  adapter: string;
  minimumAdapterVersion?: string;
  [key: string]: unknown;
};

export type CanvasNodeAuthoringState = {
  position?: {
    x: number;
    y: number;
  };
  /** The author explicitly dragged this route gate. */
  manual?: boolean;
  /** A stable route-gate anchor captured when canvas positions are persisted. */
  positionPinned?: boolean;
  collapsed?: boolean;
  auxiliaryPanels?: {
    directorNote?: boolean;
    sceneImage?: boolean;
    coverImage?: boolean;
    description?: boolean;
  };
};

export type ScopedCanvasAuthoringState = {
  nodes?: Record<string, CanvasNodeAuthoringState>;
  /** Manually placed control points for transition paths in this canvas scope. */
  edgeWaypoints?: Record<string, Array<{ x: number; y: number }>>;
  routeGateSources?: string[];
  /** Empty Entry ports explicitly added by the author in an event subcanvas. */
  entrySlots?: string[];
  /** Empty End ports explicitly added by the author in an event subcanvas. */
  exitSlots?: string[];
  workspace?: {
    x: number;
    y: number;
    width: number;
    height: number;
    manual?: boolean;
  };
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
};

export type CanvasAuthoringState = {
  activeSequenceId?: string;
  activeScope?: CanvasScope;
  nodes?: Record<string, CanvasNodeAuthoringState>;
  /** Manually placed control points for transition paths outside a scoped canvas. */
  edgeWaypoints?: Record<string, Array<{ x: number; y: number }>>;
  routeGateSources?: string[];
  scopes?: Record<string, ScopedCanvasAuthoringState>;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
};

export type PanelAuthoringState = {
  canonOpen?: boolean;
  filesOpen?: boolean;
};

export type BranchingProject = {
  canonPropertyDescriptors?: CanonPropertyDescriptor[];
  specVersion: "0.1";
  projectId: string;
  storyId?: string;
  universeRootPath?: string;
  name?: string;
  sourceVault?: {
    kind: "worldnotion" | string;
    relativePath?: string;
    absolutePath?: string;
  };
  dataClasses?: DataClassDefinition[];
  projectDataObjects?: ProjectDataObject[];
  canonEditSuggestions?: CanonEditSuggestion[];
  canonWorkingCopies?: CanonWorkingCopy[];
  canonChangeSets?: CanonChangeSet[];
  localExplorerEntities?: LocalExplorerEntity[];
  localExplorerTypes?: LocalExplorerType[];
  localExplorerProperties?: LocalExplorerProperty[];
  assets?: ProjectAsset[];
  scriptDocuments?: ScriptDocument[];
  localizationCatalog?: LocalizationCatalog;
  integrationConfig?: PathBranchingIntegrationConfig;
  integrationConfigOverride?: PathBranchingIntegrationConfig;
  logicVariableGroups?: LogicVariableGroup[];
  logicVariables?: LogicVariable[];
  logicFormats?: LogicFormats;
  logicPropertyOverrides?: LogicPropertyOverride[];
  logicTypeOverrides?: LogicTypeOverride[];
  /** Image-gallery overrides for canon (WorldNotion) entities, keyed by canonRef id — pathbranching cannot write into the vault directly. */
  canonEntityGalleries?: Record<string, string[]>;
  playerSimulation?: PlayerSimulationState;
  playerProfiles?: PlayerProfile[];
  activePlayerProfileId?: string;
  entityInstances?: EntityInstance[];
  entityOverrides?: EntityCapabilityOverride[];
  narrativeActions?: NarrativeAction[];
  narrativeRules?: NarrativeRule[];
  authoringScenarios?: AuthoringScenario[];
  projectionRules?: ProjectionRule[];
  graphModules?: GraphModuleDefinition[];
  canvas?: CanvasAuthoringState;
  panels?: PanelAuthoringState;
  authoringPreferences?: AuthoringPreferences;
  entrySequenceId?: string;
  eventCategories?: EventCategoryDefinition[];
  canonRefs: CanonRef[];
  sequences: Sequence[];
  branches: Branch[];
  events: EventNode[];
  scripts: ScriptRef[];
  externalFunctions: ExternalFunction[];
  variables: Record<string, unknown>;
  engineTargets?: Record<string, EngineTarget>;
};

export type RuntimeChoice = {
  id: string;
  textKey: string;
  targetNodeId: string;
  conditions?: ConditionInput;
  consequences?: Consequence[];
  logic?: LogicMoment;
  unavailableBehavior?: "locked" | "hidden";
  unavailableTextKey?: string;
  lockTextKey?: string;
};

export type RuntimeSceneImage = {
  id: string;
  assetId: string;
  path: string;
  name: string;
  extension?: string;
};

export type RuntimeNode = {
  id: string;
  type: string;
  textKey?: string;
  speakerRef?: string;
  characterRef?: string;
  characterVariantId?: string;
  coverImage?: RuntimeSceneImage;
  sceneImage?: RuntimeSceneImage;
  choices?: RuntimeChoice[];
  decisionOptionStyle?: OutcomePresentationStyle;
  conditions?: ConditionInput;
  consequences?: Consequence[];
  logic?: LogicMoment;
  [key: string]: unknown;
};

export type RuntimePackage = {
  specVersion: "0.1";
  packageId: string;
  entryNodeId: string;
  canonRefs: CanonRef[];
  variables: Record<string, unknown>;
  localization?: Record<string, string>;
  primaryLocale?: string;
  localizations?: Record<string, Record<string, string>>;
  nodes: RuntimeNode[];
  pathBranching?: Record<string, unknown>;
  engineTargets?: Record<string, EngineTarget>;
};

export type ValidationSeverity = "info" | "warning" | "error";

export type ValidationFinding = {
  code:
    | "missing_entry_sequence"
    | "missing_entry_event"
    | "missing_event"
    | "missing_dialogue"
    | "missing_script"
    | "missing_branch"
    | "missing_canon_ref"
    | "missing_canon_identity"
    | "duplicate_id"
    | "broken_transition"
    | "invalid_branch_membership"
    | "invalid_nested_event"
    | "invalid_boundary_binding"
    | "invalid_final_transition"
    | "invalid_projection"
    | "missing_data_class"
    | "missing_data_object"
    | "missing_required_field"
    | "invalid_frontmatter"
    | "invalid_worldnotion_properties"
    | "invalid_condition"
    | "invalid_consequence"
    | "missing_grantable_entity"
    | "invalid_transition_order"
    | "duplicate_fallback"
    | "no_valid_transition"
    | "missing_script_block"
    | "orphan_script_block"
    | "duplicate_script_binding"
    | "invalid_speaker_role"
    | "invalid_speaker_presence"
    | "invalid_character_variant"
    | "missing_scene_image"
    | "invalid_scene_image"
    | "missing_event_cover_image"
    | "invalid_event_cover_image"
    | "invalid_dialogue_trigger"
    | "invalid_scope_transition"
    | "invalid_interaction";
  severity: ValidationSeverity;
  message: string;
  id?: string;
  ref?: string;
};
