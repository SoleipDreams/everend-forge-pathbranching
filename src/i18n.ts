import { useSyncExternalStore } from "react";
import {
  resolveLocale,
  setDocumentLocale,
  type Locale,
  type LocalePreference,
} from "./localePolicy";

export { normalizeLocalePreference } from "./localePolicy";
export type { Locale, LocalePreference };

// Interface state is shared by the standalone app and Suite chrome. It never
// enters the narrative document or changes the story's content locale.
let interfaceLocale: Locale = resolveLocale("system");
const localeListeners = new Set<() => void>();

function subscribeToInterfaceLocale(listener: () => void) {
  localeListeners.add(listener);
  return () => { localeListeners.delete(listener); };
}

export function useInterfaceLocale(): Locale {
  return useSyncExternalStore(
    subscribeToInterfaceLocale,
    () => interfaceLocale,
    () => "en",
  );
}

export function resolveInterfaceLocale(preference: LocalePreference): Locale {
  return resolveLocale(preference);
}

export function applyInterfaceLocale(preference: LocalePreference): Locale {
  const locale = resolveInterfaceLocale(preference);
  setDocumentLocale(locale);
  if (locale !== interfaceLocale) {
    interfaceLocale = locale;
    localeListeners.forEach((listener) => listener());
  }
  return locale;
}

const copy = {
  en: { interfaceLanguage: "Interface language", system: "System default" },
  es: { interfaceLanguage: "Idioma de la interfaz", system: "Predeterminado del sistema" },
} as const;

export function interfaceLocaleCopy(locale: Locale) {
  return copy[locale];
}

export function homeUiCopy(locale: Locale) {
  return locale === "es" ? {
    tagline: "Espacio de creación de historias", settings: "Ajustes de PathBranching", feedback: "Enviar feedback",
    theme: "Cambiar tema", home: "Inicio", open: "Abrir un universo", description: "Comparte la carpeta del universo y el canon Markdown con WorldNotion. Las historias se guardan en .everend/.pathbranching.",
    openUniverse: "Abrir universo", demo: "Abrir universo demo", workspace: "Espacio de trabajo", export: "Exportar runtime",
    sequences: "Secuencias", branches: "Ramas", events: "Eventos", objects: "Objetos de datos", activeSequence: "Secuencia activa", none: "Ninguna",
    document: "Documento", noUniverse: "Sin universo", noStory: "Sin historia todavía", ready: "Listo", validation: "Validación",
    recents: "Universos recientes", missingFolder: "Carpeta ausente", removeRecent: "Quitar universo reciente",
  } : {
    tagline: "Story-flow authoring workspace", settings: "PathBranching settings", feedback: "Send feedback",
    theme: "Change theme", home: "Home", open: "Open a universe", description: "Share the universe folder and Markdown canon with WorldNotion. Stories are saved in .everend/.pathbranching.",
    openUniverse: "Open Universe", demo: "Open Demo Universe", workspace: "Workspace", export: "Export Runtime",
    sequences: "Sequences", branches: "Branches", events: "Events", objects: "Data objects", activeSequence: "Active sequence", none: "None",
    document: "Document", noUniverse: "No universe", noStory: "No story yet", ready: "Ready", validation: "Validation",
    recents: "Recent universes", missingFolder: "Missing folder", removeRecent: "Remove recent universe",
  };
}

export function inspectorUiCopy(locale: Locale) {
  return locale === "es" ? {
    overview: "Resumen del evento", description: "Descripción", noDescription: "Sin descripción todavía.",
    cover: "Imagen de portada", noCover: "Sin imagen de portada", category: "Categoría", eventType: "Tipo de evento",
    branch: "Rama", noBranch: "Sin rama", decisions: "Decisiones", outcomes: "Opciones", dialogues: "Elementos de diálogo", untitled: "Evento sin nombre",
  } : {
    overview: "Event overview", description: "Description", noDescription: "No description yet.",
    cover: "Cover image", noCover: "No cover image", category: "Category", eventType: "Event type",
    branch: "Branch", noBranch: "No branch", decisions: "Decisions", outcomes: "Outcomes", dialogues: "Dialogue elements", untitled: "Untitled event",
  };
}

