# Interacciones y fichas: validación de autoría

Validación local del 14 de octubre de 2026 con la Suite Tauri, perfil de fuentes
independientes y Playwright CLI conectado a WebView2 en CDP 9223.

## Recorrido observado

Se utilizó el universo ficticio `interaction-qa-universe`, ubicado en
`everend-forge-suite/output/playwright/`. Las modificaciones de prueba se
realizaron en ese universo.

| Recorrido | Evidencia |
| --- | --- |
| Biblioteca compartida | D9, D20 y D100 visibles; duplicación y guardado nativo de D9 QA. |
| Actualización explícita | Vista previa 1D9 → 1D20 y rango 1–9 → 1–20; aplicación al uso mantiene su nombre, identificadores y condiciones. |
| Fichas de secundarios | Capitana tiene base 8 e inicial 9; el enfrentamiento usa 9 sin cambiar al actor. |
| Variantes y WorldNotion | El enlace de Fuerza abre Mara, variante Adulta y atributo anidado. Un cambio guardado automáticamente se refleja como base 18 al volver. |
| Condiciones por rival | Se guarda una condición contra la Capitana y una consecuencia de Derrota condicionada a ganarle individualmente. |
| Asistente recuperable | Nombre personalizado y mecánica D100 reaparecen después de recargar y volver a abrir el asistente. |
| Creación y deshacer | Crear y vincular agrega uso y condición; una acción de deshacer quita ambos, y rehacer los restaura. |
| Ejecución | Mara: 18 + 6 = 24; Capitana: 15 + 9 = 24; Guardián: 1 + 5 = 6. Resultado general Empate, empate contra Capitana y victoria contra Guardián. La tirada del actor se comparte entre comparaciones. |
| Reapertura y exportación | El documento guardado se carga sin el archivo de biblioteca. Conserva sus usos, configuración D100, actualización D20 y consecuencias por rival; exporta la capacidad de enfrentamientos. |
| Distribución | Filas de participantes sin desbordamiento horizontal en configuración amplia y con un viewport de 620 px. Escape cierra el selector antes de cerrar la configuración. |

La comprobación independiente del documento guardado ejecuta cinco tiradas
controladas: tres participantes y dos usos de dados. Comprueba que una derrota
general con victoria frente a Capitana aplica únicamente su consecuencia y que
la condición D100 permite seleccionar la opción.

Las capturas locales están en `everend-forge-suite/output/playwright/`:

- `interaction-participants-final.png`
- `interaction-rival-consequence.png`
- `interaction-narrow.png`
- `opposed-tie-acceptance.png`

El guion y la exportación de prueba están en
`everend-forge-pathbranching/output/playwright/`, como archivos locales de
validación. Al terminar se restauró el universo del usuario en Tauri Dev.

## Comprobaciones de código

### Inspectores independientes de opciones

- En la Suite Tauri, las letras A y B del canvas abren fichas separadas:
  Ir al bosque y Volver al Pueblo, cada una con Opción, Condiciones, Interacción
  y Conexiones. El texto y el contexto de conexiones corresponden a cada opción.
- Interacción ofrece «Añadir interacción a esta opción». El acceso desde las
  ramas del inspector de Decisiones abre la ficha de la opción seleccionada.
- Las letras también abren fichas en modo Visual. Los accesos de condición e
  interacción del canvas apuntan a la sección de su opción.
- Clic y doble clic con el ratón sobre una curva visible no cambian el contenido
  ni añaden fichas al inspector. Las etiquetas de líneas ya no ofrecen botones
  de inspección. Los inspectores de opciones reaparecen tras recargar.
- `verify-inspector-tabs.mjs` aprueba la navegación independiente y el rechazo
  de transiciones como inspectores. Compilan PathBranching y Suite con fuentes
  independientes. Tras recargar, la consola muestra cero errores y advertencias.

Captura local: `everend-forge-suite/output/playwright/option-own-inspector-20261014.png`.

### Resto de interacciones en flujo vertical

En la Suite Tauri con fuentes independientes y el universo QA:

- La prueba contra el mundo muestra Actor actual, Fuerza + 1D20 + 2 y
  dificultad 14, con ramas Total ≥ 14 / Total < 14. Abrir el símbolo permite
  cambiar participantes, atributo, dado, dificultad e instrucción.
