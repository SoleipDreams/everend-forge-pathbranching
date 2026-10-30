import { useApplicationEffect } from "./useApplicationActivity.js";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Info,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { Selection } from "../appTypes.js";
import type {
  BranchingProject,
  ExplorerPropertyOption,
  LocalExplorerProperty,
  LogicPropertyOverride,
  LogicFormats,
  LogicTypeOverride,
  LogicVariable,
  LogicVariableGroup,
  LogicVariableType,
} from "../domain.js";
import {
  canonExplorerPropertyTypes,
  canonExplorerTypeProperty,
  findLocalExplorerPropertyInTree,
  flattenLocalExplorerPropertyTree,
  isLocalExplorerSubproperty,
  flattenCanonExplorerProperties,
  propertyCapability,
  typeCapability,
  type CanonExplorerProperty,
} from "../explorerSchema.js";
import { ExplorerGroup, ExplorerPane, useExplorerOverlayBounds } from "./ExplorerPresentation.js";
import { WorkspaceSidePanel } from "./WorkspaceSidePanel.js";
import { AccessibleTabs } from "./AccessibleTabs.js";
import { PropertyCapabilitiesEditor } from "./PropertyCapabilitiesEditor.js";
import { panelUiText, useInterfaceLocale } from "../i18n.js";
import { useOverlayFocus } from "./useOverlayFocus.js";

const CLICK_SEQUENCE_WINDOW_MS = 360;
const variableTypes: LogicVariableType[] = ["text", "number", "boolean", "list", "canonRef"];
const propertyTypes = [
  ["entity-type", "Entity type"],
  ["text", "Text"],
  ["number", "Number"],
  ["boolean", "Boolean"],
  ["date", "Date"],
  ["entity-ref", "Entity reference"],
  ["entity-ref-list", "Entity reference list"],
  ["select", "Select"],
  ["multiselect", "Multi-select"],
  ["group", "Group (nested properties)"],
] as const;
type PropertySource = "canon" | "local";
type PropertyEditorState = { id: string; source: PropertySource; top: number; left: number };

function optionKey(index: number) {
  return `option-${index + 1}`;
}

