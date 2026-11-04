import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AccessPanel } from "../src/components/auth/access-panel";
import { ApiRequestError } from "../src/lib/api/client";

const push = vi.fn();
const refresh = vi.fn();
const login = vi.fn();
const registerAccount = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("../src/lib/api/auth", () => ({
  login: (...arguments_: unknown[]) => login(...arguments_),
  registerAccount: (...arguments_: unknown[]) => registerAccount(...arguments_),
}));

describe("AccessPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("logs in and navigates to the private profile", async () => {
    login.mockResolvedValue({});
    render(<AccessPanel />);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "a sufficiently long password" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Entrar a mi ludoteca" })
        .closest("form")!,
    );

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: "player@example.com",
        password: "a sufficiently long password",
      });
      expect(push).toHaveBeenCalledWith("/perfil");
    });
  });

  test("shows a safe authentication error", async () => {
    login.mockRejectedValue(
      new ApiRequestError(401, "AUTHENTICATION_FAILED", "Internal message"),
    );
    render(<AccessPanel />);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "wrong" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Entrar a mi ludoteca" })
        .closest("form")!,
    );

    expect(
      await screen.findByText("El correo o la contraseña no son correctos."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Internal message")).not.toBeInTheDocument();
  });

  test("switches to the registration contract", () => {
    render(<AccessPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByLabelText("Nombre visible")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de usuario")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Crear mi cuenta" }),
    ).toBeInTheDocument();
  });

  test("registers an account and clears a previous message when changing mode", async () => {
    login.mockRejectedValue(new Error("network"));
    registerAccount.mockResolvedValue({});
    render(<AccessPanel />);

    fireEvent.submit(
      screen
        .getByRole("button", { name: "Entrar a mi ludoteca" })
        .closest("form")!,
    );
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText("Nombre visible"), {
      target: { value: "Player One" },
    });
    fireEvent.change(screen.getByLabelText("Nombre de usuario"), {
      target: { value: "player_one" },
    });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "a sufficiently long password" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear mi cuenta" }).closest("form")!,
    );

    await waitFor(() => {
      expect(registerAccount).toHaveBeenCalledWith({
        displayName: "Player One",
        username: "player_one",
        email: "player@example.com",
        password: "a sufficiently long password",
      });
      expect(refresh).toHaveBeenCalled();
    });
  });

  test.each([
    [
      "IDENTITY_ALREADY_EXISTS",
      "Ese correo o nombre de usuario ya está registrado.",
    ],
    [
      "TOO_MANY_LOGIN_ATTEMPTS",
      "Hubo demasiados intentos. Espera unos minutos antes de volver a probar.",
    ],
    [
      "UNEXPECTED",
      "No pudimos completar la solicitud. Revisa los datos e inténtalo de nuevo.",
    ],
  ])("maps %s to a safe public message", async (code, expected) => {
    login.mockRejectedValue(new ApiRequestError(400, code));
    render(<AccessPanel />);

    fireEvent.submit(
      screen
        .getByRole("button", { name: "Entrar a mi ludoteca" })
        .closest("form")!,
    );

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
