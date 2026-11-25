import {
  learningText as t,
  type LearningStep,
  type LearningLesson,
} from "./learning";

const step = (
  id: string,
  title: [string, string],
  body: [string, string],
  section: string,
  target: string,
  character: "brio" | "temple" = "brio",
): LearningStep => ({
  id,
  title: t(...title),
  body: t(...body),
  section,
  target,
  character,
});

export const pathbranchingIntroduction = [
  step(
    "structure",
    ["Historias que se ramifican", "Stories that branch"],
    [
      "Una historia reúne secuencias. Cada secuencia conecta eventos y decisiones en el canvas. El panel Historias es el punto de partida para ubicarlas.",
      "A story contains sequences. Each sequence connects events and decisions on the canvas. The Stories panel is the place to locate them.",
    ],
    "outline",
    "pathbranching.stories-panel",
  ),
  step(
    "write",
    ["Escribe y conecta", "Write and connect"],
    [
      "El canvas organiza la secuencia y sus eventos. Seleccionar un evento muestra su inspector; el espacio narrativo permite trabajar el contenido interno.",
      "The canvas organizes a sequence and its events. Selecting an event shows its inspector; the narrative space is where its inner content is organized.",
    ],
    "canvas",
    "pathbranching.canvas",
  ),
  step(
    "review",
    ["Del documento a la prueba", "From document to test"],
    [
      "La barra superior reúne guardado, diagnósticos, Play Mode y exportación. Las entidades creadas en PathBranching son locales hasta publicarse y verificarse en WorldNotion.",
      "The top bar brings together saving, diagnostics, Play Mode and export. Entities created in PathBranching are local until published and verified in WorldNotion.",
    ],
    "export",
    "pathbranching.export",
    "temple",
  ),
];

