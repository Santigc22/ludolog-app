import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ProfileWorkspace } from "../src/components/profile/profile-workspace";
import { ApiRequestError } from "../src/lib/api/client";

const getCurrentSession = vi.fn();
const logout = vi.fn();
const getOwnProfile = vi.fn();
const updateOwnProfile = vi.fn();
const uploadOwnAvatar = vi.fn();

vi.mock("../src/lib/api/auth", () => ({
  getCurrentSession: (...arguments_: unknown[]) =>
    getCurrentSession(...arguments_),
  logout: (...arguments_: unknown[]) => logout(...arguments_),
}));

vi.mock("../src/lib/api/profile", () => ({
  getOwnProfile: (...arguments_: unknown[]) => getOwnProfile(...arguments_),
  updateOwnProfile: (...arguments_: unknown[]) =>
    updateOwnProfile(...arguments_),
}));

vi.mock("../src/lib/api/media", () => ({
  imageFileError: () => null,
  mediaUrl: (mediaId: string) => `http://localhost/media/${mediaId}`,
  uploadOwnAvatar: (...arguments_: unknown[]) => uploadOwnAvatar(...arguments_),
}));

const profile = {
  userId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
  username: "player_one",
  displayName: "Player One",
  bio: null,
  avatarUrl: null,
  avatarMediaId: null,
  locationText: null,
  visibility: "PRIVATE" as const,
  createdAt: "2026-09-21T20:00:00.000Z",
  updatedAt: "2026-09-21T20:00:00.000Z",
};

describe("ProfileWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSession.mockResolvedValue({
      user: { email: "player@example.com" },
    });
    getOwnProfile.mockResolvedValue({ profile });
  });

  test("loads and updates the authenticated profile", async () => {
    updateOwnProfile.mockResolvedValue({
      profile: { ...profile, bio: "Eurogames y cooperativos" },
    });
    render(<ProfileWorkspace />);

    expect(await screen.findByText("@player_one")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Biografía"), {
      target: { value: "Eurogames y cooperativos" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Guardar perfil" }).closest("form")!,
    );

    await waitFor(() => {
      expect(updateOwnProfile).toHaveBeenCalledWith(
        expect.objectContaining({ bio: "Eurogames y cooperativos" }),
      );
    });
    expect(
      await screen.findByText("Tu perfil quedó actualizado."),
    ).toBeInTheDocument();
  });

  test("uploads an avatar and shows the managed image", async () => {
    const avatarMediaId = "3297a863-b2f0-4746-bfec-e76517342f86";
    uploadOwnAvatar.mockResolvedValue({
      profile: { ...profile, avatarMediaId },
    });
    render(<ProfileWorkspace />);
    await screen.findByText("@player_one");
    const file = new File(["image"], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Foto de perfil"), {
      target: { files: [file] },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Subir avatar" }).closest("form")!,
    );

    await waitFor(() => expect(uploadOwnAvatar).toHaveBeenCalledWith(file));
    expect(await screen.findByAltText("Avatar de Player One")).toHaveAttribute(
      "src",
      expect.stringContaining(avatarMediaId),
    );
  });

  test("reacts to an expired private session", async () => {
    getCurrentSession.mockRejectedValue(
      new ApiRequestError(401, "SESSION_EXPIRED", "Expired"),
    );
    render(<ProfileWorkspace />);

    expect(
      await screen.findByText("Tu mesa está guardada"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al acceso" })).toHaveAttribute(
      "href",
      "/acceso",
    );
  });

  test("shows the recoverable API error state", async () => {
    getOwnProfile.mockRejectedValue(new Error("offline"));
    render(<ProfileWorkspace />);

    expect(
      await screen.findByText("No pudimos cargar tu perfil"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  test("logs out safely", async () => {
    logout.mockResolvedValue({});
    render(<ProfileWorkspace />);
    await screen.findByText("@player_one");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(
      await screen.findByText("Cerraste sesión de forma segura."),
    ).toBeInTheDocument();
    expect(logout).toHaveBeenCalledOnce();
  });

  test("handles an expired session while saving", async () => {
    updateOwnProfile.mockRejectedValue(
      new ApiRequestError(401, "SESSION_EXPIRED"),
    );
    render(<ProfileWorkspace />);
    await screen.findByText("@player_one");

    fireEvent.submit(
      screen.getByRole("button", { name: "Guardar perfil" }).closest("form")!,
    );

    expect(
      await screen.findByText("Tu sesión venció. Inicia sesión nuevamente."),
    ).toBeInTheDocument();
  });

  test("reports ordinary save and logout failures", async () => {
    updateOwnProfile.mockRejectedValue(new Error("invalid"));
    logout.mockRejectedValue(new Error("offline"));
    render(<ProfileWorkspace />);
    await screen.findByText("@player_one");

    fireEvent.submit(
      screen.getByRole("button", { name: "Guardar perfil" }).closest("form")!,
    );
    expect(
      await screen.findByText(/No pudimos guardar los cambios/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(
      await screen.findByText(/No pudimos cerrar la sesión/),
    ).toBeInTheDocument();
  });

  test("treats a 401 during logout as an already closed session", async () => {
    logout.mockRejectedValue(new ApiRequestError(401, "SESSION_EXPIRED"));
    render(<ProfileWorkspace />);
    await screen.findByText("@player_one");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(
      await screen.findByText("Tu mesa está guardada"),
    ).toBeInTheDocument();
  });
});
