# Inspector style pilot: event Overview

Overview is the first application of these rules. Other modules keep their current styles until reviewed individually.

- Use Lucide outline icons at 16 px with a visible field label; icons support the label rather than replace it.
- Keep object identity in the dock header. Overview starts with branch and counts, followed by Description and Appearance.
- Use spacing and a single separator between field groups instead of nested cards.
- Fields use the available width, a 36 px minimum control height and a 6 px radius. Textareas can resize vertically.
- Selectors use a themed trigger and listbox with thumbnail or icon, visible active option and selected checkmark. Cover removal belongs inside the image selector. No additional Save action for fields that already use the document update flow.
- The selected cover thumbnail sits inside its selector. Menus fit above or below the trigger within the viewport. Removing a cover detaches it from the event; it does not delete the asset.
- Colors inherit Forge theme tokens. Labels and actions support Spanish and English.
- The header and module tabs retain their position during index navigation, focus jumps and content scrolling. Only the inspector content viewport scrolls; framing containers use `overflow:clip` so browser navigation cannot scroll them programmatically. Inspector jumps use the bounded content scroller and focus with `preventScroll`.

## Validation — 2026-10-10

PathBranching build (including typecheck) passed. Playwright CLI on the real Suite Tauri WebView2 checked dark/light themes, a narrow panel, loaded cover preview and keyboard navigation to the secondary action. Existing narrative fields were inspected without changing their values. Captures are under Suite `output/playwright/inspector-overview-pilot-*.png`.

The remove-cover mutation was not exercised on the user's universe. This visual pilot does not establish save/reopen/export acceptance.

Dropdown revision: replaced native cover/category selects with a shared select-only combobox. Arrow keys, Home/End and typeahead preview options; Enter/Space commit, Escape cancels, and Tab leaves the control. Outside clicks close the menu. Checked opening and cancellation against the real Suite without mutating the user’s event.

## Inspector chrome — 2026-10-10

Clicking the empty canvas collapses inspector bodies while preserving open object tabs. The window and object toolbars use aligned 30 px controls. The Add module control is transparent at rest; its bar uses the inspector body background rather than a mismatched panel fill.

Tab-group and module menus share placement logic: use free space above the dock, otherwise to its left; constrain dimensions and scroll when space is limited. Module menus render outside the scrolling inspector body. Escape closes the menu without folding the inspector.

Playwright CLI on Suite WebView2 verified canvas collapse/reopen, equal toolbar button Y coordinates/heights, transparent Add background, and nonintersecting menu/card bounds in normal and expanded layouts. Captures: `inspector-module-menu-outside.png`, `inspector-tab-groups-outside.png`, `inspector-groups-left.png`, `inspector-modules-left.png`. PathBranching build, typecheck and `verify-inspector-tabs.mjs` passed.

## Connections structure — 2026-10-10

Event Connections now follows this hierarchy, retaining the existing document update operations:

1. Story flow: Arrives from, Continues to, then continuation actions.
2. World links: Present elements, World references, and the linked-reference details within the same group.
3. Organization: Story branch.
4. Script file: collapsed advanced section.

Spanish/English labels explain presence versus contextual references. Focused Connections uses Create continuation, Choose existing destination and End here; other narrative editor sections retain their vocabulary. Reference search, removal and preview labels are localized. Relationship graphics and routing behavior remain a separate review.

PathBranching build including typecheck and the inspector tab verification passed. Suite WebView2 inspection confirmed the section order, existing branch/present elements and collapsed advanced section.

Connections framing revision: each section now has an inset bordered panel. Story flow places incoming connections on the left and destinations on the right, with individual cards and explicit empty states. Below 420 px of available content width, the columns stack. World references and the story branch use the same card treatment. The content scrolls below the fixed module navigation and object header.

The module navigation retains the rounded inset frame, now including Add within that frame. The outer scroll container no longer reserves a gutter. Connections uses a 6 px scrollbar without arrow buttons, confined to the content viewport. Suite WebView2 checks confirmed fixed navigation while scrolling and no horizontal overflow at 650 px; build/typecheck passed before the cosmetic frame revision.

