import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EVPATH_INDENT, parseEvpath, type EvpathParsedLine } from "../evpathFormat.js";

type VisualNode = EvpathParsedLine & { children: VisualNode[] };
export type VisualBlockKind = "speech" | "direction" | "decision";

type Props = {
  source: string;
  onApply: (nextSource: string) => { errors: Array<{ message: string }>; warnings: string[] };
};

function escapeText(value: string) {
  const text = value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/#\^/g, "\\#^");
  return text.length && ["*", "?", "=", "-", "[", "(", "~", "#", "\\"].includes(text[0])
    ? `\\${text}`
    : text;
}

function anchorSuffix(line: EvpathParsedLine) {
  return line.anchor ? ` #^${line.anchor}` : "";
}

function conditionSuffix(line: EvpathParsedLine) {
  return line.condText ? ` ${line.condText}` : "";
}

function contentLine(line: EvpathParsedLine, value: string) {
  const indent = EVPATH_INDENT.repeat(line.indent);
  const text = escapeText(value);
  switch (line.kind) {
    case "direction":
      return `${indent}[${text}]${conditionSuffix(line)}${anchorSuffix(line)}`;
    case "decision":
      return `${indent}? ${text}${conditionSuffix(line)}${anchorSuffix(line)}`;
    case "option":
      return `${indent}* [${text}]${conditionSuffix(line)}${anchorSuffix(line)}`;
    case "speech":
      return `${indent}${line.speaker ? `${line.speaker}${line.variant ? ` (${line.variant})` : ""}: ` : ""}${text}${conditionSuffix(line)}${anchorSuffix(line)}`;
    case "dialogue":
      return `${indent}= dialogue: ${text}${conditionSuffix(line)}${anchorSuffix(line)}`;
    default:
      return "";
  }
}

function replaceLine(source: string, line: EvpathParsedLine, value: string) {
  const rows = source.replace(/\r\n/g, "\n").split("\n");
  rows[line.line - 1] = contentLine(line, value);
  return `${rows.join("\n").replace(/\n+$/, "")}\n`;
}

function insertLine(source: string, rawIndex: number, indent: number, kind: VisualBlockKind | "option") {
  const rows = source.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  const prefix = EVPATH_INDENT.repeat(indent);
  const line = kind === "speech"
    ? `${prefix}Escribe diálogo`
    : kind === "direction"
      ? `${prefix}[Escribe una dirección]`
      : kind === "decision"
        ? `${prefix}? Nueva decisión`
        : `${prefix}* [Nueva opción]`;
  rows.splice(rawIndex, 0, line);
  return { source: `${rows.join("\n")}\n`, focusText: kind === "speech" ? "Escribe diálogo" : kind === "direction" ? "Escribe una dirección" : kind === "decision" ? "Nueva decisión" : "Nueva opción" };
}