const settingsCopy = {
  en: { forge: "Forge", suite: "Suite", update: "Update", universe: "Universe", overview: "Overview", authoring: "Branching", markdown: "Markdown", bridge: "Bridge", application: "Application", workspace: "Workspace", recents: "Recents", tutorials: "Tutorials", suiteTitle: "Everend Forge Suite", suiteDescription: "Shared preferences applied to every app in this Suite.", style: "Style", typeface: "Primary typeface", updateTitle: "Everend Forge Update", updateDescription: "Check, download, and install signed updates for the Suite.", installedVersion: "Installed version", platform: "Platform", applicationId: "Application ID", checking: "Checking for updates...", available: "Version {{version}} is ready", downloading: "Installing Everend Forge {{version}}...", upToDate: "You are up to date", failed: "Update check failed", ready: "Ready to check for updates", updaterReady: "The updater is ready to contact the release server.", check: "Check for updates", install: "Download and install" },
  es: { forge: "Forge", suite: "Suite", update: "Actualización", universe: "Universo", overview: "Resumen", authoring: "Ramificación", markdown: "Markdown", bridge: "Puente", application: "Aplicación", workspace: "Espacio de trabajo", recents: "Recientes", tutorials: "Tutoriales", suiteTitle: "Everend Forge Suite", suiteDescription: "Preferencias compartidas que se aplican a todas las apps de esta Suite.", style: "Estilo", typeface: "Tipografía principal", updateTitle: "Actualización de Everend Forge", updateDescription: "Comprueba, descarga e instala actualizaciones firmadas de la Suite.", installedVersion: "Versión instalada", platform: "Plataforma", applicationId: "ID de aplicación", checking: "Comprobando actualizaciones...", available: "La versión {{version}} está lista", downloading: "Instalando Everend Forge {{version}}...", upToDate: "Estás al día", failed: "La comprobación de actualización falló", ready: "Listo para comprobar actualizaciones", updaterReady: "El actualizador está listo para contactar el servidor de versiones.", check: "Comprobar actualizaciones", install: "Descargar e instalar" },
} as const;

export function pathbranchingSettingsCopy(locale: Locale) {
  return settingsCopy[locale];
}

const authoringCopy = {
  en: {
    inspect: "Inspect", enter: "Enter", inspector: "Inspector",
    inspectorSections: "Inspector sections", transitionSections: "Transition inspector sections",
    route: "Route", conditions: "Conditions", consequences: "Consequences",
    stories: "Stories", sequence: "Sequence", branches: "Branches", paths: "Paths",
    assets: "Assets", logic: "Logic", player: "Player", exportImport: "Export & Import", connect: "Connect",
    save: "Save", pendingChanges: "Unsaved changes", saving: "Saving", saved: "Saved",
    saveError: "Save failed", retry: "Retry", unappliedDraft: "Inspector changes not applied",
    canvasLayer: "Canvas layer", visual: "Visual",
    visualHint: "Show narrative structure without route logic", logicHint: "Show and edit node and route logic",
    contentLanguage: "Story content language", tutorials: "Tutorials",
    tutorialDescription: "Review the canvas gestures and the authoring guide for this universe.",
    restartTutorial: "Review tutorial",
  },
  es: {
    inspect: "Inspeccionar", enter: "Entrar", inspector: "Inspector",
    inspectorSections: "Secciones del inspector", transitionSections: "Secciones de la transición",
    route: "Ruta", conditions: "Condiciones", consequences: "Consecuencias",
    stories: "Historias", sequence: "Secuencia", branches: "Ramas", paths: "Recorridos",
    assets: "Recursos", logic: "Lógica", player: "Reproductor", exportImport: "Exportar e importar", connect: "Conectar",
    save: "Guardar", pendingChanges: "Cambios pendientes", saving: "Guardando", saved: "Guardado",
    saveError: "Error al guardar", retry: "Reintentar", unappliedDraft: "Cambios del inspector sin aplicar",
    canvasLayer: "Capa del canvas", visual: "Visual",
    visualHint: "Mostrar la estructura narrativa sin la lógica de rutas", logicHint: "Mostrar y editar la lógica de nodos y rutas",
    contentLanguage: "Idioma del contenido narrativo", tutorials: "Tutoriales",
    tutorialDescription: "Repasa los gestos del canvas y la guía de autoría de este universo.",
    restartTutorial: "Repasar tutorial",
  },
} as const;

export function authoringUiCopy(locale: Locale) {
  return authoringCopy[locale];
}

