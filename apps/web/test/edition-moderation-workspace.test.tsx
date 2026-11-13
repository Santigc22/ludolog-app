import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { EditionModerationWorkspace } from "../src/components/moderation/edition-moderation-workspace";

const listEditionModerationCases = vi.fn();
const approveEditionModerationCase = vi.fn();
const rejectEditionModerationCase = vi.fn();

vi.mock("../src/lib/api/moderation", () => ({
  listEditionModerationCases: (...arguments_: unknown[]) =>
    listEditionModerationCases(...arguments_),
  approveEditionModerationCase: (...arguments_: unknown[]) =>
    approveEditionModerationCase(...arguments_),
  rejectEditionModerationCase: (...arguments_: unknown[]) =>
    rejectEditionModerationCase(...arguments_),
}));

const moderationCase = {
  id: "8b60b9a1-6950-45c9-abbd-832fa8cfb143",
  status: "PENDING_REVIEW" as const,
  submissionNote: "Nueva edición propuesta al registrar una copia: Deluxe",
  resolutionNote: null,
  submittedBy: {
    id: "d6d90729-17c0-42fe-b0dd-b8b49df2e478",
    username: "collector",
    displayName: "Coleccionista",
  },
  assignedToUserId: null,
  resolvedBy: null,
  game: {
    id: "61f8a42b-fc4f-4ce9-983c-1f505413db2f",
    name: "Feed the Kraken",
  },
  edition: {
    id: "c97be014-5157-4d60-830d-8b3644a35332",
    editionName: "Deluxe",
    editionNumber: "Kickstarter",
    languageCode: "es",
    publicationYear: 2024,
    isbn: null,
    sku: null,
    upc: null,
    notes: "Componentes mejorados",
    moderationStatus: "PENDING_REVIEW" as const,
    isOwnedByViewer: false,
    createdAt: "2026-11-12T20:00:00.000Z",
  },
  createdAt: "2026-11-12T20:00:00.000Z",
  updatedAt: "2026-11-12T20:00:00.000Z",
  closedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  listEditionModerationCases.mockResolvedValue({
    moderationCases: [moderationCase],
    reviewers: [],
    pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
  });
  approveEditionModerationCase.mockResolvedValue({
    moderationCase: {
      ...moderationCase,
      status: "APPROVED",
      edition: { ...moderationCase.edition, moderationStatus: "APPROVED" },
    },
  });
});

test("lists and approves an edition proposal", async () => {
  render(<EditionModerationWorkspace />);

  expect(await screen.findByText("Deluxe")).toBeInTheDocument();
  expect(screen.getByText(/Feed the Kraken/)).toBeInTheDocument();
  expect(screen.getByText("Idioma es")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Aprobar edición" }));

  await waitFor(() =>
    expect(approveEditionModerationCase).toHaveBeenCalledWith(
      moderationCase.id,
    ),
  );
  expect(window.confirm).toHaveBeenCalledWith(
    "¿Aprobar la edición “Deluxe” de Feed the Kraken?",
  );
});

test("rejects an edition with a reason", async () => {
  rejectEditionModerationCase.mockResolvedValue({
    moderationCase: { ...moderationCase, status: "REJECTED" },
  });
  render(<EditionModerationWorkspace />);

  const reason = await screen.findByLabelText("Motivo del rechazo");
  fireEvent.change(reason, {
    target: { value: "La información está incompleta" },
  });
  fireEvent.submit(reason.closest("form")!);

  await waitFor(() =>
    expect(rejectEditionModerationCase).toHaveBeenCalledWith(
      moderationCase.id,
      { reason: "La información está incompleta" },
    ),
  );
});
