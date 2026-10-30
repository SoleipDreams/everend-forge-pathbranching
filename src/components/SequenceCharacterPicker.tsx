import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type SequenceCharacterOption = { id: string; label: string };

export function SequenceCharacterPicker({
  options,
  value,
  locale,
  onChange,
  onCreateLocalCharacter,
}: {
  options: SequenceCharacterOption[];
  value: string[];
  locale: "en" | "es";
  onChange: (refs: string[]) => void;
  onCreateLocalCharacter: (name: string) => void;
}) {
  const es = locale === "es";
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = value.map((ref) => options.find((option) => option.id === ref) ?? { id: ref, label: ref });
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = normalizedQuery
    ? options.filter((option) =>
        !value.includes(option.id) &&
        option.label.toLocaleLowerCase().includes(normalizedQuery),
      )
    : [];
  const exactMatch = normalizedQuery
    ? options.find((option) => option.label.trim().toLocaleLowerCase() === normalizedQuery)
    : undefined;
  const canCreateCharacter = Boolean(normalizedQuery && !exactMatch);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      addButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const addCharacter = (characterId: string) => {
    onChange([...value, characterId]);
    setQuery("");
    searchRef.current?.focus();
  };

  return (
    <div className="sequence-character-picker" ref={rootRef}>
      <div className="sequence-character-selection">
        <ul className="sequence-character-tags" aria-label={es ? "Personajes principales seleccionados" : "Selected main characters"}>
          {selected.map((option) => (
            <li key={option.id}>
              <span>{option.label}</span>
              <button
                type="button"
                aria-label={es ? `Quitar ${option.label}` : `Remove ${option.label}`}
                title={es ? `Quitar ${option.label}` : `Remove ${option.label}`}
                onClick={() => onChange(value.filter((ref) => ref !== option.id))}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="sequence-character-add"
          aria-label={es ? "Añadir personaje principal" : "Add main character"}
          title={es ? "Añadir personaje" : "Add character"}
          aria-expanded={open}
          aria-controls={`${id}-menu`}
          aria-haspopup="dialog"
          ref={addButtonRef}
          onClick={() => {
            setQuery("");
            setOpen((current) => !current);
          }}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div id={`${id}-menu`} className="sequence-character-menu" role="dialog" aria-label={es ? "Añadir personaje principal" : "Add main character"}>
          <input
            ref={searchRef}
            type="search"
            aria-label={es ? "Buscar personajes principales" : "Search main characters"}
            aria-controls={`${id}-results`}
            placeholder={es ? "Buscar personaje…" : "Search characters…"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {matches.length > 0 ? (
            <ul id={`${id}-results`} className="sequence-character-results" aria-label={es ? "Resultados" : "Results"}>
              {matches.map((option) => (
                <li key={option.id}>
                  <button type="button" onClick={() => addCharacter(option.id)}>
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : normalizedQuery && exactMatch && value.includes(exactMatch.id) ? (
            <span className="sequence-character-empty">{es ? "Ya está añadido como personaje principal." : "Already added as a main character."}</span>
          ) : normalizedQuery ? (
            <span className="sequence-character-empty">{es ? "No se encontraron personajes." : "No characters found."}</span>
          ) : options.length === 0 ? (
            <span className="sequence-character-empty">{es ? "No hay personajes disponibles." : "No characters available."}</span>
          ) : (
            <span className="sequence-character-empty">{es ? "Escribe para buscar." : "Type to search."}</span>
          )}
          {canCreateCharacter ? (
            <button
              type="button"
              className="sequence-character-create"
              onClick={() => {
                onCreateLocalCharacter(query.trim());
                setQuery("");
              }}
            >
              {es
                ? `Crear «${query.trim()}» como personaje local`
                : `Create “${query.trim()}” as a local character`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
