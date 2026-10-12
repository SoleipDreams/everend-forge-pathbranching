import { learningText as t, type LearningStep, type LearningLesson } from "./learning";
const step = (id: string, title: [string, string], body: [string, string], section: string, target: string, event?: string, character: "brio" | "temple" = "brio", sameDocument = false): LearningStep =>
  ({ id, title: t(...title), body: t(...body), section, target, event, character, sameDocument });
export const pathbranchingIntroduction = [
  step("structure", ["Historias que se ramifican", "Stories that branch"], ["Una historia reúne secuencias. Cada secuencia conecta eventos y decisiones en el canvas. Empieza desde Historias.", "A story contains sequences. Each sequence connects events and decisions on the canvas. Start in Stories."], "outline", "pathbranching.stories-panel"),
  step("write", ["Escribe y conecta", "Write and connect"], ["Selecciona un evento y abre su inspector para escribir. Un clic selecciona; mantener el clic abre el inspector; doble clic entra al espacio narrativo.", "Select an event and open its inspector to write. Click to select; hold the click to open the inspector; double-click to enter a narrative space."], "canvas", "pathbranching.canvas"),
  step("review", ["Del documento a la prueba", "From document to test"], ["Guarda tu historia, revisa los diagnósticos y prueba las rutas con Play Mode. Exportación prepara la salida desde ese mismo documento.", "Save your story, review diagnostics and test routes with Play Mode. Export prepares output from that same document."], "export", "pathbranching.export", undefined, "temple"),
];
export const pathbranchingLessons: LearningLesson[] = [
  { id: "structure", title: t("Historia y secuencia", "Story and sequence"), summary: t("Prepara el espacio de tu relato.", "Prepare a space for your story."), section: "outline", steps: [
    step("story", ["Una historia nueva", "A new story"], ["En Historias, crea y nombra una historia. Las historias existentes no se cuentan como una acción de este tutorial.", "In Stories, create and name a story. Existing stories do not count as an action in this tutorial."], "outline", "pathbranching.create-story", "story-created"),
    step("sequence", ["La primera secuencia", "The first sequence"], ["Crea una secuencia en esa historia y selecciónala para llegar al canvas.", "Create a sequence in that story and select it to reach the canvas."], "outline", "pathbranching.create-sequence", "sequence-created"),
  ] },
  { id: "events", title: t("Escribir eventos", "Write events"), summary: t("Haz que algo suceda.", "Make something happen."), section: "canvas", steps: [
    step("event", ["Algo sucede", "Something happens"], ["Crea un evento desde el canvas o Historias. Conecta el inicio de la secuencia con ese evento.", "Create an event from the canvas or Stories. Connect the sequence start to that event."], "canvas", "pathbranching.canvas", "event-created"),
    step("text", ["Dale voz a la escena", "Give the scene a voice"], ["Abre el inspector del evento, escribe texto y aplica el cambio. El paso espera una edición aplicada al documento.", "Open the event inspector, write text and apply the edit. This step waits for an edit applied to the document."], "canvas", "pathbranching.canvas", "event-written"),
  ] },
  { id: "decisions", title: t("Conectar dos resultados", "Connect two outcomes"), summary: t("Una decisión, dos destinos.", "One decision, two destinations."), section: "canvas", steps: [
    step("branch", ["Abre dos posibilidades", "Open two possibilities"], ["Añade una decisión con dos opciones y conecta cada resultado a un destino distinto. Completa también las rutas hacia el final.", "Add a decision with two options and connect each outcome to a different destination. Complete the routes towards an ending too."], "canvas", "pathbranching.canvas", "branch-connected"),
  ] },
  { id: "logic", title: t("Añadir lógica básica", "Add basic logic"), summary: t("Haz que una elección tenga consecuencias.", "Make a choice have consequences."), section: "logic", steps: [
    step("variable", ["Un valor que cambia", "A value that changes"], ["En Lógica, añade una variable para representar algo de tu historia, como confianza o una llave.", "In Logic, add a variable for something in your story, such as trust or a key."], "logic", "pathbranching.logic", "variable-created", "temple"),
    step("rule", ["La elección deja huella", "A choice leaves a mark"], ["Añade una condición y una consecuencia en una ruta o evento, y aplica los cambios. Usa valores compatibles con la variable.", "Add a condition and a consequence to a route or event, and apply the edits. Use values compatible with the variable."], "logic", "pathbranching.logic", "logic-applied", "temple"),
  ] },
  { id: "persistence", title: t("Guardar y reabrir", "Save and reopen"), summary: t("Comprueba que tu historia permanece.", "Check that your story persists."), section: "outline", steps: [
    step("save", ["Conserva la historia", "Keep the story"], ["Guarda con Ctrl+S y espera a que termine. Conservaremos la identidad de este documento para el siguiente paso.", "Save with Ctrl+S and wait for completion. We will remember this document's identity for the next step."], "outline", "pathbranching.toolbar", "document-saved", "temple"),
    step("reopen", ["Vuelve al mismo documento", "Return to the same document"], ["Recarga la historia con Archivo → Recargar, o cierra y vuelve a abrir Forge. Comprueba texto, conexiones y lógica. La guía retomará este paso.", "Reload the story with File → Reload, or close and reopen Forge. Check text, connections and logic. The guide will resume at this step."], "outline", "pathbranching.stories-panel", "document-reopened", "temple", true),
  ] },
  { id: "validation", title: t("Validar y reparar", "Validate and repair"), summary: t("Revisa los diagnósticos del documento.", "Review the document diagnostics."), section: "validation", steps: [
    step("validate", ["Revisa las rutas", "Review the routes"], ["Abre Diagnósticos, revisa los problemas y repara los errores. Usa Comprobar documento en esta guía para confirmar que no quedan errores.", "Open Diagnostics, review issues and repair errors. Use Check document in this guide to confirm there are no errors left."], "validation", "pathbranching.validation", "document-validated", "temple", true),
  ] },
  { id: "preview", title: t("Probar la historia", "Test the story"), summary: t("Recorre las decisiones en Play Mode.", "Follow decisions in Play Mode."), section: "preview", steps: [
    step("play", ["Ponte en el lugar del lector", "Take the reader's place"], ["Inicia Play Mode desde el inicio de la secuencia. Prueba cada opción y comprueba cómo responde la lógica.", "Start Play Mode at the sequence start. Try each option and check how the logic responds."], "preview", "pathbranching.preview", "story-tested", "brio", true),
  ] },
  { id: "export", title: t("Exportar el documento", "Export the document"), summary: t("Lleva tu historia a una salida reutilizable.", "Take your story to a reusable output."), section: "export", steps: [
    step("export", ["Lista para salir de la forja", "Ready to leave the forge"], ["En Exportación, revisa la vista previa, elige un formato disponible y exporta. El paso se confirma tras guardar el archivo de salida, no al abrir el panel.", "In Export, review the preview, choose an available format and export. This step is confirmed after the output file is saved, not when the panel opens."], "export", "pathbranching.export", "document-exported", "temple", true),
  ] },
];
