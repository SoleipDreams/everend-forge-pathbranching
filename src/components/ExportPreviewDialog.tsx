import { useMemo, useRef } from "react";
import { Download, X } from "lucide-react";
import type { BranchingProject } from "../domain.js";
import { buildExportPreview, type ExportPreviewMode } from "../exportPreview.js";
import { useInterfaceLocale } from "../i18n.js";
import { useOverlayFocus } from "./useOverlayFocus.js";
import "../authoringControls.css";

/** Read-only presentation of the existing exporter. Never writes to the story. */
export function ExportPreviewDialog({ project, mode, open, onClose, onExport }: {
  project: BranchingProject; mode: ExportPreviewMode; open: boolean;
  onClose: () => void; onExport: (mode: ExportPreviewMode) => void;
}) {
  const locale = useInterfaceLocale();
  const ref = useRef<HTMLElement>(null);
  useOverlayFocus(ref, open, onClose, true);
  const preview = useMemo(() => {
    if (!open) return undefined;
    try { return { bundle: buildExportPreview(project, mode) }; }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  }, [project, mode, open]);
  if (!open) return null;
  const title = locale === "es" ? "Revisar salida" : "Review output";
  const close = locale === "es" ? "Cerrar vista previa" : "Close preview";
  return <div className="modal-backdrop pb-export-preview-backdrop">
    <section ref={ref} className="modal-dialog pb-export-preview" role="dialog" aria-modal="true" aria-label={title}>
      <header><div><h2>{title}</h2><small>{preview?.bundle?.defaultName ?? mode}</small></div><button type="button" aria-label={close} onClick={onClose}><X size={16}/></button></header>
      <p>{locale === "es" ? "Esta es la salida del documento actual. Los valores temporales del probador no se incluyen." : "This is the current document's output. Temporary condition tester values are excluded."}</p>
      {preview?.error ? <p role="alert">{preview.error}</p> : <textarea readOnly aria-label={locale === "es" ? "Contenido de la exportación" : "Export content"} spellCheck={false} value={preview?.bundle?.content ?? ""}/>}
      <footer><button type="button" onClick={onClose}>{locale === "es" ? "Cerrar" : "Close"}</button><button type="button" disabled={!preview?.bundle} onClick={() => onExport(mode)}><Download size={15}/>{locale === "es" ? "Exportar archivo" : "Export file"}</button></footer>
    </section>
  </div>;
}
