"use client";

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type TagAutocompleteProps = Readonly<{
  name: string;
  label: string;
  suggestions: readonly string[];
  initialValues?: readonly string[];
  placeholder?: string;
  help?: string;
}>;

type AutocompleteInputProps = Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
}>;

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function unique(values: readonly string[]) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = value.trim();
    const key = normalized(trimmed);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
}

function draftValues(value: string) {
  return unique(value.split(/[,\n]/));
}

function matchRank(option: string, query: string) {
  const candidate = normalized(option);
  if (candidate.startsWith(query)) return 0;
  if (candidate.split(/\s+/).some((word) => word.startsWith(query))) return 1;
  return 2;
}

function matchingSuggestions(
  suggestions: readonly string[],
  queryValue: string,
  excluded: readonly string[] = [],
) {
  const query = normalized(queryValue);
  if (!query) return [];
  const excludedKeys = new Set(excluded.map(normalized));
  return suggestions
    .filter(
      (option) =>
        normalized(option).includes(query) &&
        !excludedKeys.has(normalized(option)),
    )
    .sort(
      (left, right) =>
        matchRank(left, query) - matchRank(right, query) ||
        normalized(left).indexOf(query) - normalized(right).indexOf(query) ||
        left.localeCompare(right, "es", { sensitivity: "base" }),
    )
    .slice(0, 8);
}

export function TagAutocomplete({
  name,
  label,
  suggestions,
  initialValues = [],
  placeholder,
  help,
}: TagAutocompleteProps) {
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const listboxId = `${inputId}-options`;
  const hiddenInput = useRef<HTMLInputElement>(null);
  const initialSignature = initialValues.join("\u0000");
  const [selected, setSelected] = useState(() => unique(initialValues));
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const form = hiddenInput.current?.form;
    if (!form) return;
    const reset = () => {
      setSelected(unique(initialValues));
      setDraft("");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [initialSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => {
    if (!draft.trim() || draft.includes(",") || draft.includes("\n")) return [];
    return matchingSuggestions(suggestions, draft, selected);
  }, [draft, selected, suggestions]);

  const isOpen = focused && matches.length > 0;
  const submittedValues = unique([...selected, ...draftValues(draft)]);

  function add(values: readonly string[]) {
    setSelected((current) => unique([...current, ...values]));
    setDraft("");
    setActiveIndex(0);
  }

  function choose(option: string) {
    add([option]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && isOpen) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % matches.length);
      return;
    }
    if (event.key === "ArrowUp" && isOpen) {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + matches.length) % matches.length,
      );
      return;
    }
    if ((event.key === "Tab" || event.key === "Enter") && isOpen) {
      event.preventDefault();
      choose(matches[Math.min(activeIndex, matches.length - 1)]!);
      return;
    }
    if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
      event.preventDefault();
      add(draftValues(draft));
      return;
    }
    if (event.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <div className="tag-autocomplete">
      <label htmlFor={inputId}>{label}</label>
      {selected.length > 0 ? (
        <div
          className="tag-autocomplete-values"
          aria-label={`${label} elegidas`}
        >
          {selected.map((value) => (
            <span key={normalized(value)}>
              {value}
              <button
                type="button"
                onClick={() =>
                  setSelected((current) =>
                    current.filter(
                      (item) => normalized(item) !== normalized(value),
                    ),
                  )
                }
                aria-label={`Quitar ${value}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="tag-autocomplete-control">
        <input
          id={inputId}
          value={draft}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen ? `${listboxId}-${activeIndex}` : undefined
          }
          aria-describedby={helpId}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            setDraft(event.target.value);
            setFocused(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          className="tag-autocomplete-add"
          type="button"
          disabled={draftValues(draft).length === 0}
          onClick={() => add(draftValues(draft))}
        >
          Añadir
        </button>
        {isOpen ? (
          <ul
            id={listboxId}
            className="tag-autocomplete-options"
            role="listbox"
          >
            {matches.map((option, index) => (
              <li
                id={`${listboxId}-${index}`}
                key={normalized(option)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span>{option}</span>
                {index === activeIndex ? <small>Tab para elegir</small> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <input
        ref={hiddenInput}
        type="hidden"
        name={name}
        value={submittedValues.join("\n")}
      />
      <small id={helpId} className="tag-autocomplete-help">
        {help ??
          "Escribe para buscar. Usa ↑/↓ y Tab o Enter para elegir; también puedes añadir un término nuevo. Las etiquetas elegidas solo se quitan con ×."}
      </small>
    </div>
  );
}

export function AutocompleteInput({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
}: AutocompleteInputProps) {
  const inputId = useId();
  const listboxId = `${inputId}-options`;
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(
    () => matchingSuggestions(suggestions, value),
    [suggestions, value],
  );
  const isOpen = focused && matches.length > 0;

  function choose(option: string) {
    onChange(option);
    setActiveIndex(0);
    setFocused(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && isOpen) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % matches.length);
      return;
    }
    if (event.key === "ArrowUp" && isOpen) {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + matches.length) % matches.length,
      );
      return;
    }
    if ((event.key === "Tab" || event.key === "Enter") && isOpen) {
      if (event.key === "Enter") event.preventDefault();
      choose(matches[Math.min(activeIndex, matches.length - 1)]!);
      return;
    }
    if (event.key === "Escape") setFocused(false);
  }

  return (
    <div className="autocomplete-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="autocomplete-control">
        <input
          id={inputId}
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            isOpen ? `${listboxId}-${activeIndex}` : undefined
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            onChange(event.target.value);
            setFocused(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        {isOpen ? (
          <ul
            id={listboxId}
            className="tag-autocomplete-options"
            role="listbox"
          >
            {matches.map((option, index) => (
              <li
                id={`${listboxId}-${index}`}
                key={normalized(option)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span>{option}</span>
                {index === activeIndex ? <small>Tab para elegir</small> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