const onboardingCopy = {
  en: {
    label: "PathBranching authoring guide", eyebrow: "PathBranching guide",
    completeTitle: "Basics completed", completeDescription: "You are ready to start authoring your story.",
    close: "Close guide", restart: "Review guide", openStories: "Open Stories",
    steps: [
      { id: "open-stories", title: "Open Stories", description: "Open the Stories panel from its rail or the View menu." },
      { id: "create-story", title: "Create a story", description: "A story brings together the sequences of your narrative." },
      { id: "create-sequence", title: "Create a sequence", description: "A sequence defines the first part of the story." },
      { id: "show-canvas", title: "Reach the canvas", description: "The canvas appears when a sequence is selected." },
    ],
  },
  es: {
    label: "Guía de autoría de PathBranching", eyebrow: "Guía de PathBranching",
    completeTitle: "Fundamentos completados", completeDescription: "Ya puedes comenzar a escribir tu historia.",
    close: "Cerrar guía", restart: "Repasar guía", openStories: "Abrir Historias",
    steps: [
      { id: "open-stories", title: "Abrir Historias", description: "Abre el panel Historias desde su rail o desde el menú Vista." },
      { id: "create-story", title: "Crear una historia", description: "Una historia reúne las secuencias de tu narrativa." },
      { id: "create-sequence", title: "Crear una secuencia", description: "Una secuencia define la primera parte de la historia." },
      { id: "show-canvas", title: "Llegar al canvas", description: "El canvas aparece cuando hay una secuencia seleccionada." },
    ],
  },
} as const;

export function onboardingUiCopy(locale: Locale) {
  return {
    ...onboardingCopy[locale],
    progress: (complete: number, total: number) => locale === "es"
      ? `${complete} de ${total} pasos completados`
      : `${complete} of ${total} steps completed`,
  };
}