Heading pilot in Connections: section headings use 17 px bold text and a short accent border at the inline start. Subsection headings use 13 px semibold text; counts use 11 px regular muted text. Explanations use 12 px regular muted text with additional spacing before subsection content. The advanced section remains a 15 px semibold disclosure. Checked visually on Suite WebView2, including scrolling and the 650 px viewport.

Story flow now removes its explanatory subtitle and labels the columns Before/After (Antes/Después). Event destinations resolve against project events as well as the current event's internal nodes. Event predecessors are collected from transitions stored on their source events; removal targets the owning event. Real Suite inspection verified Sueño Premonitorio → Despertar, the named predecessor in Despertar, and navigation back to the original event without editing the story. A regression checks cross-event incoming/outgoing queries and document immutability. Build/typecheck and verify:core passed.

Each flow column now has an Add menu in its heading. After groups the four existing continuation actions; Before offers connecting a predecessor and setting the event as its sequence's start. Sequence entries render a Start card alongside incoming routes. Return badges reuse the canvas's semantic graph classification, without modifying routes or exports. Removed the route-order explanation beneath the actions. Menus render outside the content scroller and support arrow keys, Escape and focus restoration. Suite WebView2 verified both menus, the Start card, four After options and Escape returning focus. Regression coverage includes start/return classification and immutability. Build/typecheck and verify:core passed. Document-changing options were not exercised on the user's universe.

World links are now compact: no descriptions or always-visible search fields. Add opens an inline searchable picker with Escape/focus restoration. Present elements group by their universe type IDs, resolving current labels from `canonExplorerTypes(propertiesConfig)` and retaining unknown categories/links. World references show name, category and explicit removal; clicking a name retains canon navigation. Drag/drop remains supported. Removing the last present element stores an empty list so legacy canon-ref fallback cannot repopulate it. Organization moved to Overview with the shared branch dropdown (including No branch); the branch data remains `event.branchRef`. Suite WebView2 verified hidden searches, category grouping, both Add controls, Escape/focus restoration, and the existing Sueño Previsor branch in Overview without document mutations. Build/typecheck and inspector-tab checks passed.

Uniformity pass: shared `InspectorPanel` frames Content, Decisions, Conditions, Consequences, entity uses/copies and action/rule sections. Overview fields now use separate inset panels with 17 px accent headings. Conversation groups and advanced Source use the same frames; response/condition cards use the inner panel surface. Route inspector sections share the panel component, while legacy direct inspector sections inherit the heading/frame rules. Standardized control sizes and thin scrollbars. Logic instructions, diagnostics and all editing callbacks remain present. Real Suite WebView2 reviewed the six event tabs and confirmed Overview heading sizes and no horizontal overflow across Overview, Conversation, Conditions, Consequences and Decisions at 650 px. Captures: `uniform-*.png`. Build/typecheck and inspector-tab verification passed. Changes remain uncommitted; no document edits were exercised during the visual checks.

Validation also exposed a missing ES/EN label for the new `interaction` trace kind in Play Mode. Added that label to complete the typecheck without changing runtime behavior.

Validated with Playwright CLI on the real Suite WebView2: bordered cards, unchanged tab position during content scrolling, and a 650 px viewport without horizontal inspector overflow. Captures: `connections-framed-detail.png`, `connections-framed-lower.png`, `connections-framed-narrow.png`. Build, typecheck and inspector-tab verification passed. Existing missing-destination labels remain a separate routing issue; no document mutation was exercised during this visual check. Changes remain uncommitted alongside existing local work.

### Destinos de Después: navegación directa

En Conexiones, Después presenta cada destino como una tarjeta con su nombre y
una flecha alineada a la derecha para ir al elemento. No contiene desplegables
ni controles de prioridad, condiciones o edición de la ruta. Las referencias
sin destino disponible mantienen el aviso y deshabilitan la navegación.
Los otros contextos del editor narrativo conservan sus controles de rutas.