export function LogicPanel({
  project,
  propertiesConfig,
  collapsed,
  onCollapsedChange,
  onContextMenu,
  onUpdate,
  selected,
  onSelect,
  onOpenInspector,
  onCreateProperty,
  onInitializeProperties,
  onUpdateLocalExplorerProperty,
  onUpdateLogicPropertyOverride,
  onUpdateLogicTypeOverride,
  onDeleteLocalExplorerProperty,
  propertyFocusRequest,
}: {
  project: BranchingProject;
  propertiesConfig?: Record<string, unknown>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onUpdate: (project: BranchingProject) => void;
  selected?: Selection;
  onSelect: (selection: Selection) => void;
  onOpenInspector: (selection: Selection) => void;
  propertyFocusRequest?: { id: string; source: PropertySource; revision: number };
  onCreateProperty: (
    label: string,
    valueType: LocalExplorerProperty["valueType"],
    options?: {
      description?: string;
      required?: boolean;
      options?: ExplorerPropertyOption[];
      targetTypes?: string[];
      appliesToTypes?: string[];
      icon?: string;
      color?: string;
      suggestedFolder?: string;
    },
    parentPropertyId?: string,
  ) => void;
  onInitializeProperties?: () => void;
  onUpdateLocalExplorerProperty: (id: string, updates: Partial<LocalExplorerProperty>) => void;
  onUpdateLogicPropertyOverride: (
    propertyId: string,
    source: PropertySource,
    changes: Partial<LogicPropertyOverride>,
  ) => void;
  onUpdateLogicTypeOverride: (
    typeId: string,
    source: PropertySource,
    changes: Partial<LogicTypeOverride>,
  ) => void;
  onDeleteLocalExplorerProperty?: (id: string) => boolean | void;
  onCreateType?: () => void;
}) {
  const locale = useInterfaceLocale();
  const t = (text: string) => panelUiText(locale, text);
  const [tab, setTab] = useState<"properties" | "variables" | "formats">("properties");
  const [propertySearch, setPropertySearch] = useState("");
  useEffect(() => {
    if (!propertyFocusRequest) return;
    setTab('properties');
    setPropertySearch(propertyFocusRequest.source === 'canon'
      ? project.canonPropertyDescriptors?.find(field => field.id === propertyFocusRequest.id)?.label ?? propertyFocusRequest.id
      : findLocalExplorerPropertyInTree(project.localExplorerProperties, propertyFocusRequest.id)?.label ?? propertyFocusRequest.id);
  }, [propertyFocusRequest]);
  const [collapsedPropertyGroups, setCollapsedPropertyGroups] = useState<Set<string>>(() => {
    const canonPropertyTypes = canonExplorerPropertyTypes(propertiesConfig);
    const localProperties = flattenLocalExplorerPropertyTree(project.localExplorerProperties)
      .map((property) => property.id);
    return new Set([...canonPropertyTypes.map((type) => type.id), ...localProperties]);
  });
  const [propertyEditor, setPropertyEditor] = useState<PropertyEditorState>();
  const [createPropertyMenu, setCreatePropertyMenu] = useState<{ top: number; left: number; parentPropertyId?: string } | undefined>();
  const [newPropertyState, setNewPropertyState] = useState<{
    label: string;
    valueType: LocalExplorerProperty["valueType"];
    description: string;
    required: boolean;
    options: ExplorerPropertyOption[];
    targetTypes: string[];
    appliesToTypes: string[];
    icon?: string;
    color?: string;
    suggestedFolder?: string;
  }>({
    label: "",
    valueType: "text",
    description: "",
    required: false,
    options: [],
    targetTypes: [],
    appliesToTypes: [],
    icon: undefined,
    color: undefined,
    suggestedFolder: undefined,
  });
  const editorRef = useRef<HTMLDivElement>(null);
  const createPropertyRef = useRef<HTMLDivElement | null>(null);
  useExplorerOverlayBounds(editorRef, Boolean(propertyEditor));
  useExplorerOverlayBounds(createPropertyRef, Boolean(createPropertyMenu));
  useOverlayFocus(editorRef, Boolean(propertyEditor), () => setPropertyEditor(undefined));
  useOverlayFocus(createPropertyRef, Boolean(createPropertyMenu), () => setCreatePropertyMenu(undefined));
  const pendingInspectorClickRef = useRef<{ propertyId: string; source: PropertySource; timer: number } | undefined>(undefined);
  const groups = [...(project.logicVariableGroups ?? [])].sort((a, b) => a.order - b.order);
  const canonPropertyTypes = useMemo(() => canonExplorerPropertyTypes(propertiesConfig), [propertiesConfig]);
  const localProperties = project.localExplorerProperties ?? [];
  const canonProperties = useMemo(
    () => canonPropertyTypes.flatMap((type) => [canonExplorerTypeProperty(type), ...flattenCanonExplorerProperties(type.properties)]),
    [canonPropertyTypes],
  );
  const editingProperty = propertyEditor
    ? propertyEditor.source === "canon"
      ? canonProperties.find((property) => property.id === propertyEditor.id)
      : findLocalExplorerPropertyInTree(localProperties, propertyEditor.id)
    : undefined;
  const editingCapability = editingProperty && propertyEditor
    ? propertyCapability(project, propertyEditor.source, editingProperty.id)
    : undefined;
  const isCanonEditor = propertyEditor?.source === "canon";
  const isLocalSubproperty = Boolean(propertyEditor?.source === "local"
    && isLocalExplorerSubproperty(localProperties, propertyEditor.id));
  const editingTypeId = editingProperty?.id.startsWith("type:") ? editingProperty.id : undefined;
  const editingTypeCapability = editingTypeId && propertyEditor
    ? typeCapability(project, propertyEditor.source, editingTypeId)
    : undefined;

  useApplicationEffect(() => {
    if (!propertyEditor) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !editorRef.current?.contains(event.target)) {
        setPropertyEditor(undefined);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPropertyEditor(undefined);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [propertyEditor]);

  useApplicationEffect(() => {
    if (!createPropertyMenu) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !createPropertyRef.current?.contains(event.target)) {
        setCreatePropertyMenu(undefined);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreatePropertyMenu(undefined);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [createPropertyMenu]);

  const updateGroups = (next: LogicVariableGroup[]) => onUpdate({ ...project, logicVariableGroups: next });
  const updateVariables = (next: LogicVariable[]) => onUpdate({ ...project, logicVariables: next });
  const updateFormats = (changes: Partial<LogicFormats>) => onUpdate({ ...project, logicFormats: { ...project.logicFormats, ...changes } });
  const addGroup = () => updateGroups([...groups, { id: `group:${crypto.randomUUID()}`, name: `Group ${groups.length + 1}`, order: groups.length }]);
  const addVariable = (groupId: string) => updateVariables([
    ...(project.logicVariables ?? []),
    { id: `variable:${crypto.randomUUID()}`, name: `variable_${(project.logicVariables?.length ?? 0) + 1}`, type: "text", value: "", groupId },
  ]);
  const variableValue = (variable: LogicVariable) => variable.type === "list" && Array.isArray(variable.value) ? variable.value.join(", ") : String(variable.value);
  const updateVariable = (id: string, changes: Partial<LogicVariable>) => updateVariables((project.logicVariables ?? []).map((variable) => variable.id === id ? { ...variable, ...changes } : variable));
  const togglePropertyGroup = (propertyId: string) => setCollapsedPropertyGroups((current) => {
    const next = new Set(current);
    if (next.has(propertyId)) next.delete(propertyId); else next.add(propertyId);
    return next;
  });
  const expandAllProperties = () => {
    setCollapsedPropertyGroups(new Set());
  };
  const collapseAllProperties = () => {
    setCollapsedPropertyGroups(new Set([
      ...canonPropertyTypes.map((type) => type.id),
      ...flattenLocalExplorerPropertyTree(localProperties).map((property) => property.id),
    ]));
  };
  const revealLocalPropertyPath = (propertyId: string) => {
    const path: string[] = [];
    const visit = (properties: LocalExplorerProperty[]): boolean => {
      for (const property of properties) {
        if (property.id === propertyId) {
          path.push(property.id);
          return true;
        }
        if (property.children?.length && visit(property.children)) {
          path.unshift(property.id);
          return true;
        }
      }
      return false;
    };
    if (!visit(localProperties)) return;
    setCollapsedPropertyGroups((current) => new Set([...current].filter((id) => !path.includes(id))));
  };

  const clearPendingInspectorClick = () => {
    if (pendingInspectorClickRef.current) {
      window.clearTimeout(pendingInspectorClickRef.current.timer);
      pendingInspectorClickRef.current = undefined;
    }
  };

  const handleCreateProperty = () => {
    const trimmedLabel = newPropertyState.label.trim();
    if (!trimmedLabel) return;
    onCreateProperty(trimmedLabel, newPropertyState.valueType, {
      description: newPropertyState.description || undefined,
      required: newPropertyState.required || undefined,
      options: newPropertyState.options.length ? newPropertyState.options : undefined,
      targetTypes: newPropertyState.targetTypes.length ? newPropertyState.targetTypes : undefined,
      appliesToTypes: newPropertyState.appliesToTypes.length ? newPropertyState.appliesToTypes : undefined,
      icon: newPropertyState.icon || undefined,
      color: newPropertyState.color || undefined,
      suggestedFolder: newPropertyState.suggestedFolder || undefined,
    }, createPropertyMenu?.parentPropertyId);
    if (createPropertyMenu?.parentPropertyId) revealLocalPropertyPath(createPropertyMenu.parentPropertyId);
    setCreatePropertyMenu(undefined);
    setNewPropertyState({
      label: "",
      valueType: "text",
      description: "",
      required: false,
      options: [],
      targetTypes: [],
      appliesToTypes: [],
      icon: undefined,
      color: undefined,
      suggestedFolder: undefined,
    });
  };

  const handlePropertyPointerDown = (propertyId: string, source: PropertySource) => {
    clearPendingInspectorClick();
    const selection = { type: "explorerProperty" as const, id: propertyId, source };
    const timer = window.setTimeout(() => {
      onOpenInspector(selection);
      pendingInspectorClickRef.current = undefined;
    }, CLICK_SEQUENCE_WINDOW_MS);
    pendingInspectorClickRef.current = { propertyId, source, timer };
  };

  const handlePropertyPointerUp = (propertyId: string, source: PropertySource) => {
    if (pendingInspectorClickRef.current) {
      clearPendingInspectorClick();
      onSelect({ type: "explorerProperty" as const, id: propertyId, source });
    }
  };

  const openPropertyEditor = (event: ReactMouseEvent<HTMLButtonElement>, id: string, source: PropertySource) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 340;
    const height = 600;
    const viewportWidth = typeof window === "undefined" ? width + 24 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? height + 24 : window.innerHeight;
    setPropertyEditor({
      id,
      source,
      top: Math.max(8, Math.min(rect.top, viewportHeight - height - 8)),
      left: Math.max(8, Math.min(rect.right + 8, viewportWidth - width - 8)),
    });
    onSelect({ type: "explorerProperty", id, source });
  };

  const openCreatePropertyMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    parentPropertyId?: string,
  ) => {
    event.stopPropagation();
    if (createPropertyMenu) {
      setCreatePropertyMenu(undefined);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const width = 340;
    const height = 600;
    const viewportWidth = typeof window === "undefined" ? width + 24 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? height + 24 : window.innerHeight;
    setCreatePropertyMenu({
      top: Math.max(8, Math.min(rect.bottom + 4, viewportHeight - height - 8)),
      left: Math.max(8, Math.min(rect.right - width, viewportWidth - width - 8)),
      ...(parentPropertyId ? { parentPropertyId } : {}),
    });
    setNewPropertyState((current) => ({
      ...current,
      label: "",
      valueType: "text",
      description: "",
      required: false,
      options: [],
      targetTypes: [],
      appliesToTypes: [],
      icon: undefined,
      color: undefined,
      suggestedFolder: undefined,
    }));
  };

  const propertySelected = (id: string, source: PropertySource) => selected?.type === "explorerProperty" && selected.id === id && selected.source === source;
  const propertyCount = (properties: CanonExplorerProperty[]): number => properties.reduce((count, property) => count + 1 + propertyCount(property.children), 0);
  const localPropertyCount = (properties: LocalExplorerProperty[]): number => properties.reduce(
    (count, property) => count + 1 + localPropertyCount(property.children ?? []),
    0,
  );

  const updateLocal = (changes: Partial<LocalExplorerProperty>) => {
    if (propertyEditor?.source === "local" && editingProperty) {
      onUpdateLocalExplorerProperty(editingProperty.id, changes);
    }
  };
  const updateCapability = (changes: Partial<LogicPropertyOverride>) => {
    if (propertyEditor && editingProperty) {
      onUpdateLogicPropertyOverride(editingProperty.id, propertyEditor.source, changes);
    }
  };
  const updateTypeCapability = (changes: Partial<LogicTypeOverride>) => {
    if (propertyEditor && editingTypeId) {
      const normalizedChanges = changes.grantable === undefined
        ? changes
        : {
            ...changes,
            runtimeRoles: [
              ...(editingTypeCapability?.runtimeRoles ?? []).filter((role) => role !== "owned"),
              ...(changes.grantable ? ["owned" as const] : []),
            ],
          };
      // For entity-type properties (prefixed with "type:"), use property overrides
      if (editingTypeId.startsWith("type:")) {
        onUpdateLogicPropertyOverride(editingTypeId, propertyEditor.source, normalizedChanges);
      } else {
        // For legacy local types, use type overrides
        onUpdateLogicTypeOverride(editingTypeId, propertyEditor.source, normalizedChanges);
      }
    }
  };
  const updateOptions = (options: ExplorerPropertyOption[]) => updateLocal({ options: options.length ? options : undefined });

  const renderEditorOptions = () => {
    if (!editingProperty) return null;
    const options = editingProperty.options ?? [];
    return <div className="logic-property-options">
      <div className="logic-property-editor-subheading"><strong>{t("Options")}</strong><span>{options.length}</span></div>
      {options.map((option, index) => <div className="logic-property-option" key={`${option.value}-${index}`}>
        <input aria-label={`${t("Value")} ${index + 1}`} disabled={isCanonEditor} value={option.value} onChange={(event) => updateOptions(options.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} />
        <input aria-label={`${t("Label")} ${index + 1}`} disabled={isCanonEditor} value={option.label} onChange={(event) => updateOptions(options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
        {!isCanonEditor ? <button type="button" className="icon-only" aria-label={`${t("Remove option")} ${index + 1}`} onClick={() => updateOptions(options.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button> : null}
      </div>)}
      {!isCanonEditor ? <button type="button" className="logic-property-add-option" onClick={() => updateOptions([...options, { value: optionKey(options.length), label: `Option ${options.length + 1}` }])}><Plus size={13} /> {t("Add option")}</button> : null}
    </div>;
  };

  const renderPropertyAction = (property: { id: string; label?: string }, source: PropertySource) => <button
    type="button"
    className="icon-only logic-property-edit-button"
    title={t(source === "canon" ? "View imported property" : "Edit property")}
    aria-label={`${t(source === "canon" ? "View imported property" : "Edit property")}: ${property.label ?? property.id}`}
    onClick={(event) => openPropertyEditor(event, property.id, source)}
  ><MoreHorizontal size={14} /></button>;

  const renderCanonProperty = (property: CanonExplorerProperty, depth = 0): ReactNode => (
    <div className="asset-explorer-tree-node" key={`${property.id}-${depth}`} style={{ "--asset-tree-depth": depth } as CSSProperties}>
      <div className={`explorer-entity-row ${propertySelected(property.id, "canon") ? "active" : ""}`}>
        <button
          type="button"
          className="explorer-entity-open"
          title={property.label}
          onClick={(event) => { if (event.detail === 0) onSelect({type:"explorerProperty",id:property.id,source:"canon"}); }}
          onPointerDown={() => handlePropertyPointerDown(property.id, "canon")}
          onPointerUp={() => handlePropertyPointerUp(property.id, "canon")}
          onPointerLeave={clearPendingInspectorClick}
        >
          {property.valueType === "group" ? <Boxes size={14} /> : <CircleDot size={14} />}
          <span className="explorer-entity-name">{property.label}</span>
          <em className="explorer-origin canon">{t(property.valueType)}</em>
          <LockKeyhole className="logic-property-lock" size={12} aria-label={t("Imported from canon")} />
        </button>
        <div className="explorer-row-actions">
          <button
            type="button"
            className="icon-only"
            title={t("View imported property")}
            aria-label={`${t("View imported property")}: ${property.label}`}
            onClick={(event) => openPropertyEditor(event, property.id, "canon")}
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>
      {property.children.length ? (
        <div className="asset-explorer-tree-children">
          {property.children.map((child) => renderCanonProperty(child, depth + 1))}
        </div>
      ) : null}
    </div>
  );

  const renderLocalProperty = (property: LocalExplorerProperty, depth = 0): ReactNode => {
    const children = property.children ?? [];
    const count = localPropertyCount(children);
    const hasChildren = children.length > 0;
    const expanded = hasChildren && (Boolean(propertySearch) || !collapsedPropertyGroups.has(property.id));
    return (
      <div className="asset-explorer-tree-node" key={`${property.id}-${depth}`} style={{ "--asset-tree-depth": depth } as CSSProperties}>
        <div className="logic-local-property-heading">
          <button
            type="button"
            className="logic-property-tree-toggle"
            disabled={!hasChildren}
            aria-label={`${t(expanded ? "Collapse" : "Expand")} ${property.label}`}
            aria-expanded={expanded}
            onClick={() => togglePropertyGroup(property.id)}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className={`explorer-entity-row ${propertySelected(property.id, "local") ? "active" : ""}`}>
            <button
              type="button"
              className="explorer-entity-open logic-property-tree-row"
              title={property.label}
              onClick={(event) => { if (event.detail === 0) onSelect({ type: "explorerProperty", id: property.id, source: "local" }); }}
              onPointerDown={() => handlePropertyPointerDown(property.id, "local")}
              onPointerUp={() => handlePropertyPointerUp(property.id, "local")}
              onPointerLeave={clearPendingInspectorClick}
            >
              {property.valueType === "group" ? <Boxes size={14} /> : <CircleDot size={14} />}
              <span className="explorer-entity-name">{property.label}</span>
              <em className="explorer-origin local">{t(property.valueType)}</em>
              <span className="logic-property-tree-count">{count}</span>
            </button>
            <div className="explorer-row-actions">
              {property.valueType === "group" ? <button
                type="button"
                className="icon-only"
                title={t("Add subproperty")}
                aria-label={`${t("Add subproperty")}: ${property.label}`}
                onClick={(event) => openCreatePropertyMenu(event, property.id)}
              ><Plus size={14} /></button> : null}
              {renderPropertyAction(property, "local")}
            </div>
          </div>
        </div>
        {expanded ? <div className="asset-explorer-tree-children">
          {children.map((child) => renderLocalProperty(child, depth + 1))}
        </div> : null}
      </div>
    );
  };

  const localPropertyMatchesSearch = (property: LocalExplorerProperty, query: string): boolean =>
    property.label.toLowerCase().includes(query)
      || (property.children ?? []).some((child) => localPropertyMatchesSearch(child, query));

  const panelTitle = t("Logic");
  const createParentProperty = createPropertyMenu?.parentPropertyId
    ? findLocalExplorerPropertyInTree(localProperties, createPropertyMenu.parentPropertyId)
    : undefined;

  return (
    <WorkspaceSidePanel onboardingTarget="pathbranching.logic" title={panelTitle} side="left" collapsed={collapsed} onCollapsedChange={onCollapsedChange} onContextMenu={onContextMenu}>
      <AccessibleTabs className="explorer-view-tabs logic-view-tabs" ariaLabel={t("Logic views")} value={tab} onChange={(value) => setTab(value as typeof tab)} tabs={[{id:"properties",label:t("Properties")},{id:"variables",label:t("Variables")},{id:"formats",label:locale === "es" ? "Formatos" : "Formats"}]} />
      <ExplorerPane active={tab === "properties"}>
          <div className="explorer-toolbar">
            <label className="explorer-search">
              <Search size={14} />
              <input value={propertySearch} onChange={(event) => setPropertySearch(event.target.value)} aria-label={t("Search properties")} placeholder={t("Search properties")} />
            </label>
            <button type="button" title={t("Add property")} onClick={(event) => openCreatePropertyMenu(event)}><Plus size={15} /></button>
            <button type="button" title={t("Expand all properties")} onClick={expandAllProperties}><ChevronDown size={15} /></button>
            <button type="button" title={t("Collapse all properties")} onClick={collapseAllProperties}><ChevronRight size={15} /></button>
          </div>
          <div className="explorer-tree asset-explorer-tree">
            {canonPropertyTypes.map((type) => {
              const typeExpanded = Boolean(propertySearch) || !collapsedPropertyGroups.has(type.id);
              const count = propertyCount(type.properties);
              const typeProperty = canonExplorerTypeProperty(type);
              const typeMatchesSearch = !propertySearch || type.label.toLowerCase().includes(propertySearch.toLowerCase())
                || flattenCanonExplorerProperties(type.properties).some(property => property.label.toLowerCase().includes(propertySearch.toLowerCase()));
              return typeMatchesSearch ? (
                <section className="explorer-type-group" key={type.id}>
                  <div className="logic-canon-type-heading">
                    <button
                      type="button"
                      className="logic-canon-type-toggle"
                      aria-label={`${t(typeExpanded ? "Collapse" : "Expand")} ${type.label}`}
                      onClick={() => togglePropertyGroup(type.id)}
                    >
                      {typeExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className={`explorer-entity-row ${propertySelected(typeProperty.id, "canon") ? "active" : ""}`}>
                      <button
                        type="button"
                        className="explorer-entity-open logic-canon-type-row"
                        title={type.label}
                        onPointerDown={() => handlePropertyPointerDown(typeProperty.id, "canon")}
                        onPointerUp={() => handlePropertyPointerUp(typeProperty.id, "canon")}
                        onPointerLeave={clearPendingInspectorClick}
                      >
                        <CircleDot size={14} />
                        <span className="explorer-entity-name">{type.label}</span>
                        <LockKeyhole className="logic-property-lock" size={12} aria-label={t("Imported from canon")} />
                        <span className="logic-canon-type-count">{count}</span>
                      </button>
                      <div className="explorer-row-actions">
                        {renderPropertyAction(typeProperty, "canon")}
                      </div>
                    </div>
                  </div>
                  {typeExpanded && type.properties.map((property) => renderCanonProperty(property))}
                  {typeExpanded && !type.properties.length ? <span className="empty-line">{t("No properties for this type.")}</span> : null}
                </section>
              ) : null;
            })}
            {localProperties
              .filter((property) => !propertySearch || localPropertyMatchesSearch(property, propertySearch.toLowerCase()))
              .map((property) => renderLocalProperty(property))}
            {canonPropertyTypes.length === 0 && localProperties.length === 0 ? (
              !propertiesConfig ? (
                <div className="empty-state" style={{ padding: "16px", textAlign: "center" }}>
                  <span className="empty-line" style={{ display: "block", marginBottom: "12px" }}>{t("No properties configured.")}</span>
                  <button
                    type="button"
                    onClick={onInitializeProperties}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "var(--wn-accent)",
                      color: "var(--wn-panel)",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                  >
                    <Plus size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                    {t("Initialize Properties")}
                  </button>
                </div>
              ) : (
                <span className="empty-line">{t("No properties.")}</span>
              )
            ) : null}
          </div>
          {propertyEditor && editingProperty ? <div ref={editorRef} className="logic-property-editor" style={{ top: propertyEditor.top, left: propertyEditor.left }} role="dialog" aria-label={t(isCanonEditor ? "View imported property" : "Edit property")} aria-modal="true">
        <header className="logic-property-editor-header">
          <span className="logic-property-editor-icon">{isCanonEditor ? <LockKeyhole size={15} /> : <ShieldCheck size={15} />}</span>
          <div><strong>{editingProperty.label}</strong><small>{t(isCanonEditor ? "Imported canon property" : isLocalSubproperty ? "Local subproperty" : "Local property")}</small></div>
          <div style={{ display: "flex", gap: "4px" }}>
            {!isCanonEditor ? <button type="button" className="icon-only" title={t("Delete property")} aria-label={t("Delete property")} onClick={() => { if (onDeleteLocalExplorerProperty?.(editingProperty.id) !== false) setPropertyEditor(undefined); }}><Trash2 size={15} /></button> : null}
            <button type="button" className="icon-only" data-overlay-focus aria-label={t("Close property editor")} onClick={() => setPropertyEditor(undefined)}><X size={15} /></button>
          </div>
        </header>
        <div className={`logic-property-protection ${isCanonEditor ? "canon" : "local"}`}><LockKeyhole size={13} />{t(isCanonEditor ? "Canon property — only capabilities can be overridden" : "Local property")}</div>
        <PropertyCapabilitiesEditor locale={locale} project={project} source={propertyEditor.source} propertyId={editingProperty.id} propertiesConfig={propertiesConfig}
          descriptor={propertyEditor.source === "canon" ? editingProperty as CanonExplorerProperty : undefined}
          isEntityType={Boolean(editingTypeId || editingProperty.valueType === "entity-type")}
          valueType={editingProperty.valueType} property={editingCapability} entityType={editingTypeCapability}
          onPropertyChange={updateCapability} onTypeChange={updateTypeCapability} />
        <details className="logic-property-technical-info">
          <summary><Info size={12} /> {locale === "es" ? "Definición" : "Definition"}</summary>
          <div className="logic-property-technical-content">
            <label className="field-label">{t("Name")}<input value={editingProperty.label} disabled={isCanonEditor} onChange={(event) => updateLocal({ label: event.target.value })} /></label>
            <label className="field-label">{t("Value type")}<select value={editingProperty.valueType} disabled={isCanonEditor || Boolean((editingProperty as LocalExplorerProperty).children?.length)} onChange={(event) => updateLocal({ valueType: event.target.value as LocalExplorerProperty["valueType"] })}>{!propertyTypes.some(([value]) => value === editingProperty.valueType) ? <option value={editingProperty.valueType}>{editingProperty.valueType}</option> : null}{propertyTypes.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
            <label className="field-label">{t("Applies to types")}<input value={(editingProperty.appliesToTypes ?? []).join(", ")} disabled={isCanonEditor} placeholder={t(isLocalSubproperty ? "Inherited from parent property" : "All types")} onChange={(event) => updateLocal({ appliesToTypes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
            {!isCanonEditor && (editingProperty.valueType === "entity-ref" || editingProperty.valueType === "entity-ref-list") ? (
              <label className="field-label">{t("Target entity types")}<input value={((editingProperty as LocalExplorerProperty).targetTypes ?? []).join(", ")} placeholder={t("All entities")} onChange={(event) => updateLocal({ targetTypes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
            ) : null}
            <label className="field-label">{t("Description")}<textarea rows={3} value={editingProperty.description ?? ""} disabled={isCanonEditor} onChange={(event) => updateLocal({ description: event.target.value })} /></label>
            <label className="field-label">{t("Can relate to")}<input value={(editingCapability?.relationTargetTypes ?? []).join(", ")} placeholder={t("character, worldbuilding")} onChange={(event) => updateCapability({ relationTargetTypes: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
            <label className="logic-property-checkbox"><input type="checkbox" checked={editingProperty.required ?? false} disabled={isCanonEditor} onChange={(event) => updateLocal({ required: event.target.checked })} /> {t("Required")}</label>
            {renderEditorOptions()}
          </div>
        </details>
        <details className="logic-property-technical-info">
          <summary><Info size={12} /> {t("Technical information")}</summary>
          <div className="logic-property-technical-content">
            <div className="logic-property-technical-field">
              <label>{t("Property ID")}</label>
              <code>{editingProperty.id}</code>
            </div>
            {"path" in editingProperty && editingProperty.path && editingProperty.path.length > 0 ? (
              <div className="logic-property-technical-field">
                <label>{t("YAML path")}</label>
                <code>{(editingProperty as any).path.join(".")}</code>
              </div>
            ) : null}
          </div>
        </details>
      </div> : null}
      </ExplorerPane>
      <ExplorerPane active={tab === "variables"}>
          <div className="panel-toolbar"><strong>{t("Variables")}</strong><button type="button" onClick={addGroup}><Plus size={14} /> {t("Group")}</button></div>
          <div className="logic-groups">{groups.map((group, index) => <section className="logic-group" key={group.id}>
            <header>
              <input aria-label={t("Group name")} value={group.name} onChange={(event) => updateGroups(groups.map((item) => item.id === group.id ? { ...item, name: event.target.value } : item))} />
              <button type="button" aria-label={`${t("Move group up")}: ${group.name}`} disabled={index === 0} onClick={() => updateGroups(groups.map((item, position) => position === index ? { ...item, order: index - 1 } : position === index - 1 ? { ...item, order: index } : item))}><ChevronUp size={13} /></button>
              <button type="button" aria-label={`${t("Move group down")}: ${group.name}`} disabled={index === groups.length - 1} onClick={() => updateGroups(groups.map((item, position) => position === index ? { ...item, order: index + 1 } : position === index + 1 ? { ...item, order: index } : item))}><ChevronDown size={13} /></button>
              <button type="button" aria-label={`${t("Delete group")}: ${group.name}`} disabled={group.id === "ungrouped"} onClick={() => updateGroups(groups.filter((item) => item.id !== group.id))}><Trash2 size={13} /></button>
            </header>
            {(project.logicVariables ?? []).filter((variable) => variable.groupId === group.id).map((variable) => <div className="logic-variable" key={variable.id}>
              <input aria-label={t("Variable name")} value={variable.name} onChange={(event) => updateVariable(variable.id, { name: event.target.value })} />
              <select aria-label={`${t("Variable type")}: ${variable.name}`} value={variable.type} onChange={(event) => updateVariable(variable.id, { type: event.target.value as LogicVariableType, value: event.target.value === "boolean" ? false : event.target.value === "number" ? 0 : event.target.value === "list" ? [] : "" })}>{variableTypes.map((type) => <option key={type} value={type}>{t(type)}</option>)}</select>
              <input aria-label={`${t("Variable value")}: ${variable.name}`} value={variableValue(variable)} onChange={(event) => updateVariable(variable.id, { value: variable.type === "number" ? Number(event.target.value) || 0 : variable.type === "list" ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value })} />
              <button type="button" aria-label={`${t("Delete variable")}: ${variable.name}`} onClick={() => updateVariables((project.logicVariables ?? []).filter((item) => item.id !== variable.id))}><Trash2 size={13} /></button>
            </div>)}
            <button type="button" className="logic-add-variable" onClick={() => addVariable(group.id)}><Plus size={13} /> {t("Variable")}</button>
          </section>)}</div>
      </ExplorerPane>
      <ExplorerPane active={tab === "formats"}>
        <div className="logic-formats-panel">
          <section className="logic-formats-card">
            <header><h3>{locale === "es" ? "Condiciones y disponibilidad" : "Conditions and availability"}</h3><p className="empty-line">{locale === "es" ? "Define cómo se muestran las opciones cuando sus condiciones no se cumplen." : "Choose how options appear when their conditions are not met."}</p></header>
            <label className="field-label">{locale === "es" ? "Opciones no disponibles" : "Unavailable options"}
              <select value={project.logicFormats?.unavailableBehavior ?? "perOutcome"} onChange={event => updateFormats({ unavailableBehavior: event.target.value === "perOutcome" ? undefined : event.target.value as LogicFormats["unavailableBehavior"] })}>
                <option value="perOutcome">{locale === "es" ? "Conservar los ajustes guardados" : "Keep saved settings"}</option>
                <option value="locked">{locale === "es" ? "Mostrar bloqueadas" : "Show as locked"}</option>
                <option value="hidden">{locale === "es" ? "Ocultar" : "Hide"}</option>
              </select>
            </label>
            {(project.logicFormats?.unavailableBehavior ?? "perOutcome") !== "hidden" ? <>
              <label className="field-label">{locale === "es" ? "Texto de la opción bloqueada" : "Locked option text"}<input value={project.logicFormats?.unavailableText ?? ""} placeholder={locale === "es" ? "Vacío conserva el texto de cada opción" : "Blank keeps each option's text"} onChange={event => updateFormats({ unavailableText: event.target.value })} /></label>
              <label className="field-label">{locale === "es" ? "Explicación del bloqueo" : "Lock explanation"}<input value={project.logicFormats?.lockText ?? ""} placeholder={locale === "es" ? "Vacío usa el diagnóstico de la condición" : "Blank uses the condition details"} onChange={event => updateFormats({ lockText: event.target.value })} /></label>
            </> : null}
          </section>
          <section className="logic-formats-card">
            <header><h3>{locale === "es" ? "Decisiones" : "Decisions"}</h3><p className="empty-line">{locale === "es" ? "Elige cómo se presentan las opciones de todas las decisiones." : "Choose how options are presented across decisions."}</p></header>
            <label className="field-label">{locale === "es" ? "Presentación de las opciones" : "Option presentation"}
              <select value={project.logicFormats?.decisionOptionStyle ?? "perDecision"} onChange={event => updateFormats({ decisionOptionStyle: event.target.value === "perDecision" ? undefined : event.target.value as LogicFormats["decisionOptionStyle"] })}>
                <option value="perDecision">{locale === "es" ? "Conservar los ajustes guardados" : "Keep saved settings"}</option>
                <option value="visibleText">{locale === "es" ? "Texto" : "Text"}</option>
                <option value="iconOnly">{locale === "es" ? "Iconos" : "Icons"}</option>
              </select>
            </label>
          </section>
        </div>
      </ExplorerPane>
    {createPropertyMenu ? (
      <div ref={createPropertyRef} className="logic-property-editor explorer-create-menu" style={{ top: createPropertyMenu.top, left: createPropertyMenu.left }} role="dialog" aria-modal="true" aria-label={t("Create new property")} >
        <header className="logic-property-editor-header">
          <span className="logic-property-editor-icon"><Plus size={15} /></span>
          <div>
            <strong>{t(createParentProperty ? "New subproperty" : "New property")}</strong>
            <small>{createParentProperty ? `${t("Subproperty of")} ${createParentProperty.label}` : t("Declare a local property")}</small>
          </div>
          <button type="button" className="icon-only" aria-label={t("Close create property menu")} onClick={() => setCreatePropertyMenu(undefined)}><X size={15} /></button>
        </header>
        <div className="modal-body" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
            <ExplorerGroup id="property-basic" title={locale === "es" ? "Información básica" : "Basic information"} defaultOpen><label className="field-label">
              <span>{t("Label")}</span>
              <input
                type="text"
                value={newPropertyState.label}
                onChange={(e) => setNewPropertyState({ ...newPropertyState, label: e.target.value })}
                placeholder={t("Property label")}
                data-overlay-focus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProperty();
                    if (e.key === "Escape") setCreatePropertyMenu(undefined);
                  }}
              />
            </label>
            <label className="field-label">
              <span>{t("Value type")}</span>
              <select value={newPropertyState.valueType} onChange={(event) => setNewPropertyState({ ...newPropertyState, valueType: event.target.value as LocalExplorerProperty["valueType"], options: [], targetTypes: [] })}>
                {propertyTypes.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
              </select>
            </label>
            <label className="field-label">
              <span>{t("Description")}</span>
              <textarea
                rows={2}
                value={newPropertyState.description}
                onChange={(e) => setNewPropertyState({ ...newPropertyState, description: e.target.value })}
                placeholder={t("Optional description")}
              />
            </label>
            </ExplorerGroup>
            <ExplorerGroup id="property-advanced" title={locale === "es" ? "Configuración avanzada" : "Advanced settings"}>
            <label className="logic-property-checkbox">
              <input
                type="checkbox"
                checked={newPropertyState.required}
                onChange={(e) => setNewPropertyState({ ...newPropertyState, required: e.target.checked })}
              />
              {t("Required")}
            </label>
            {newPropertyState.valueType === "entity-type" ? (
              <>
                <label className="field-label">
                  <span>{t("Icon")}</span>
                  <input
                    type="text"
                    value={newPropertyState.icon || ""}
                    onChange={(e) => setNewPropertyState({ ...newPropertyState, icon: e.target.value || undefined })}
                    placeholder={t("circle, person, map-pin, etc.")}
                  />
                </label>
                <label className="field-label">
                  <span>{t("Color (optional)")}</span>
                  <input
                    type="text"
                    value={newPropertyState.color || ""}
                    onChange={(e) => setNewPropertyState({ ...newPropertyState, color: e.target.value || undefined })}
                    placeholder={t("#FF5733 or blue")}
                  />
                </label>
                <label className="field-label">
                  <span>{t("Suggested folder (optional)")}</span>
                  <input
                    type="text"
                    value={newPropertyState.suggestedFolder || ""}
                    onChange={(e) => setNewPropertyState({ ...newPropertyState, suggestedFolder: e.target.value || undefined })}
                    placeholder={t("characters, locations, etc.")}
                  />
                </label>
              </>
            ) : null}
            </ExplorerGroup>
            {(newPropertyState.valueType === "select" || newPropertyState.valueType === "multiselect") ? (
              <ExplorerGroup id="property-options" title={t("Options")} defaultOpen><div className="field-label">
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {newPropertyState.options.map((option, index) => (
                    <div key={index} style={{ display: "flex", gap: "4px" }}>
                      <input
                        type="text"
                        placeholder={t("Value")}
                        value={option.value}
                        onChange={(e) => {
                          const updated = [...newPropertyState.options];
                          updated[index].value = e.target.value;
                          setNewPropertyState({ ...newPropertyState, options: updated });
                        }}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="text"
                        placeholder={t("Label")}
                        value={option.label}
                        onChange={(e) => {
                          const updated = [...newPropertyState.options];
                          updated[index].label = e.target.value;
                          setNewPropertyState({ ...newPropertyState, options: updated });
                        }}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="icon-only"
                        aria-label={`${t("Remove option")} ${index + 1}`}
                        onClick={() => {
                          const updated = newPropertyState.options.filter((_, i) => i !== index);
                          setNewPropertyState({ ...newPropertyState, options: updated });
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    style={{ marginTop: "4px", padding: "4px 8px", fontSize: "12px" }}
                    onClick={() => {
                      const newOption: ExplorerPropertyOption = {
                        value: optionKey(newPropertyState.options.length),
                        label: `Option ${newPropertyState.options.length + 1}`,
                      };
                      setNewPropertyState({ ...newPropertyState, options: [...newPropertyState.options, newOption] });
                    }}
                  >
                    <Plus size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                    {t("Add option")}
                  </button>
                </div>
              </div></ExplorerGroup>
            ) : null}
            <ExplorerGroup id="property-scope" title={locale === "es" ? "Ámbito y referencias" : "Scope and references"}>
            {(newPropertyState.valueType === "entity-ref" || newPropertyState.valueType === "entity-ref-list") ? (
              <label className="field-label">
                <span>{t("Target entity types")}</span>
                <input
                  type="text"
                  value={newPropertyState.targetTypes.join(", ")}
                  onChange={(e) => setNewPropertyState({
                    ...newPropertyState,
                    targetTypes: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                  })}
                  placeholder={t("character, location (comma-separated)")}
                />
              </label>
            ) : null}
            <label className="field-label">
              <span>{t("Applies to types (optional)")}</span>
              <input
                type="text"
                value={newPropertyState.appliesToTypes.join(", ")}
                onChange={(e) => setNewPropertyState({
                  ...newPropertyState,
                  appliesToTypes: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                })}
                placeholder={t(createParentProperty ? "Inherited from parent property" : "Leave blank for all types")}
              />
            </label>
            </ExplorerGroup>
          </div>
          <footer className="modal-footer">
            <button type="button" onClick={() => setCreatePropertyMenu(undefined)}>{t("Cancel")}</button>
            <button type="button" className="primary" onClick={handleCreateProperty} disabled={!newPropertyState.label.trim()}>{t("Create")}</button>
          </footer>
        </div>
    ) : null}
  </WorkspaceSidePanel>
  );
}
