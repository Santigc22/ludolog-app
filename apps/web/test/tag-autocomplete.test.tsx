import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  AutocompleteInput,
  TagAutocomplete,
} from "../src/components/forms/tag-autocomplete";

const suggestions = ["Mazo de cartas", "Cartas", "Juego de cartas"];

test("ranks prefix matches first and accepts the active suggestion with Tab", () => {
  render(
    <form aria-label="Juego">
      <TagAutocomplete
        name="categories"
        label="Categorías"
        suggestions={suggestions}
      />
    </form>,
  );

  const input = screen.getByLabelText("Categorías");
  fireEvent.change(input, { target: { value: "cart" } });

  const options = screen.getAllByRole("option");
  expect(options.map((option) => option.textContent)).toEqual([
    "CartasTab para elegir",
    "Mazo de cartas",
    "Juego de cartas",
  ]);

  fireEvent.keyDown(input, { key: "Tab" });
  expect(screen.getByText("Cartas")).toBeInTheDocument();
  expect(
    document.querySelector<HTMLInputElement>('input[name="categories"]')?.value,
  ).toBe("Cartas");
});

test("uses arrows to choose another match and still permits a new value", () => {
  render(
    <form aria-label="Juego">
      <TagAutocomplete
        name="categories"
        label="Categorías"
        suggestions={suggestions}
      />
    </form>,
  );

  const input = screen.getByLabelText("Categorías");
  fireEvent.change(input, { target: { value: "cart" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByText("Mazo de cartas")).toBeInTheDocument();

  fireEvent.change(input, { target: { value: "Piratas" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
  expect(screen.getByText("Piratas")).toBeInTheDocument();
  expect(
    document.querySelector<HTMLInputElement>('input[name="categories"]')?.value,
  ).toBe("Mazo de cartas\nPiratas");
});

test("removes selected values and restores initial values on form reset", () => {
  const resetSpy = vi.fn();
  render(
    <form aria-label="Juego" onReset={resetSpy}>
      <TagAutocomplete
        name="mechanics"
        label="Mecánicas"
        suggestions={[]}
        initialValues={["Drafting"]}
      />
      <button type="reset">Restablecer</button>
    </form>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Quitar Drafting" }));
  expect(screen.queryByText("Drafting")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
  expect(screen.getByText("Drafting")).toBeInTheDocument();
  expect(resetSpy).toHaveBeenCalledOnce();
});

test("keeps selected values when Backspace clears or repeats on the draft", () => {
  render(
    <form aria-label="Juego">
      <TagAutocomplete
        name="categories"
        label="Categorías"
        suggestions={suggestions}
        initialValues={["Cartas", "Familiar", "Animales"]}
      />
    </form>,
  );

  const input = screen.getByLabelText("Categorías");
  fireEvent.change(input, { target: { value: "Piratas" } });
  for (const value of ["Pirata", "Pirat", "Pira", "Pir", "Pi", "P", ""]) {
    fireEvent.keyDown(input, { key: "Backspace", repeat: true });
    fireEvent.change(input, { target: { value } });
  }
  fireEvent.keyDown(input, { key: "Backspace", repeat: true });
  fireEvent.keyDown(input, { key: "Backspace", repeat: true });

  expect(screen.getByText("Cartas")).toBeInTheDocument();
  expect(screen.getByText("Familiar")).toBeInTheDocument();
  expect(screen.getByText("Animales")).toBeInTheDocument();
  expect(
    document.querySelector<HTMLInputElement>('input[name="categories"]')?.value,
  ).toBe("Cartas\nFamiliar\nAnimales");

  fireEvent.click(screen.getByRole("button", { name: "Quitar Familiar" }));
  expect(screen.queryByText("Familiar")).not.toBeInTheDocument();
  expect(screen.getByText("Cartas")).toBeInTheDocument();
  expect(screen.getByText("Animales")).toBeInTheDocument();
});

test("completes a single filter with Tab and advances naturally", () => {
  const change = vi.fn();
  const View = ({ value }: { value: string }) => (
    <form>
      <AutocompleteInput
        label="Categoría"
        value={value}
        onChange={change}
        suggestions={suggestions}
      />
      <button>Siguiente campo</button>
    </form>
  );
  const view = render(<View value="cart" />);
  const input = screen.getByLabelText("Categoría");
  fireEvent.focus(input);
  const tabWasNotCancelled = fireEvent.keyDown(input, { key: "Tab" });

  expect(tabWasNotCancelled).toBe(true);
  expect(change).toHaveBeenCalledWith("Cartas");
  view.rerender(<View value="Cartas" />);
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
});
