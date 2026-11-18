<p align="center"><img src="src/assets/pathbranching-icon.png" width="112" alt="Icono de PathBranching"></p>

<h1 align="center">Everend PathBranching</h1>
<p align="center">Editor visual gratuito y open source para diseñar historias ramificadas y exportarlas a formatos runtime portables.</p>

<p align="center"><a href="README.md">English</a> · <a href="https://github.com/SoleipDreams/everend-forge-pathbranching/releases/latest">Descargar gratis</a> · <a href="https://website-everend-forge.pages.dev/">Conocer la Suite integrada</a></p>

## Flujo de autoría

1. Abrir una carpeta de universo compatible con WorldNotion.
2. Referenciar el canon mediante identificadores estables.
3. Crear historias, secuencias, eventos, elecciones, condiciones y consecuencias.
4. Validar y previsualizar la historia.
5. Exportar JSON/YAML para motores y adaptadores.

El documento de historia es la fuente de verdad; la disposición del canvas no cambia las exportaciones. PathBranching guarda sus datos bajo .everend/.pathbranching y no sobrescribe las notas Markdown del canon.

## Estado y documentación

El trabajo actual cierra el ciclo de autoría y exportación offline; la sincronización en vivo con Unity está aplazada. Empieza por [el índice de documentación](docs/README.md), el [formato EVPATH](docs/EVPATH_FORMAT.md) y la [arquitectura de integración](docs/INTEGRATION_ARCHITECTURE.md).

~~~sh
npm install
npm run typecheck
npm run verify:core
npm run build
~~~

## Licencia y marca

El código se ofrece bajo MIT o Apache-2.0; la documentación bajo CC BY 4.0 cuando así se indica. Conserva los avisos legales al redistribuir. Consulta [LICENSE](LICENSE), [MIT](LICENSE-MIT), [Apache-2.0](LICENSE-APACHE), [CC BY 4.0](LICENSE-CC-BY-4.0) y la [política de marca](TRADEMARKS.md).

La aplicación es gratuita por separado. Everend Forge Suite es una oferta integrada distinta; su compra no cambia la licencia open source de PathBranching.
