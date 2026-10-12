import type { SettingsPage } from "./settingsIntegration";

const catalog: Array<[string,string,string,string,string,boolean,Array<[string,string,string,string[]?]>]> = [
  [
    "general",
    "General",
    "General",
    "Language and appearance",
    "Idioma y apariencia",
    false,
    [
      [
        "locale",
        "Interface language",
        "Idioma de la interfaz"
      ],
      [
        "theme",
        "Theme",
        "Tema",
        [
          "Active style",
          "Estilo activo",
          "Style",
          "Estilo"
        ]
      ],
      [
        "mode",
        "Theme mode",
        "Modo del tema"
      ],
      [
        "ambient",
        "Soft background",
        "Fondo difuminado"
      ],
      [
        "scene",
        "Background scene",
        "Escena de fondo",
        ["Escena","Scene","Background image","Imagen de fondo"]
      ]
    ]
  ],
  [
    "overview",
    "Universe",
    "Universo",
    "Identity and languages",
    "Identidad e idiomas",
    true,
    [
      [
        "name",
        "Universe name",
        "Nombre del universo"
      ],
      [
        "primary-language",
        "Primary language",
        "Idioma principal"
      ],
      [
        "languages",
        "Additional languages",
        "Idiomas adicionales"
      ],
      [
        "invented-language",
        "Invented language",
        "Idioma inventado"
      ],
      [
        "icon",
        "Universe icon",
        "Icono del universo",
        [
          "Use book icon",
          "Usar icono libro"
        ]
      ]
    ]
  ],
  [
    "authoring",
    "PathBranching",
    "PathBranching",
    "Authoring",
    "Autoría",
    true,
    [
      [
        "story",
        "Story file",
        "Archivo de historia"
      ],
      [
        "validation",
        "Runtime validation",
        "Validación de ejecución"
      ],
      [
        "categories",
        "Event categories",
        "Categorías de eventos"
      ],
      [
        "decisions",
        "Decisions",
        "Decisiones"
      ],
      [
        "outcomes",
        "Outcomes",
        "Desenlaces"
      ],
      [
        "dialogue",
        "Dialogue elements",
        "Elementos de diálogo"
      ],
      [
        "characters",
        "Character count",
        "Cantidad de caracteres"
      ],
      [
        "words",
        "Word count",
        "Cantidad de palabras"
      ],
      [
        "counter",
        "Show counter",
        "Mostrar contador"
      ],
      [
        "measure",
        "Measure",
        "Medida"
      ],
      [
        "maximum",
        "Maximum",
        "Máximo"
      ]
    ]
  ],
  [
    "canvas",
    "PathBranching",
    "PathBranching",
    "Canvas",
    "Canvas",
    false,
    [
      [
        "dots",
        "Canvas circles",
        "Puntos del canvas"
      ],
      [
        "grid",
        "Canvas grid",
        "Cuadrícula del canvas"
      ],
      [
        "snap",
        "Align to grid",
        "Alinear a la cuadrícula"
      ],
      [
        "size",
        "Grid size",
        "Tamaño de cuadrícula"
      ],
      [
        "opacity",
        "Grid opacity",
        "Opacidad de cuadrícula"
      ],
      [
        "dots-opacity",
        "Canvas dot opacity",
        "Opacidad de los puntos"
      ],
      [
        "color-0",
        "Sequence",
        "Secuencia"
      ],
      [
        "color-1",
        "Start",
        "Inicio"
      ],
      [
        "color-2",
        "Branch",
        "Rama"
      ],
      [
        "color-3",
        "Event",
        "Evento"
      ],
      [
        "color-4",
        "Decision",
        "Decisión"
      ],
      [
        "color-5",
        "Outcome",
        "Desenlace"
      ],
      [
        "color-6",
        "Ink",
        "Ink"
      ],
      [
        "color-7",
        "Knowledge",
        "Conocimiento"
      ],
      [
        "color-8",
        "Runtime action",
        "Acción de ejecución"
      ]
    ]
  ],
  [
    "inspector",
    "PathBranching",
    "PathBranching",
    "Inspector and workspace",
    "Inspector y espacio de trabajo",
    false,
    [
      [
        "next-tab",
        "Open next tab on close",
        "Seleccionar la siguiente pestaña al cerrar"
      ],
      [
        "collapse",
        "Collapse tab on canvas click",
        "Contraer pestaña al pulsar el canvas"
      ],
      [
        "debug",
        "Inspector Debug",
        "Depuración del inspector"
      ],
      [
        "status",
        "Status messages",
        "Mensajes de estado"
      ]
    ]
  ],
  [
    "markdown",
    "PathBranching",
    "PathBranching",
    "Markdown working copies",
    "Copias de trabajo Markdown",
    true,
    [
      [
        "folder",
        "Working copy folder",
        "Carpeta de copias de trabajo"
      ],
      [
        "formats",
        "Supported draft formats",
        "Formatos de borrador compatibles"
      ],
      [
        "canon",
        "Canon editing",
        "Edición del canon"
      ]
    ]
  ],
  [
    "bridge",
    "PathBranching",
    "PathBranching",
    "Bridge",
    "Puente",
    true,
    [
      [
        "bridge",
        "Everend Bridge",
        "Puente Everend"
      ],
      [
        "address",
        "Bridge URL",
        "URL del puente"
      ],
      [
        "project",
        "Project ID",
        "ID del proyecto"
      ]
    ]
  ],
  [
    "recents",
    "Universe",
    "Universo",
    "Recent universes",
    "Universos recientes",
    false,
    [
      [
        "recents",
        "Recent universes",
        "Universos recientes"
      ]
    ]
  ],
  [
    "tutorials",
    "Help",
    "Ayuda",
    "Help and tutorials",
    "Ayuda y tutoriales",
    false,
    [
      [
        "tutorial",
        "Restart tutorial",
        "Reiniciar tutorial"
      ]
    ]
  ]
];
export const pathbranchingSettingsPages: SettingsPage[] = catalog.map(([id,groupEn,groupEs,titleEn,titleEs,requiresUniverse,controls]) => ({
  id: "pathbranching." + id, owner: "pathbranching", group: {en:groupEn,es:groupEs}, title: {en:titleEn,es:titleEs}, requiresUniverse,
  controls: controls.map(([control,en,es,match]) => ({ id: "pathbranching." + id + "." + control, label: {en,es}, match })),
}));