- El enfrentamiento muestra Mara contra Capitana y Guardián. Cambiar la regla
  a Vencer a cualquiera actualiza las ramas a victoria contra alguno, derrota
  contra todos y empate sin victorias. Se restauró Vencer a todos. End selecciona
  Empate y se muestra un único editor de resultado.
- El QTE muestra Espacio y 2.5 segundos después de cambiar sus campos desde
  el símbolo. Las ramas son Éxito, Fallo y Tiempo agotado. El plazo es una
  representación estática, sin simular una ejecución durante la edición.
- La personalizada Enigma conserva Correcta / Respuesta parcial QA / Incorrecta.
  Añadir selecciona Pista solicitada; eliminarla devuelve la selección a Correcta.
  Volver a añadir una cuarta rama la centra en una segunda fila de tres columnas.
  Cambiar de resultado no mezcla los campos de los otros resultados.
- Tras guardar y recargar, se conservaron dificultad, atributo, modificador,
  configuración del QTE y resultados personalizados. La consola mostró cero
  errores y cero advertencias. El flujo contra el mundo también abre en el
  inspector del canvas.
- Los cuatro tipos se revisaron con viewport de 620 px: sin desbordamiento
  horizontal del resumen o selector de resultados. PathBranching y la Suite
  compilan; esta última verifica 455 archivos y 504 importaciones remapeadas.

Capturas locales: `world-check-vertical-20261014.png`,
`opposed-vertical-20261014.png`, `opposed-vertical-narrow-20261014.png`,
`qte-vertical-20261014.png` y `custom-vertical-20261014.png`, en
`everend-forge-suite/output/playwright/`. Las configuraciones se cambiaron solo
en el universo de prueba.

### Flujo vertical de opciones e intervalos de dados

En la Suite Tauri con fuentes independientes, usando solo el universo QA:

- Opciones abre A y Condiciones; los controles centrales alternan Condiciones
  e Interacciones sin mostrarlas a la vez. Seleccionar B conserva su propio
  texto y abre Condiciones. Los accesos del canvas a la interacción B y a la
  condición A seleccionan la opción y sección correspondientes.
- Un D100 se configuró con Fallo 1–35, Éxito 36–65 y Crítico 70–100. La escala
  mostró el hueco 66–69 y áreas de 35 %, 30 % y 31 %. Arrastrar el inicio de
  Crítico a 66 completó la cobertura. Flecha izquierda en el extremo 100 dejó
  visible el hueco 100. Añadir un resultado selecciona su editor.
- Cambiar a dos dados y modificador 0.5 produjo el dominio 2.5–200.5 y mostró
  los huecos de esa retícula. Se restauró después 1D100 sin modificador.
- Guardar y recargar conservó los tres resultados 1–35, 36–65 y 66–100. La
  consola de esa recarga mostró cero errores y cero advertencias.
- No hubo desbordamiento horizontal del flujo a 620 px de viewport. El
  selector de decisiones usa botones iguales y posición sticky en el inspector
  estrecho y ampliado. Las compilaciones de PathBranching y de la Suite con
  fuentes independientes pasaron (454 archivos, 502 importaciones remapeadas).

Capturas locales en `everend-forge-suite/output/playwright/`:
`decision-flow-fullscreen-20261014.png`, `dice-flow-gaps-20261014.png`,
`dice-flow-complete-20261014.png` y `dice-flow-narrow-20261014.png`.

### Reorganización de Recursos y plantillas

Se revisó también el cambio de ubicación en la misma Suite Tauri:

- Recursos ofrece Entidades, Fichas, Interacciones y Archivos, en ese orden.
  Lógica ofrece únicamente Propiedades y Variables.
- El catálogo predeterminado contiene 20 plantillas: nueve dados, cinco pruebas
  de habilidad, tres QTE y tres personalizadas. Las categorías de teclado
  responden a End; buscar `EVALUACION` encuentra «Personalizada · Evaluación».
- La biblioteca de prueba tenía cuatro mecánicas. Añadir las 17 plantillas
  ausentes mediante la interfaz guardó 21 entradas en el archivo nativo.
  «D20 actualizado QA», cuyo identificador original era `builtin-d9`, conservó
  su nombre, configuración y revisión. Repetir la adición no duplica entradas.
