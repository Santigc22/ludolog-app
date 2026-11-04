import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ApiStatus } from "../src/components/ui/api-status";

describe("ApiStatus", () => {
  test("announces the connected API service", () => {
    render(<ApiStatus available service="ludoteca-api" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "API disponible: ludoteca-api",
    );
  });

  test("announces when the API is unavailable", () => {
    render(<ApiStatus available={false} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "La API no está disponible en este momento.",
    );
  });
});