export function pathbranchingSettingsPage(section?: string) {
  const legacy: Record<string,string> = {"suite":"suite.language","update":"suite.update","workspace":"pathbranching.inspector"};
  return legacy[section ?? ""] ?? "pathbranching." + (section ?? "authoring");
}


pathbranchingSettingsPages.find(page => page.id === "pathbranching.bridge")!.controls.push(...[
["mode","Mode","Modo"],["endpoint","Endpoint","Dirección"],["daemon","Daemon executable","Ejecutable del daemon"],["profile","Profile","Perfil"],["story","Story ID","ID de historia"],["terminal","Show daemon terminal","Mostrar terminal del daemon"],["pairing","Unity pairing code","Código de emparejamiento de Unity"],["session","Session","Sesión"],["clients","Connected clients","Clientes conectados"],["revision","Remote revision","Revisión remota"],["auto-sync","Auto-sync snapshot","Sincronizar snapshot automáticamente"],["output","Output root","Carpeta de salida"],["locale","Locale","Idioma"],["source","Source folder","Carpeta de origen"]
].map(([id,en,es]) => ({id:"pathbranching.bridge."+id,label:{en,es}})));

pathbranchingSettingsPages.find(page => page.id === "pathbranching.bridge")!.controls = pathbranchingSettingsPages.find(page => page.id === "pathbranching.bridge")!.controls.filter(control => !["pathbranching.bridge.bridge","pathbranching.bridge.address"].includes(control.id));

pathbranchingSettingsPages.find(page => page.id === "pathbranching.general")!.controls.push({id:"pathbranching.general.interface-font",label:{en:"Interface typeface",es:"Fuente de interfaz"}});