- Después de recargar, las tres plantillas QTE siguen presentes. Fichas conserva
  a Mara adulta y su Fuerza base 18; Usos conserva sus tres interacciones.
- Biblioteca, tarjetas y pestañas no tienen desbordamiento horizontal con un
  panel de aproximadamente 249 px. La consola tras recargar tiene cero errores
  y cero advertencias.
- La verificación de biblioteca, fichas y catálogo de acciones/reglas pasó;
  los tipos y la compilación de la Suite con fuentes independientes pasaron
  con 453 archivos y 500 importaciones remapeadas. Los datos de acciones y
  reglas se conservan aunque sus pestañas estén retiradas.

Captura local: `everend-forge-suite/output/playwright/resources-templates-20261014.png`.
Las adiciones persistentes de esta comprobación se hicieron solo en el universo
de prueba; el universo del usuario se restauró al finalizar.

- Compilación y tipos de PathBranching: aprobados.
- Compilación de la Suite con fuentes independientes: aprobada; 453 archivos y
  501 importaciones verificadas.
- Tipos de WorldNotion: aprobados.
- Rust de Suite y PathBranching: aprobado. La Suite vuelve a compilar y abre su
  ventana nativa en este recorrido.
- Enfrentamientos: 22 pruebas aprobadas, incluyendo D9/D20/D100 contra el mundo,
  empates, ambas agregaciones, variantes, copias, permisos, rollback, cache al
  cambiar de rama y creación atómica.
- Biblioteca y fichas: aprobadas, incluyendo slots de rivales independientes del
  destinatario de acciones y migración de condiciones por efecto.
- Los 42 guiones de `verify:core` ejecutados individualmente: 39 aprobados y tres
  fallos anteriores a esta implementación.

## Fallos anteriores conservados

El comando agregado `npm run verify:core` se detiene en
`verify-unified-logic.mjs:231`: espera un contador de opciones que la presentación
actual de decisiones no genera. La ejecución individual también registra:

- `verify-dialogue-nodes.mjs:243`: expectativa de representación independiente
  del disparador.
- `verify-narrative-naming.mjs:22`: espera «Decisión 1»; la interfaz usa
  «Decisiones 1», conforme al cambio de nombre solicitado anteriormente.

Los resultados completos permanecen en
`everend-forge-pathbranching/output/interaction-all-checks.json` y sus logs.
Las compilaciones mantienen advertencias de tamaño de bundles y de importación
dinámica. Las recargas forzadas de Tauri pueden emitir advertencias de callbacks
Rust pendientes; la consola del recorrido no registró errores de la aplicación.

Las comprobaciones automáticas detectan dependencias directas e heredadas
imposibles. Las dependencias temporales entre eventos y ciclos complejos deben
comprobarse con una simulación del escenario.


## Compact dice selector and compound pools — 2026-10-15

Validated with Playwright CLI on the real Suite WebView2, independent sources,
using the disposable QA Interacciones universe:

- A newly inserted interaction exposes Choose interaction and no dice interval
  bar until a mechanic is selected.
- Create mechanic opens Resources → Interactions without replacing the current
  narrative inspector. Authored QA 2D4 + 1D2 as two stable groups and saved it.
- The catalog immediately offers the new mechanic. Selecting it displays the
  3–10 domain and one inclusive result interval.
- Collapsed selector has a zero right margin; expanded selector has a zero left
  margin, a 433px catalog, no overlapping columns and no horizontal overflow at
  the inspected width. Search receives focus, arrows move to results, Escape
  closes and returns focus to the trigger.
- Edit in Resources reopens that exact preset with both groups and its formula;
  the narrative inspector remains selected. Cancel does not modify it.
- A full WebView reload preserves the authored mixed pool and inspector.
- Play resolves three dice with faces D4, D4 and D2 (observed rolls 2 + 4 + 1 = 7).
  Console reported no errors or warnings in this isolated validation session.
- Evidence: Suite output/playwright/compound-dice-inspector.png and dice-*.txt.
  QA contains the named test preset and use; no real-universe dice was edited.