Validación: typecheck, build y verify-inspector-tabs correctos. En la Suite real
(WebView2), las tarjetas Despertar y Sueño Eterno no tienen details/input/select;
la flecha abre Despertar y permite regresar desde Antes a Sueño Premonitorio.
Captura local: output/playwright/after-navigation.png. La sesión acumuló errores
previos de recarga y avisos de Hooks en PathBranchingApp; esta comprobación no
certifica una consola limpia ni el ciclo de exportación.

### Evento: hero y estadísticas

La pestaña del evento se llama Evento (Event en inglés), conservando el id
persistido overview. El hero reúne portada, categoría, rama y descripción;
las estadísticas etiquetadas se muestran debajo, sin la antigua franja de
contexto. Conexiones ya no ofrece Archivo de guion; los datos de guion existentes
se conservan. La vista estrecha apila el hero.
Validación: build/typecheck, verify-inspector-tabs y Suite WebView2 con Playwright;
portada real, tres selectores, estadísticas 3/6/8 y ancho de 650px sin desborde.
Capturas locales event-hero.png y event-hero-narrow.png.

### Interacción como módulo del inspector

Interacción es un módulo opcional propio para eventos y elementos narrativos,
disponible desde +. Sin preferencias guardadas, el contenido existente hace
visible la pestaña. Respeta las preferencias previas. El editor aparece una sola
vez, dentro del marco compartido; ya no se inserta antes de las pestañas ni al
final de Evento, Conversación, Conexiones, Condiciones, Consecuencias o Decisiones.
Los nodos de interacción y espera tienen configuración en Interacción y su
Recorrido en Conexiones. Un diálogo filtra usos y esperas por su ámbito.
Validación: typecheck/build, verify:core y regresiones de módulos con documento
sin interacción, con interacción existente, ámbito de diálogo y nodo propio.
Suite real WebView2: los seis apartados comprobados no incluyen el editor;
Interacción muestra un único editor y no desborda a 650px. Capturas locales:
interaction-section.png e interaction-section-narrow.png. No se modificaron datos
del universo durante esta comprobación; solo navegación y preferencias de UI.

### Identidad del nodo y portada integrada

El módulo principal identifica el objeto: Evento, Diálogo, Decisión, Respuesta,
Intervención, Acotación, Interacción o Espera. Conserva los ids de módulo y las
preferencias; el hero sigue siendo específico del evento.
La portada es el disparador del selector de imágenes, también cuando no tiene
imagen. Quitar portada permanece en el menú. Usa el mismo comportamiento de
teclado, previsualización sin cambios y cierre con Escape del selector compartido.
Descripción precede a categoría y rama dentro del hero.
Validación: typecheck/build y build:core; verify-inspector-tabs y comprobación de
nombres en referencias de diálogo, intervención, decisión y respuesta. Suite
WebView2: portada única abre con clic/Enter, Escape conserva foco, descripción
antes de metadatos y ancho de 650px sin desborde. El universo de laboratorio
activo no tenía imágenes; no se modificaron sus datos. Captura local:
output/playwright/event-cover-control.png.

### Escritura de descripción sin mutación por pulsación

La descripción de Evento utiliza AuthoringTextField, con borrador recuperable y
confirmación tras 500ms sin escribir o al perder foco. Antes onChange llamaba a
onUpdateEvent en cada pulsación, activando commitStructuralAction, historial,
aplicación del proyecto/reconstrucción del canvas y persistencia en disco.
Se mantiene el mismo callback de actualización y la presentación del hero.
Validación: typecheck/build y verify-authoring-drafts. En Suite WebView2, una
ráfaga de 80 cambios de entrada mostró borrador recuperable y ninguna mutación
DOM en el canvas; se restauró el texto inicial antes de confirmar, sin cambiar
los datos del universo. Script local: description-typing-check.cjs. Es una prueba
de aislamiento de escritura, no un benchmark de latencia de tecleo real.