function buildTree(lines: EvpathParsedLine[]) {
  const roots: VisualNode[] = [];
  const stack: Array<{ indent: number; children: VisualNode[] }> = [{ indent: -1, children: roots }];
  lines.forEach((line) => {
    if (line.kind === "header") return;
    while (stack.length > 1 && line.indent <= stack[stack.length - 1].indent) stack.pop();
    const node: VisualNode = { ...line, children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push({ indent: line.indent, children: node.children });
  });
  return roots;
}

function endLine(node: VisualNode): number {
  return node.children.reduce((last, child) => Math.max(last, endLine(child)), node.line);
}

function LineTextField({ line, label, onCommit, autoFocus = false }: {
  line: VisualNode;
  label: string;
  onCommit: (value: string) => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(line.text ?? "");
  useEffect(() => setDraft(line.text ?? ""), [line.anchor, line.line, line.text]);
  const commit = () => {
    if (draft !== (line.text ?? "")) onCommit(draft);
  };
  return (
    <label className="evpath-visual-text">
      <span>{label}</span>
      <textarea
        rows={line.kind === "direction" ? 2 : 1}
        value={draft}
        autoFocus={autoFocus}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && line.kind !== "direction") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function InsertControl({ indent, rawIndex, onInsert }: {
  indent: number;
  rawIndex: number;
  onInsert: (kind: VisualBlockKind, rawIndex: number, indent: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="evpath-visual-insert">
      {open ? (
        <div className="evpath-visual-insert-menu" role="group" aria-label="Añadir bloque">
          <button type="button" onClick={() => onInsert("speech", rawIndex, indent)}>Diálogo</button>
          <button type="button" onClick={() => onInsert("direction", rawIndex, indent)}>Dirección</button>
          <button type="button" onClick={() => onInsert("decision", rawIndex, indent)}>Decisión</button>
          <button type="button" className="quiet" onClick={() => setOpen(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="evpath-visual-add" onClick={() => setOpen(true)} aria-label="Añadir bloque">+</button>
      )}
    </div>
  );
}

function Sequence({
  nodes,
  emptyAt,
  emptyIndent,
  onInsert,
  onEdit,
  onAddOption,
  activeOptions,
  setActiveOption,
  focusText,
}: {
  nodes: VisualNode[];
  emptyAt: number;
  emptyIndent: number;
  onInsert: (kind: VisualBlockKind, rawIndex: number, indent: number) => void;
  onEdit: (line: VisualNode, value: string) => void;
  onAddOption: (decision: VisualNode, options: VisualNode[]) => void;
  activeOptions: Record<string, number>;
  setActiveOption: (decisionKey: string, index: number) => void;
  focusText?: string;
}) {
  const rendered: ReactNode[] = [];
  if (!nodes.length) {
    return <InsertControl rawIndex={emptyAt} indent={emptyIndent} onInsert={onInsert} />;
  }
  rendered.push(<InsertControl key={`start:${emptyAt}`} rawIndex={emptyAt} indent={emptyIndent} onInsert={onInsert} />);

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.kind === "option") continue;
    if (node.kind === "decision") {
      const options: VisualNode[] = [];
      let optionIndex = index + 1;
      while (optionIndex < nodes.length && nodes[optionIndex].kind === "option" && nodes[optionIndex].indent === node.indent) {
        options.push(nodes[optionIndex]);
        optionIndex += 1;
      }
      const decisionKey = node.anchor ?? `line:${node.line}`;
      const activeIndex = Math.min(Math.max(activeOptions[decisionKey] ?? 0, 0), Math.max(options.length - 1, 0));
      const activeOption = options[activeIndex];
      const insertionAt = options.length ? endLine(options[options.length - 1]) : node.line;
      rendered.push(
        <div className="evpath-visual-decision" key={`decision:${decisionKey}`}>
          <LineTextField line={node} label="Decisión" onCommit={(value) => onEdit(node, value)} autoFocus={focusText === node.text} />
          <div className="evpath-visual-options" aria-label="Opciones de la decisión">
            <button type="button" aria-label="Opción anterior" disabled={options.length < 2} onClick={() => setActiveOption(decisionKey, (activeIndex + options.length - 1) % options.length)}>‹</button>
            {activeOption ? (
              <LineTextField line={activeOption} label={`${activeIndex + 1} de ${options.length}`} onCommit={(value) => onEdit(activeOption, value)} autoFocus={focusText === activeOption.text} />
            ) : <span className="evpath-visual-empty-option">Aún no hay opciones.</span>}
            <button type="button" aria-label="Opción siguiente" disabled={options.length < 2} onClick={() => setActiveOption(decisionKey, (activeIndex + 1) % options.length)}>›</button>
            <button type="button" className="evpath-visual-option-add" onClick={() => onAddOption(node, options)} aria-label="Añadir opción">+</button>
          </div>
          {activeOption ? (
            <div className="evpath-visual-branch">
              <span className="evpath-visual-branch-label">Rama de esta opción</span>
              <Sequence
                nodes={activeOption.children}
                emptyAt={activeOption.children.length ? endLine(activeOption.children[activeOption.children.length - 1]) : activeOption.line}
                emptyIndent={activeOption.indent + 1}
                onInsert={onInsert}
                onEdit={onEdit}
                onAddOption={onAddOption}
                activeOptions={activeOptions}
                setActiveOption={setActiveOption}
                focusText={focusText}
              />
            </div>
          ) : null}
        </div>,
      );
      rendered.push(<InsertControl key={`after:${decisionKey}`} rawIndex={insertionAt} indent={node.indent} onInsert={onInsert} />);
      index = optionIndex - 1;
      continue;
    }

    if (node.kind === "dialogue") {
      rendered.push(
        <section className="evpath-visual-dialogue" key={`dialogue:${node.anchor ?? node.line}`}>
          <LineTextField line={node} label="Secuencia de diálogo" onCommit={(value) => onEdit(node, value)} autoFocus={focusText === node.text} />
          <Sequence
            nodes={node.children}
            emptyAt={node.children.length ? endLine(node.children[node.children.length - 1]) : node.line}
            emptyIndent={node.indent + 1}
            onInsert={onInsert}
            onEdit={onEdit}
            onAddOption={onAddOption}
            activeOptions={activeOptions}
            setActiveOption={setActiveOption}
            focusText={focusText}
          />
        </section>,
      );
    } else if (node.kind === "speech" || node.kind === "direction") {
      rendered.push(
        <div className={`evpath-visual-block ${node.kind}`} key={`${node.kind}:${node.anchor ?? node.line}`}>
          <LineTextField
            line={node}
            label={node.kind === "speech" ? node.speaker ? `Diálogo · ${node.speaker}` : "Diálogo" : "Dirección"}
            onCommit={(value) => onEdit(node, value)}
            autoFocus={focusText === node.text}
          />
          {node.children.length ? (
            <Sequence
              nodes={node.children}
              emptyAt={endLine(node.children[node.children.length - 1])}
              emptyIndent={node.indent + 1}
              onInsert={onInsert}
              onEdit={onEdit}
              onAddOption={onAddOption}
              activeOptions={activeOptions}
              setActiveOption={setActiveOption}
              focusText={focusText}
            />
          ) : null}
        </div>,
      );
    }
    rendered.push(<InsertControl key={`after:${node.line}`} rawIndex={endLine(node)} indent={node.indent} onInsert={onInsert} />);
  }
  return <>{rendered}</>;
}

export function EvpathVisualBuilder({ source, onApply }: Props) {
  const parsed = useMemo(() => parseEvpath(source), [source]);
  const roots = useMemo(() => buildTree(parsed.lines), [parsed.lines]);
  const [activeOptions, setActiveOptions] = useState<Record<string, number>>({});
  const [focusText, setFocusText] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const unsupported = parsed.errors.length > 0;
  const firstContentLine = parsed.lines.filter((line) => line.kind === "header" || line.kind === "category" || line.kind === "eventWhen").at(-1)?.line ?? 0;

  const apply = (nextSource: string, nextFocus?: string) => {
    const outcome = onApply(nextSource);
    if (outcome.errors.length) {
      setNotice(outcome.errors[0].message);
      return;
    }
    setNotice(outcome.warnings[0]);
    setFocusText(nextFocus);
  };

  if (unsupported) {
    return (
      <div className="evpath-visual-unsupported" role="status">
        <strong>El EVPATH tiene errores de estructura.</strong>
        <span>Corrígelos en Source antes de continuar con el Visual Builder.</span>
      </div>
    );
  }

  return (
    <div className="evpath-visual-builder">
      <div className="evpath-visual-intro">
        <span>Contenido narrativo</span>
        <small>La rama activa se muestra debajo de cada decisión.</small>
      </div>
      <Sequence
        nodes={roots}
        emptyAt={firstContentLine}
        emptyIndent={0}
        onInsert={(kind, rawIndex, indent) => {
          const next = insertLine(source, rawIndex, indent, kind);
          apply(next.source, next.focusText);
        }}
        onEdit={(line, value) => apply(replaceLine(source, line, value))}
        onAddOption={(decision, options) => {
          const next = insertLine(source, options.length ? endLine(options[options.length - 1]) : decision.line, decision.indent, "option");
          setActiveOptions((current) => ({ ...current, [decision.anchor ?? `line:${decision.line}`]: options.length }));
          apply(next.source, next.focusText);
        }}
        activeOptions={activeOptions}
        setActiveOption={(key, index) => setActiveOptions((current) => ({ ...current, [key]: index }))}
        focusText={focusText}
      />
      {notice ? <p className="evpath-visual-notice">{notice}</p> : null}
    </div>
  );
}