// Labels from the existing Assets and Logic forms. Stable enum values, schema
// IDs and authored names remain unchanged; only their interface copy is mapped.
const panelSpanish: Record<string, string> = {
  "Assets": "Recursos", "Logic": "Lógica", "Entities": "Entidades", "Files": "Archivos",
  "Asset views": "Vistas de recursos", "Entity origin filter": "Origen de entidades",
  "All": "Todos", "Images": "Imágenes", "Video": "Vídeo", "Audio": "Audio", "Documents": "Documentos", "Other": "Otros",
  "Canon": "Canon", "Local": "Local", "Published": "Publicado", "Project Data": "Datos del proyecto", "Data": "Datos",
  "Search entities": "Buscar entidades", "Search assets": "Buscar recursos", "New local entity": "Nueva entidad local",
  "Expand all entities": "Expandir todas las entidades", "Collapse all entities": "Contraer todas las entidades",
  "Open inspector": "Abrir inspector", "Delete local entity": "Eliminar entidad local",
  "No properties configured. Initialize to see canon references.": "No hay propiedades configuradas. Inicialízalas para ver las referencias del canon.",
  "Initialize Properties": "Inicializar propiedades", "No entities match this search.": "Ninguna entidad coincide con esta búsqueda.",
  "Create new entity": "Crear entidad", "New entity": "Nueva entidad", "Declare type and name": "Define el tipo y el nombre",
  "Close create entity menu": "Cerrar creación de entidad", "Name": "Nombre", "Entity name": "Nombre de la entidad", "Type": "Tipo",
  "Cancel": "Cancelar", "Create": "Crear", "Import": "Importar", "Asset category": "Categoría del recurso", "Asset origin": "Origen del recurso",
  "Canon · read-only": "Canon · solo lectura", "No matching assets. Imported files remain UnCanon until an explicit publication flow exists.": "No hay recursos que coincidan. Los archivos importados permanecen en UnCanon hasta disponer de un flujo explícito de publicación.",
  "Properties": "Propiedades", "Variables": "Variables", "Logic views": "Vistas de lógica",
  "Search properties": "Buscar propiedades", "Add property": "Añadir propiedad", "Expand all properties": "Expandir todas las propiedades", "Collapse all properties": "Contraer todas las propiedades",
  "View imported property": "Ver propiedad importada", "Edit property": "Editar propiedad", "Imported from canon": "Importado del canon",
  "No properties for this type.": "Este tipo no tiene propiedades.", "No properties configured.": "No hay propiedades configuradas.", "No properties.": "No hay propiedades.",
  "Imported canon property": "Propiedad importada del canon", "Local property": "Propiedad local", "Delete property": "Eliminar propiedad", "Close property editor": "Cerrar editor de propiedad",
  "Canon property — only capabilities can be overridden": "Propiedad del canon: solo se pueden ajustar sus capacidades",
  "PathBranching capabilities": "Capacidades de PathBranching", "Configure behavior": "Configurar comportamiento", "Grantable": "Otorgable", "Location": "Ubicación",
  "Entities of this type can be selected as an event or speech beat location": "Las entidades de este tipo pueden usarse como ubicación de un evento o diálogo",
  "Entities of this type can be granted/removed as a consequence and checked as a condition": "Las entidades de este tipo pueden otorgarse o retirarse como consecuencia y comprobarse como condición",
  "Available in conditions": "Disponible en condiciones", "Can be used in conditions and logic checks": "Puede utilizarse en condiciones y comprobaciones de lógica",
  "Writable in actions": "Modificable en acciones", "Can be modified by story actions": "Las acciones de la historia pueden modificarla",
  "Present as entity": "Mostrar como entidad", "Dialogue trigger source": "Origen de activación de diálogo", "Can start dialogue based on property value": "Puede iniciar diálogos según el valor de la propiedad",
  "Values can appear as characters/items in events": "Sus valores pueden aparecer como personajes u objetos en los eventos",
  "Can relate to": "Puede relacionarse con", "Schema fields": "Campos del esquema", "Value type": "Tipo de valor", "Applies to types": "Se aplica a tipos", "All types": "Todos los tipos",
  "Target entity types": "Tipos de entidad de destino", "All entities": "Todas las entidades", "Description": "Descripción", "Required": "Obligatorio",
  "Technical information": "Información técnica", "Property ID": "ID de propiedad", "YAML path": "Ruta YAML",
  "Options": "Opciones", "Add option": "Añadir opción", "Group": "Grupo", "Group name": "Nombre del grupo", "Variable": "Variable", "Variable name": "Nombre de variable", "Variable value": "Valor de variable", "Variable type": "Tipo de variable",
  "Move group up": "Subir grupo", "Move group down": "Bajar grupo", "Delete group": "Eliminar grupo", "Delete variable": "Eliminar variable",
  "Create new property": "Crear propiedad", "New property": "Nueva propiedad", "Declare a local property": "Define una propiedad local", "Close create property menu": "Cerrar creación de propiedad",
  "Label": "Etiqueta", "Property label": "Etiqueta de la propiedad", "Optional description": "Descripción opcional", "Icon": "Icono", "Color (optional)": "Color (opcional)", "Suggested folder (optional)": "Carpeta sugerida (opcional)",
  "Value": "Valor", "Applies to types (optional)": "Se aplica a tipos (opcional)", "Leave blank for all types": "Dejar vacío para todos los tipos",
  "Entity type": "Tipo de entidad", "Text": "Texto", "Number": "Número", "Boolean": "Booleano", "Date": "Fecha", "Select": "Selección", "Multi-select": "Selección múltiple", "Group (nested properties)": "Grupo (propiedades anidadas)",
  "text": "texto", "number": "número", "boolean": "booleano", "list": "lista", "canonRef": "referencia al canon", "select": "selección", "multiselect": "selección múltiple", "date": "fecha", "entity-type": "tipo de entidad", "group": "grupo",
  "Expand": "Expandir", "Collapse": "Contraer", "Actions for": "Acciones de", "Remove option": "Eliminar opción",
  "Inspector tab groups": "Grupos de pestañas del inspector", "Locate on canvas": "Localizar en el canvas",
  "Create Story": "Crear historia", "Story name": "Nombre de la historia", "Rename Story": "Renombrar historia",
  "Create Sequence": "Crear secuencia", "Sequence name": "Nombre de la secuencia", "Rename Sequence": "Renombrar secuencia", "Save": "Guardar",
  "Close inspector": "Cerrar inspector", "Minimize inspector": "Contraer inspector", "Expand inspector": "Ampliar inspector", "Restore inspector": "Restaurar inspector",
  "character, worldbuilding": "character, worldbuilding", "character, location (comma-separated)": "character, location (separados por comas)",
  "circle, person, map-pin, etc.": "circle, person, map-pin, etc.", "#FF5733 or blue": "#FF5733 o blue", "characters, locations, etc.": "characters, locations, etc.",
};

export function panelUiText(locale: Locale, text: string) {
  return locale === "es" ? panelSpanish[text] ?? text : text;
}