### Conversación vertical

Los diálogos dejan de ser grupos desplegables: muestran sus líneas, resumen de
personajes y lugares existentes, seguido por una barra de controles. Un índice
lateral permite saltar a diálogos y líneas. El menú ... de cada línea concentra
mover, insertar y borrar, con el mismo menú para clic derecho y Shift+F10;
Escape restaura foco. El texto conserva borradores y los guardados diferidos.
No se modifica la semántica de conexiones ni las restricciones de edición.
Validación: typecheck/build y verify:core; Suite WebView2 con tres líneas de
laboratorio, navegación por índice, tres formas de abrir el menú, foco y 650px
sin desborde. Los datos narrativos no se modificaron en la validación de UI.

### Vista centrada del inspector

La vista centrada (pantalla completa del canvas) centra el panel en ambos ejes
sobre el área real del canvas con márgenes de 16px. Una capa negra al 80% detrás
del inspector separa sus controles del fondo. La capa desaparece al salir de
esta vista. No altera la colocación del inspector flotante normal.
Validación: typecheck/build; Playwright en Suite WebView2 confirma centro con
menos de 1px de diferencia, alpha 0.8, límites de canvas y retirada de la capa
al salir. Captura: output/playwright/inspector-centered-backdrop.png.

En modo centrado se muestra únicamente el inspector activo. Los inspectores
abiertos se eligen desde una columna izquierda; en ventanas pequeñas se usan
sus iconos con el nombre accesible. Localizar, ampliar, contraer y cerrar se
ocultan en pantalla completa; a la derecha queda el botón para salir. Los grupos
de pestañas se gestionan a la izquierda. Columnas laterales simétricas mantienen la tarjeta
en el centro del canvas. Contraer conserva la pestaña en la navegación y permite
volver a abrirla. Al salir se recupera la pila flotante de inspectores.
Validación: typecheck/build y verify-inspector-tabs. Suite WebView2: cambio entre
Evento e intervención, una sola tarjeta visible, contraer y restaurar, navegación
por teclado y recuperación de las dos tarjetas flotantes. A 650 y 1500px, centro
con menos de 1px de diferencia, controles fuera de la tarjeta y capa al 80%.
Capturas locales: output/playwright/inspector-centered-navigation.png y
output/playwright/inspector-centered-navigation-wide.png. Sin cambios narrativos.

La navegación de secciones queda fuera de `inspector-scroll`, en una fila fija
a todo el ancho de la tarjeta. El contenedor exterior no reserva un gutter de
scroll oculto; el scroll de contenido comienza debajo de la navegación, también
en Conversación. Validación: typecheck/build y verify-inspector-tabs; Suite
WebView2 en Evento, Conexiones y Conversación, 650/1500px, límites coincidentes
de barra y cuerpo y navegación inmóvil al desplazar contenido. Capturas locales:
output/playwright/inspector-scroll-below-tabs.png y versión -wide.png.

Narrativa reemplaza el nombre Conversación sin cambiar los IDs de secciones.
Las líneas propias vacías no generan cabecera ni controles antes de agrupaciones
existentes. Sin narrativa hay únicamente un + a la izquierda con las opciones
Iniciar conversación e Iniciar diálogo. El índice solo se muestra en pantalla
completa y resume agrupaciones y diálogos sueltos, sin numeración: nombres para
la ubicación actual y vecinas, barras para las demás con nombre al hover/foco.
Validación: build/typecheck, verify-inspector-tabs y verify:authoring. Suite real,
comprobación de lectura en Sueño Premonitorio y estado vacío en Despertar sin
mutar el universo. Capturas narrative-index-simplified y narrative-empty-plus.