export const pathbranchingLessons: LearningLesson[] = [
  {
    id: "structure",
    title: t("Historias y secuencias", "Stories and sequences"),
    summary: t(
      "Ubica la estructura principal del relato.",
      "Locate the main story structure.",
    ),
    section: "outline",
    steps: [
      step(
        "story",
        ["Historias del proyecto", "Project stories"],
        [
          "El panel Historias reúne los relatos del proyecto. Sus acciones permiten crear, seleccionar y organizar historias; no necesitas crear una para recorrer esta guía.",
          "The Stories panel contains the project's narratives. Its actions let you create, select and organize stories; you do not need to create one for this tour.",
        ],
        "outline",
        "pathbranching.create-story",
      ),
      step(
        "sequence",
        ["Secuencias y canvas", "Sequences and canvas"],
        [
          "Las secuencias ordenan los eventos de una historia. El control de secuencias está junto a las acciones de historia y abre el canvas correspondiente.",
          "Sequences organize the events in a story. The sequence control sits beside the story actions and opens its canvas.",
        ],
        "outline",
        "pathbranching.create-sequence",
      ),
    ],
  },
  {
    id: "events",
    title: t("Eventos y diálogo", "Events and dialogue"),
    summary: t(
      "Conoce dónde se organizan escenas y texto.",
      "See where scenes and text are organized.",
    ),
    section: "canvas",
    steps: [
      step(
        "event",
        ["Eventos en el canvas", "Events on the canvas"],
        [
          "Los eventos representan escenas o unidades narrativas y se añaden desde el menú contextual del canvas. Aquí puedes ubicarlos y seleccionar uno existente.",
          "Events represent scenes or narrative units and are added from the canvas context menu. Use this area to locate or select an existing event.",
        ],
        "canvas",
        "pathbranching.create-event",
      ),
      step(
        "dialogue",
        ["Contenido dentro de un evento", "Content inside an event"],
        [
          "Al entrar a un evento encuentras un canvas interno para sus estructuras y conversaciones. El doble clic abre ese espacio; no hace falta modificar el evento.",
          "An event has an inner canvas for its structures and conversations. Double-clicking opens that space; you do not need to change the event.",
        ],
        "canvas",
        "pathbranching.create-dialogue",
      ),
      step(
        "line",
        ["Diálogo y narrativa", "Dialogue and narrative"],
        [
          "Los bloques de diálogo aparecen dentro de la conversación y guardan las líneas del personaje. El menú contextual del espacio narrativo reúne estas opciones.",
          "Dialogue blocks appear inside a conversation and hold character lines. The narrative-space context menu contains these options.",
        ],
        "canvas",
        "pathbranching.create-speech",
      ),
    ],
  },
  {
    id: "decisions",
    title: t("Decisiones y rutas", "Choices and routes"),
    summary: t(
      "Ubica cómo una elección conecta destinos.",
      "Locate how a choice connects destinations.",
    ),
    section: "canvas",
    steps: [
      step(
        "branch",
        ["Resultados de una decisión", "Outcomes of a choice"],
        [
          "Las decisiones se muestran en el canvas del evento. Cada opción tiene una salida que puede conectarse a otro destino de la historia.",
          "Choices appear on an event's canvas. Each option has an output that can connect to another destination in the story.",
        ],
        "canvas",
        "pathbranching.create-decision",
      ),
    ],
  },
  {
    id: "conditions",
    title: t("Condiciones", "Conditions"),
    summary: t(
      "Encuentra los requisitos de cada opción.",
      "Find the requirements for each choice.",
    ),
    section: "canvas",
    steps: [
      step(
        "condition",
        ["Cuándo aparece una ruta", "When a route is available"],
        [
          "El inspector de una opción contiene Condiciones. Allí se expresan requisitos de progreso, eventos o variables que determinan cuándo puede seguirse una ruta.",
          "A choice's inspector contains Conditions. This is where progress, event or variable requirements determine when a route can be followed.",
        ],
        "canvas",
        "pathbranching.condition",
        "temple",
      ),
    ],
  },
  {
    id: "interactions",
    title: t("Interacciones", "Interactions"),
    summary: t(
      "Ubica las acciones que pueden resolver los lectores.",
      "Locate actions readers can resolve.",
    ),
    section: "canvas",
    steps: [
      step(
        "interaction",
        ["Interacciones de una opción", "Interactions for a choice"],
        [
          "El inspector de la opción también contiene Interacciones. Allí se consultan las mecánicas disponibles, sus tipos y plantillas.",
          "A choice's inspector also contains Interactions. This is where available mechanics, types and templates are listed.",
        ],
        "canvas",
        "pathbranching.interaction",
        "temple",
      ),
    ],
  },
  {
    id: "logic",
    title: t("Variables y lógica", "Variables and logic"),
    summary: t(
      "Conoce dónde se conectan condiciones y consecuencias.",
      "See where conditions and consequences are connected.",
    ),
    section: "logic",
    steps: [
      step(
        "variable",
        ["Variables del relato", "Story variables"],
        [
          "El panel Lógica reúne variables, condiciones y consecuencias. Sirve para representar información que puede cambiar durante la historia.",
          "The Logic panel contains variables, conditions and consequences. It represents information that can change during a story.",
        ],
        "logic",
        "pathbranching.logic",
        "temple",
      ),
      step(
        "rule",
        ["Reglas de una ruta", "Route rules"],
        [
          "Las condiciones deciden si una ruta está disponible; las consecuencias describen qué cambia al seguirla. Ambas se revisan desde los controles de lógica del documento.",
          "Conditions decide whether a route is available; consequences describe what changes when it is followed. Both are reviewed through the document's logic controls.",
        ],
        "logic",
        "pathbranching.logic",
        "temple",
      ),
    ],
  },
  {
    id: "persistence",
    title: t("Guardar y reabrir", "Save and reopen"),
    summary: t(
      "Ubica los controles de archivo y la lista de historias.",
      "Locate file controls and the story list.",
    ),
    section: "outline",
    steps: [
      step(
        "save",
        ["Guardado del documento", "Saving the document"],
        [
          "La barra superior muestra el estado del documento y sus controles de guardado. PathBranching conserva la historia en el archivo del universo.",
          "The top bar shows document status and save controls. PathBranching keeps the story in the universe's project file.",
        ],
        "outline",
        "pathbranching.toolbar",
        "temple",
      ),
      step(
        "reopen",
        ["Volver a una historia", "Return to a story"],
        [
          "El panel Historias permite volver a seleccionar una historia y sus secuencias. Estos controles sirven para reabrir trabajo cuando lo necesites.",
          "The Stories panel lets you select a story and its sequences again. These controls are available whenever you need to reopen your work.",
        ],
        "outline",
        "pathbranching.stories-panel",
        "temple",
      ),
    ],
  },
  {
    id: "validation",
    title: t("Diagnósticos", "Diagnostics"),
    summary: t(
      "Encuentra los avisos de estructura y referencias.",
      "Find structure and reference notices.",
    ),
    section: "validation",
    steps: [
      step(
        "validate",
        ["Revisión del documento", "Document review"],
        [
          "Diagnósticos reúne problemas de estructura y referencias. El botón de comprobación inicia una revisión cuando quieras; no es requisito para seguir esta guía.",
          "Diagnostics collects structure and reference issues. Its check button starts a review whenever you need one; it is not required to continue this tour.",
        ],
        "validation",
        "pathbranching.validation",
        "temple",
      ),
    ],
  },
  {
    id: "preview",
    title: t("Play Mode", "Play Mode"),
    summary: t(
      "Ubica cómo recorrer una historia como lector.",
      "Locate how to follow a story as a reader.",
    ),
    section: "preview",
    steps: [
      step(
        "play",
        ["Probar una ruta", "Preview a route"],
        [
          "Play Mode abre la historia desde el punto de inicio y permite recorrer sus opciones como lector. Está disponible desde las acciones principales de la secuencia.",
          "Play Mode opens the story at its starting point and lets you follow its choices as a reader. It is available from the sequence's primary actions.",
        ],
        "preview",
        "pathbranching.preview",
      ),
    ],
  },
  {
    id: "export",
    title: t("Exportación", "Export"),
    summary: t(
      "Ubica los formatos y controles de salida.",
      "Locate output formats and controls.",
    ),
    section: "export",
    steps: [
      step(
        "export",
        ["Salidas del documento", "Document outputs"],
        [
          "Exportación muestra las vistas previas y formatos disponibles para el documento. Guardar un archivo es una acción aparte; no hace falta exportar para cerrar el recorrido.",
          "Export shows previews and available formats for the document. Saving an output file is a separate action; you do not need to export to finish this tour.",
        ],
        "export",
        "pathbranching.export",
        "temple",
      ),
    ],
  },
];
