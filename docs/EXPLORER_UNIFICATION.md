# Explorador unificado de PathBranching

## Implementación

El explorador comparte una cabecera y conserva sus cinco vistas montadas. El modo integrado de `WorkspaceSidePanel` y `PanelShell` se activa por contexto únicamente dentro de gestión; otros usos conservan su cabecera. Se mantienen el redimensionado de Historias, la restauración del layout y los menús contextuales.

La presentación común está en `ExplorerPresentation.tsx` y `explorerPresentation.css`. Los estilos están aislados por `.pathbranching-app` y utilizan los tokens `--ef-*`. Suite consume las fuentes independientes; esta entrega no modifica vendors ni integra releases.

## Inventario funcional conservado

| Sección | Controles y datos conservados |
| --- | --- |
| Historias | Selección, creación, renombrado y eliminación de historias/secuencias; pestañas Secuencia/Ramas/Rutas; nombre, evento inicial, protagonista, conexiones y contadores. El ID queda en Detalles técnicos. Ramas conserva color, descripción, creación de eventos normales/finales y asignación de eventos. |
| Recursos | Entidades/Archivos, búsqueda, origen, categorías, árbol, grupos, contadores, selección, apertura de inspector, arrastre de referencias, creación/eliminación local, inicialización e importación. Canon continúa siendo de solo lectura. |
| Lógica | Propiedades/Variables/Acciones/Reglas. Propiedades conserva etiqueta, tipo, descripción, obligatoriedad, opciones valor/etiqueta, tipos destino/aplicables y, cuando corresponde, icono, color y carpeta sugerida; también se conservan campos canónicos, capacidades y YAML técnico del editor existente. Variables conserva grupos, orden, tipos y valores. |
| Exportar e importar | Ampliado, Ink, Twine/SugarCube, SINPO/Game Data, perfil anterior, limitaciones, diagnósticos, localizar, preview y exportación. Twine conserva archivo preparado, errores y confirmación de importación. |
| Conectar | Unity, Unreal y Godot mantienen sus estados de disponibilidad. Se traduce Próximamente/requiere; no se implementan adaptadores. |

## Estado y accesibilidad

- Las pestañas internas usan `ExplorerPane`: el contenido permanece montado y cada vista conserva su desplazamiento. Los filtros y borradores siguen perteneciendo a sus componentes actuales.
- Los grupos de secuencia y creación de propiedades usan `ExplorerGroup`. Su apertura se guarda en `sessionStorage` con el prefijo `pathbranching.explorer.group.`; sobrevive a recargas de la sesión y no forma parte de historias, canon ni exportaciones. Los ajustes persistentes anteriores no cambian de formato.
- Los menús conservan sus acciones y estados deshabilitados. El menú local añade semántica de menú, flechas, Home/End, Escape y restauración de foco.
- Los controles flotantes se ajustan al viewport al redimensionar o desplegar campos. Los diálogos omiten campos dentro de grupos cerrados al elegir el foco inicial y al recorrer el foco.
- Abrir/plegar grupos no ejecuta operaciones narrativas ni guarda documentos. No se cambian IDs, traducciones, referencias, transiciones o contratos públicos.

## Comprobación de escritorio — 2026-10-09

Playwright CLI conectado al WebView2 real, sin Computer Use:

- PB: 80 capturas de las cinco secciones en 1440×900, 1280×720, 1100×720 y 900×700; ES/EN y Forge claro/oscuro. La comprobación detectó cero cabeceras internas duplicadas, cero desbordamientos horizontales y cero errores de ejecución durante la matriz.
- Suite: las cinco secciones se comprobaron en su ventana nativa con fuentes independientes; cero cabeceras o controles de plegado duplicados.
- Menú de historias: acciones existentes, navegación de teclado y Escape con retorno al botón.
- Recursos: búsqueda conservada entre Entidades/Archivos y entre secciones.
- Propiedades: borrador conservado al cerrar/reabrir, campos condicionales presentes, límites del diálogo a 900×700, foco visible con Información básica cerrada y retorno al botón al salir.
- Movimiento reducido: disposición de Lógica en dos columnas a 900×700, sin desbordamiento; transiciones reducidas conforme a la política global de Forge.
- Los errores transitorios de HMR y un error de etiqueta durante el desarrollo se corrigieron. La recarga posterior de PB quedó sin errores de consola; el grupo cerrado cuenta con una prueba de regresión en `verify-application-activity.mjs`.

Evidencias locales, excluidas de Git: `output/playwright/explorer-matrix-result.log`, `explorer-form-result.log`, `explorer-check-result.log`, `explorer-final-*.png`; en Suite, `output/playwright/explorer-suite-result.log` y `explorer-suite-*.png`.

La ventana independiente cambió de universo desde otra sesión durante la matriz: las capturas prueban disposición, idiomas y temas, pero no constituyen una comparación de contenido idéntico. No se ejecutaron creación/eliminación ni confirmaciones de importación sobre ese universo compartido. La aceptación nativa completa escribir/guardar/reabrir/probar/exportar y sus diálogos de Windows sigue separada de estas comprobaciones estéticas; las verificaciones de core cubren persistencia y exportación sin sustituir esa aceptación manual.

## Verificaciones automatizadas finales

- PB: `npm run verify:core` y `npm run build` (incluye `typecheck`), correctos.
- Foco/actividad: cuatro pruebas en `verify-application-activity.mjs`, incluida la regresión de grupos cerrados, correctas.
- Suite: `npm run build:sources` (incluye `typecheck:sources`), seis checks de navegación y ocho de biblioteca, correctos.
- Rust: `cargo check` de PB y Suite, correctos; Suite conserva avisos de compilación de código existente.
- Los builds conservan los avisos de tamaño de chunks e importación dinámica inefectiva de persistencia. No se cambió el empaquetado en esta entrega.

Los cambios permanecen sin commit junto al trabajo local previo; no se sincronizó ni modificó ningún vendor.