Cada sección de Narrativa conserva su tarjeta exterior. La cabecera de contexto
es una tarjeta interior con personajes en una fila y lugares en otra; los lugares
existentes se presentan por separado. Cada intervención tiene un envoltorio
individual con borde, fondo y radio de 8px. Validación: typecheck/build y
verify-inspector-tabs; Suite WebView2, 50 líneas de Sueño Premonitorio, filas de
cabecera separadas y ventana de 650px sin desbordes. Captura local:
output/playwright/narrative-summary-and-lines.png. Sin cambios narrativos.

Las pestañas se reordenan únicamente arrastrando, sin botones de subir/bajar. El mismo orden
mixto (eventos y otros inspectores) se aplica al DOM de la pila flotante y se
guarda en la sesión local y los grupos; no se añade al documento narrativo.
Una transición de 240ms con desplazamiento y fundido acompaña los cambios de
vista y el reordenamiento. Respeta movimiento reducido y cancela animaciones
interrumpidas. Validación: typecheck/build, verify:core y Suite WebView2: drag,
botones, teclado, orden al salir, guardar/cargar grupo en el laboratorio y
persistencia tras reapertura. Animación presente en ambos sentidos y ausente
con movimiento reducido. Capturas locales: inspector-order-fullscreen.png e
inspector-motion-final.png bajo output/playwright de la Suite.

Se reducen las columnas laterales simétricas de 150px a 126px como máximo,
dando hasta 48px más al inspector central. Suite WebView2: un único botón de
selección por pestaña, arrastre y orden al salir, centrado y más ancho también
en ventana de 650px. Captura local: output/playwright/inspector-drag-only.png.

En pantalla completa, el índice de narrativa se monta en un slot de la columna
derecha del dock, debajo del botón para salir. Queda fuera de la tarjeta central
y su scroll; la narrativa utiliza toda la anchura interior. El índice conserva
sus saltos, foco y seguimiento del tramo visible y se retira al cambiar de
sección o salir de pantalla completa. Validación: typecheck/build y Suite
WebView2, posición exterior sin desbordar el canvas, salto y foco en contenido,
limpieza al cambiar de sección y modo. Captura local: inspector-external-index.png.

El índice exterior queda centrado verticalmente en la columna derecha, con
48px de reserva simétrica arriba y abajo. Su altura crece con el contenido en
ambas direcciones; al alcanzar el límite disponible pasa a tener scroll propio.
Validación en Suite WebView2 con entradas DOM temporales (sin editar el universo):
crecimiento simétrico, centro con menos de 1px de diferencia y scroll en una
lista larga. Captura local: output/playwright/inspector-index-centered.png.

La narrativa omite la barra Controles/Personaje local y los números visibles de
línea. El selector de idioma se conserva únicamente en documentos multilingües.
Las filas anchas centran verticalmente arrastre, hablante, texto y menú en una
misma línea horizontal; las estrechas conservan la disposición apilada.
Validación: typecheck/build y Suite WebView2, controles ausentes, centros de los
cuatro elementos coincidentes y menú de línea operativo, sin cambios al universo.
Captura local: output/playwright/conversation-clean-rows.png.

### Agarre integrado de líneas

El texto de cada línea tiene su propio marco interior, fondo de panel y padding
de 10px/12px; el foco resalta el borde. Se elimina el tirador de redimensionado
manual, también en las líneas provisionales. Verificado en Suite WebView2 con
estilos calculados y captura `output/playwright/narrative-text-frame.png`, sin
editar contenido del universo.

Las líneas de narrativa reservan un margen izquierdo para el agarre sin botón enmarcado. Aparece con hover o foco de teclado y permanece visible en dispositivos sin hover. El arrastre muestra una marca arriba o abajo del destino para indicar la posición final; salir o cancelar limpia esa marca. El reordenamiento conserva los textos y las identidades de las rutas y respeta los tramos protegidos del recorrido.

El selector de hablante sigue el flujo del canvas: sin búsqueda muestra Narrador, identidad desconocida y personajes ya usados/presentes en el evento, manteniendo accesible el hablante actual. Buscar amplía la lista a las identidades disponibles del universo. Se aplica a las líneas existentes y a las provisionales; Escape cierra el selector y devuelve el foco sin salir del modo centrado.