Core checks passed: interaction regressions (22 groups), opposed interactions
(22 tests), library, runtime authoring export (5 tests), StoryTestController
(30 tests), typecheck and production build. Additional in-memory assertions
covered 2D4+1D2 and 2D10+3D9 endpoints, limits, JSON/EVPATH/library roundtrips,
required export capability, pending-export rejection, preserved result IDs,
routes and effects, and replay/Back with no additional random calls and exactly
one application of consequences. An initial replay fixture without a following
narrative point was corrected to a dialogue-owned interaction before passing.

The final native attempt to check selection undo was stopped when the shared
window moved back to the real universe. A Ctrl+Z was sent during that change;
the user confirmed no observed change. No further automation was performed in
that window. Native selection undo and a narrower inspector were not separately
accepted by this pass. Existing unrelated verify:core failures were not rerun.

## Mechanic switching with adaptation preview — 2026-10-15

The use inspector now offers the complete mechanic catalog for dice, world and
opposed checks, QTE and custom interactions. Configured uses open a preview;
pending uses select directly. Dice can keep their intervals or redistribute
their inclusive boundaries proportionally. The preview rejects uncovered totals,
overlaps, empty intervals and intervals outside the new domain. Proportional
intervals do not promise equal probabilities or equivalent difficulty.

Cross-type adaptation matches unique semantic keys, or unique names when there
is no semantic key. Ambiguous results require an explicit one-to-one selection.
Matches preserve result IDs, names, routes and consequences. New target results
receive new IDs. Dice and custom targets may also keep unmatched old results;
other targets require explicit confirmation before removing unused results.
Referenced results and results with consequences cannot be discarded. Authored
references across the story, including nested rules and effect guards, appear in
the preview; per-rival conditions block a switch that removes their participant.
Story operands stay local when switching between compatible character checks.
Changing a world/opposed check mode also goes through the preview. A stale
preview cannot overwrite newer edits, and shared definitions detach per use.

Playwright CLI on the real Suite Tauri WebView2, with independent sources and
QA Interacciones, checked mixed dice → D100, blocked preservation with a gap,
proportional application and a single Ctrl+Z restoring 2D4 + 1D2 and its range.
It also checked mixed dice → QTE, explicit association of Completada to success,
creation of failure/timeout outputs and a single undo restoring the dice use.
No real-universe mechanic was changed. Captures live in Suite output/playwright:
adaptation-preview.png, adaptation-qte-matched.png and adaptation-qte-applied.png.

Core assertions covered rounding with fractional modifiers, too few totals,
ambiguous/duplicate mappings, effect and route retention, global conditions,
serialization, stale previews, participant guards and shared-use isolation.
Existing checks passed: conditions (15), condition authoring (15), authoring
engine (25), interactions (22 groups), opposed interactions (22), library,
export compatibility (43) and runtime authoring export (5). Typecheck and build
passed after connecting the existing explorer width state to AdaptiveWorkspace's
required props. Build retains the existing large-chunk/dynamic-import warnings.
The full verify:core run stopped at the previously known dialogue trigger
projection assertion in verify-dialogue-nodes.mjs:243.

## Type → template selection — 2026-10-15

Pending interactions now start with the four type cards (dice, skill check,
QTE and custom). Choosing a type only changes the picker view and filters the
library and recents; it does not mutate the story. World and opposed checks
share the skill-check category. Configured uses open their current category's
library directly. A second click on the main tile, or the type breadcrumb,
returns to the type cards. Selecting a different template retains the adaptation
preview and its safeguards. Closing and reopening a configured use restores its
actual category rather than a previously browsed category.

Playwright CLI on Suite Tauri verified the configured-use click sequence,
category filtering, accent-insensitive search, arrow/Enter selection and canceled
cross-type adaptation. A temporary pending use in QA Interacciones verified that
no templates appear before choosing a type, that skill checks show both world
and opposed templates, and that the breadcrumb returns to the type cards.
One undo removed that temporary QA use. No real-universe content was changed.
Captures: Suite output/playwright/type-template-library.png and
type-template-types.png. The production Vite bundle and a strict typecheck of
InteractionMechanicSelector.tsx / InteractionsEditor.tsx and their dependencies
passed. The final global typecheck still reports the unrelated management-layout
indexing error at AdaptiveWorkspace.tsx:81 (a possible player panel indexed into
an explorer-only map). The earlier App.tsx error no longer appears.
