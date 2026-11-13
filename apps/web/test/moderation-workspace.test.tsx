import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ModerationWorkspace } from "../src/components/moderation/moderation-workspace";
import { ApiRequestError } from "../src/lib/api/client";

const listGameModerationCases = vi.fn();
const approveGameModerationCase = vi.fn();
const rejectGameModerationCase = vi.fn();
const uploadGameCover = vi.fn();

vi.mock("../src/lib/api/moderation", () => ({
  listGameModerationCases: (...arguments_: unknown[]) =>
    listGameModerationCases(...arguments_),
  approveGameModerationCase: (...arguments_: unknown[]) =>
    approveGameModerationCase(...arguments_),
  rejectGameModerationCase: (...arguments_: unknown[]) =>
    rejectGameModerationCase(...arguments_),
}));

vi.mock("../src/lib/api/media", () => ({
  imageFileError: () => null,
  mediaUrl: (mediaId: string) => `http://localhost/media/${mediaId}`,
  uploadGameCover: (...arguments_: unknown[]) => uploadGameCover(...arguments_),
}));

const moderationCase = {
  id: "bb4a02ac-bf9d-4e90-ae16-f3b79f92f50a",
  status: "PENDING_REVIEW" as const,
  submissionNote: "La ficha ya fue verificada.",
  resolutionNote: null,
  submittedBy: {
    id: "2723328b-6f03-4772-8470-4fda87cbe886",
    username: "sky_owner",
    displayName: "Sky Owner",
  },
  assignedToUserId: null,
  resolvedBy: null,
  game: {
    id: "7f23ee38-31b5-45ec-ab1c-c1906bb1e456",
    name: "Sky Team",
    description: "Aterrizaje cooperativo para dos personas.",
    publicationYear: 2023,
    minPlayers: 2,
    maxPlayers: 2,
    mechanics: ["Cooperativo", "Dados"],
    categories: ["Cooperativo", "Aviación"],
    coverMediaId: null,
    minDurationMinutes: 20,
    maxDurationMinutes: 20,
    minAge: 12,
    maxAge: null,
    complexity: 2.1,
    classification: "PRIVATE" as const,
    visibility: "PRIVATE" as const,
    moderationStatus: "PENDING_REVIEW" as const,
    isOwnedByViewer: false,
    createdAt: "2026-11-04T12:00:00.000Z",
    updatedAt: "2026-11-04T12:00:00.000Z",
  },
  createdAt: "2026-11-04T12:00:00.000Z",
  updatedAt: "2026-11-04T12:00:00.000Z",
  closedAt: null,
};

function queueResponse(cases = [moderationCase]) {
  return {
    moderationCases: cases,
    reviewers: [
      {
        id: "f393aa06-8b03-44c8-b75a-8e15f59aa7b6",
        username: "moderador_dev",
        displayName: "Moderación local",
      },
    ],
    pagination: {
      page: 1,
      pageSize: 12,
      totalItems: cases.length,
      totalPages: cases.length === 0 ? 0 : 1,
    },
  };
}

describe("ModerationWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listGameModerationCases.mockResolvedValue(queueResponse());
    approveGameModerationCase.mockResolvedValue({});
    rejectGameModerationCase.mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  test("loads the queue and approves a private proposal as global", async () => {
    render(<ModerationWorkspace />);
    expect(await screen.findByText("Sky Team")).toBeInTheDocument();
    expect(screen.getByText("La ficha ya fue verificada.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Aprobar como global" }),
    );

    await waitFor(() =>
      expect(approveGameModerationCase).toHaveBeenCalledWith(moderationCase.id),
    );
    expect(
      await screen.findByText(/ya forma parte del catálogo global/),
    ).toBeInTheDocument();
  });

  test("requires a reason and rejects a proposal", async () => {
    render(<ModerationWorkspace />);
    await screen.findByText("Sky Team");
    fireEvent.change(screen.getByLabelText("Motivo del rechazo"), {
      target: { value: "La información de la edición está incompleta." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));

    await waitFor(() =>
      expect(rejectGameModerationCase).toHaveBeenCalledWith(moderationCase.id, {
        reason: "La información de la edición está incompleta.",
      }),
    );
  });

  test("filters approved games by the user who approved them", async () => {
    render(<ModerationWorkspace />);
    await screen.findByText("Sky Team");
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "APPROVED" },
    });
    const reviewerFilter = await screen.findByLabelText("Aprobado por");
    fireEvent.change(reviewerFilter, {
      target: { value: "f393aa06-8b03-44c8-b75a-8e15f59aa7b6" },
    });

    await waitFor(() =>
      expect(listGameModerationCases).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "APPROVED",
          approvedByUserId: "f393aa06-8b03-44c8-b75a-8e15f59aa7b6",
        }),
      ),
    );
  });

  test("lets a moderator add the candidate cover before approval", async () => {
    const coverMediaId = "3297a863-b2f0-4746-bfec-e76517342f86";
    uploadGameCover.mockResolvedValue({ coverMediaId });
    render(<ModerationWorkspace />);
    await screen.findByText("Sky Team");
    const file = new File(["image"], "sky-team.webp", {
      type: "image/webp",
    });
    fireEvent.change(screen.getByLabelText("Portada para el catálogo"), {
      target: { files: [file] },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Añadir portada" }).closest("form")!,
    );

    await waitFor(() =>
      expect(uploadGameCover).toHaveBeenCalledWith(
        moderationCase.game.id,
        file,
      ),
    );
    expect(
      await screen.findByAltText("Portada de Sky Team"),
    ).toBeInTheDocument();
  });

  test("explains that the queue is restricted to moderation roles", async () => {
    listGameModerationCases.mockRejectedValueOnce(
      new ApiRequestError(403, "PERMISSION_DENIED"),
    );
    render(<ModerationWorkspace />);

    expect(
      await screen.findByText("Este espacio es para moderación"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al acceso" })).toHaveAttribute(
      "href",
      "/acceso",
    );
  });
});