### Nombres narrativos

| Identificador interno | ES | EN |
| --- | --- | --- |
| event | Evento | Event |
| dialogue | Conversación | Conversation |
| speech / speechBeat | Diálogo | Dialogue |
| direction / directionBeat | Acotación | Stage direction |
| decision | Decisión | Decision |
| outcome | Opción | Option |
| interaction | Interacción | Interaction |
| barrier | Espera | Wait |
| directorNote (adjunto) | Nota de dirección | Direction note |

Conversación nombra el conjunto; Diálogo nombra una línea hablada. Nota de dirección es un adjunto, mientras Acotación es una línea narrativa sin hablante. Los nombres visibles se aplican a tipos, menús, módulos y estadísticas. Los identificadores internos y los títulos escritos en documentos existentes se conservan.

Las conversaciones tienen tres botones al final de su cabecera: chevron arriba, chevron abajo y papelera. No tienen agarre ni menú de acciones. La papelera abre una confirmación con el nombre de la conversación y el contenido que se eliminará; Cancelar recibe el foco inicial, Escape cierra el diálogo y el foco vuelve al botón de origen. El orden de presentación y del índice se recuerda localmente por universo/documento/evento, sin alterar las conexiones ni la ejecución. Eliminar utiliza la mutación existente y protege borradores pendientes, interacciones y referencias externas; también limpia las conexiones de entrada/salida del contenedor eliminado.

### Bifurcaciones en Narrativa

Los puntos de inserción al comienzo, entre líneas y al final no aumentan el espaciado normal. El hueco y el «+» se activan juntos tras 300 ms con el cursor detenido (tolerancia de 4 px). Moverse reinicia la espera; atravesar el espacio no lo expande. El botón conserva la coordenada X donde se detuvo el cursor, limitada a los bordes del contenido, y se centra verticalmente en el hueco entre líneas. Queda fijo mientras se usa. Abandonar el espacio cancela la espera y contrae el hueco. El foco de teclado lo revela inmediatamente y las pantallas táctiles mantienen el acceso visible. El menú permite insertar Diálogo, Acotación o Decisión en esa posición con las mutaciones existentes, conservando textos y conexiones. No hay un «+» fijo después de las líneas. Una decisión insertada antes del primer diálogo convierte la conexión de entrada en el inicio de ejecución.

El botón de la transición actual («Decisión», «Conversación» o «Subevento») abre un selector dentro del cierre de escena: Conversación, Subevento o Decisión, con selección existente o «Crear y continuar». «Quitar transición» elimina solo la conexión del contenedor: conserva líneas, decisiones y destinos, y permite declarar otra transición. «Fin de la escena» aparece cuando existe una continuación declarada; sin ella aparece «Añadir transición». Se conecta el contenedor en la secuencia de su evento padre. Las conversaciones y decisiones ofrecidas pertenecen a ese evento; los subeventos son sus hijos existentes o se crean allí. Una decisión interna pendiente o varias continuaciones impiden cerrar ambiguamente. Al crear un elemento se conserva la continuación previa cuando corresponde, y los cambios sobreviven a la reapertura. Los subeventos se abren en su propio inspector.

Las opciones comparten una fila horizontal (con desplazamiento si no caben) y no se pide el nombre de la decisión en esta vista. La continuación de la opción seleccionada se muestra en un botón centrado con menú de destinos y acceso al contenido conectado. Una flecha señala el bloque siguiente. Si una conversación enlaza con una decisión externa, su cierre muestra el separador «Fin de la escena» y un botón «Decisión» que enfoca la tarjeta de abajo. Las decisiones internas se intercalan entre sus líneas sin cerrar la escena. Estos elementos visuales no crean conexiones nuevas.

Las transiciones de Narrativa comparten `NarrativeTransitionControl`: botón centrado del tipo actual, selector de tipo y destino existente, aplicar, crear y continuar, quitar, ir al destino y cerrar. Se utiliza tanto al cerrar una conversación como en las opciones seleccionadas y al pasar de una línea a una decisión. La flecha conserva la relación visual con el siguiente bloque. Fuera de una conversación ofrece conversación, subevento y decisión; dentro ofrece diálogo, acotación y decisión. Los destinos actuales de otros tipos siguen visibles. Las conexiones múltiples permiten explorar una ruta sin reemplazar ni borrar todas las conexiones. Escape cierra el selector y devuelve el foco al botón sin desplazar las pestañas.

Las decisiones aparecen en el punto que definen las conexiones del canvas. Sus opciones editan el mismo documento y seleccionar una opción solo cambia el recorrido visible: debajo aparecen las conversaciones enlazadas, sin evaluar variables o condiciones ni guardar una elección del jugador. El índice sigue las conversaciones visibles. En un recorrido ramificado, el orden depende del grafo y los botones de reordenar conversaciones quedan desactivados.

El creador de líneas y su menú permiten añadir una decisión con dos opciones. La continuación previa se conserva en la primera opción, manteniendo la ruta de entrada. Se pueden editar los textos, añadir opciones, elegir un destino existente o crear una conversación para una opción sin destino. Dentro de una conversación, se crea una línea de diálogo en su mismo contexto. Una decisión interna pendiente también detiene la continuación del contenedor. Las conexiones múltiples requieren elegir qué ruta explorar y los ciclos detienen la lectura. Las referencias y borradores siguen perteneciendo a los nodos originales.

Validación: `typecheck`, `verify:core` y `build` pasan. En la Suite real sobre WebView2 se comprobó la selección de las tres decisiones existentes de Sueño Premonitorio y sus conversaciones de bosque, barco y puerta, además del cambio a Vuelta al Pueblo 1 que oculta las ramas alternativas. La creación, conservación de continuaciones y reapertura se cubren con un documento sintético en los checks del modelo; no se modificó el universo real para probar mutaciones.

La unificación de transiciones se verificó con creación, reemplazo, eliminación, conservación de identidad y etiqueta de rutas, contenido y reapertura en el modelo sintético. En WebView2 se comprobó la misma lista de acciones en cierre de conversación y opción de decisión, destinos A/B y restauración del foco con Escape; no se aplicaron mutaciones al universo del usuario.

## Nombres narrativos

Los nombres nuevos usan tipo y primer número disponible: Evento, Evento final, Evento de exploración, Subevento, Conversación, Decisión y Opción (ES/EN). Eventos se numeran por tipo y secuencia; subeventos por padre; conversaciones y decisiones por evento; opciones por decisión. La creación toma el idioma de interfaz actual. Los nombres guardados no se traducen ni se renumeran al mover o borrar elementos; los nombres antiguos se conservan íntegros.

El lápiz en cabeceras y junto al destino seleccionado abre el editor común. Guardar recorta espacios y rechaza nombres vacíos; Cancelar o Escape descarta la edición y restaura el foco. «Usar nombre automático» propone un nombre excluyendo al propio nodo, sin guardar hasta pulsar Guardar. Los nombres internos de opciones se editan con el mismo control en su inspector, separados del texto visible de respuesta. Los diálogos y acotaciones siguen identificándose por su texto. Nombres repetidos en el selector reciben contexto de propietario solo al mostrarse.

La validación incluye numeración por ámbitos, huecos tras borrado, ES/EN, conservación de IDs, rutas y contenido y reapertura. En la Suite real sobre WebView2 se verificaron nombre vacío, propuesta, cancelación y foco en el inspector. Un documento sintético montado con los componentes de producción comprobó renombrar una conversación y una decisión desde el selector, persistir con los comandos Tauri reales, reabrir y crear una continuación con nombre breve. Archivo de prueba: output/playwright/naming-runtime.json; capturas bajo output/playwright en la Suite. El universo del usuario no se renombró durante estas pruebas.