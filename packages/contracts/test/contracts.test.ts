import { expect, test } from "vitest";

import {
  BulkCreatePublicGamesRequestSchema,
  CollectionDetailResponseSchema,
  CollectionIdParamsSchema,
  CollectionListQuerySchema,
  CollectionListResponseSchema,
  CreatePrivateGameRequestSchema,
  CreatePublicGameRequestSchema,
  CreateCopyRequestSchema,
  CopyListQuerySchema,
  CreateCollectionRequestSchema,
  CreateCollectionResponseSchema,
  CurrentSessionResponseSchema,
  ErrorResponseSchema,
  ExitCopyRequestSchema,
  GameListQuerySchema,
  GameListResponseSchema,
  GameTaxonomyOptionsResponseSchema,
  GameDetailResponseSchema,
  GameIdParamsSchema,
  GameModerationListQuerySchema,
  HealthResponseSchema,
  LoginRequestSchema,
  MoveCopyRequestSchema,
  CreateMatchRequestSchema,
  MatchListQuerySchema,
  UpdateMatchRequestSchema,
  PaginationQuerySchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  RejectModerationCaseRequestSchema,
  ResourceIdParamsSchema,
  SubmitGameForModerationRequestSchema,
  UpdateCollectionRequestSchema,
  UpdateCopyRequestSchema,
  UpdateOwnProfileRequestSchema,
  UpdatePublicGameRequestSchema,
} from "../src/index.js";

test("validates game taxonomy options", () => {
  expect(
    GameTaxonomyOptionsResponseSchema.parse({
      mechanics: ["Construcción de mazos"],
      categories: ["Cartas", "Mazo de cartas"],
    }),
  ).toEqual({
    mechanics: ["Construcción de mazos"],
    categories: ["Cartas", "Mazo de cartas"],
  });
});

test("normalizes moderation submissions and requires a useful rejection reason", () => {
  expect(
    SubmitGameForModerationRequestSchema.parse({ note: "  Ready to review  " }),
  ).toEqual({ note: "Ready to review" });
  expect(SubmitGameForModerationRequestSchema.parse({})).toEqual({});
  expect(
    SubmitGameForModerationRequestSchema.safeParse({ visibility: "PUBLIC" })
      .success,
  ).toBe(false);
  expect(
    RejectModerationCaseRequestSchema.parse({
      reason: "  Missing edition information  ",
    }),
  ).toEqual({ reason: "Missing edition information" });
  expect(
    RejectModerationCaseRequestSchema.safeParse({ reason: "no" }).success,
  ).toBe(false);
  expect(GameModerationListQuerySchema.parse({})).toEqual({
    page: 1,
    pageSize: 20,
    status: "PENDING_REVIEW",
  });
  expect(
    GameModerationListQuerySchema.safeParse({ status: "DRAFT" }).success,
  ).toBe(false);
  expect(
    GameModerationListQuerySchema.parse({
      status: "APPROVED",
      approvedByUserId: "f393aa06-8b03-44c8-b75a-8e15f59aa7b6",
    }).approvedByUserId,
  ).toBe("f393aa06-8b03-44c8-b75a-8e15f59aa7b6");
});

test("normalizes public game administration fields", () => {
  expect(
    UpdatePublicGameRequestSchema.parse({
      name: "  Azul  ",
      mechanics: [" Losetas ", "losetas", "Colección de conjuntos"],
      categories: [" Abstracto ", "abstracto", "Familiar"],
    }),
  ).toEqual({
    name: "Azul",
    mechanics: ["Losetas", "Colección de conjuntos"],
    categories: ["Abstracto", "Familiar"],
  });
  expect(UpdatePublicGameRequestSchema.safeParse({}).success).toBe(false);
  expect(
    UpdatePublicGameRequestSchema.safeParse({ minPlayers: 5, maxPlayers: 2 })
      .success,
  ).toBe(false);
});

test("normalizes direct public game creation and defaults to official", () => {
  expect(
    CreatePublicGameRequestSchema.parse({
      name: "  Harmonies  ",
      minPlayers: 1,
      maxPlayers: 4,
      categories: [" Naturaleza "],
    }),
  ).toMatchObject({
    name: "Harmonies",
    classification: "OFFICIAL",
    categories: ["Naturaleza"],
  });
  expect(
    CreatePublicGameRequestSchema.safeParse({
      name: "Privado",
      minPlayers: 1,
      maxPlayers: 1,
      classification: "PRIVATE",
    }).success,
  ).toBe(false);
});

test("validates direct public game batches and rejects repeated names", () => {
  const parsed = BulkCreatePublicGamesRequestSchema.parse({
    games: [
      { name: " Azul ", minPlayers: 2, maxPlayers: 4 },
      {
        name: "Sky Team",
        minPlayers: 2,
        maxPlayers: 2,
        classification: "COMMUNITY",
      },
    ],
  });

  expect(parsed.games).toMatchObject([
    { name: "Azul", classification: "OFFICIAL" },
    { name: "Sky Team", classification: "COMMUNITY" },
  ]);
  expect(
    BulkCreatePublicGamesRequestSchema.safeParse({
      games: [
        { name: "Azul", minPlayers: 2, maxPlayers: 4 },
        { name: " azul ", minPlayers: 2, maxPlayers: 4 },
      ],
    }).success,
  ).toBe(false);
});

test("validates match participants, outcomes and incomplete sessions", () => {
  const userId = "f393aa06-8b03-44c8-b75a-8e15f59aa7b6";
  expect(
    CreateMatchRequestSchema.parse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      startedAt: "2026-11-13T18:30:00.000Z",
      participants: [
        { userId, outcome: "WIN", score: 42 },
        { guestName: " Invitada ", outcome: "LOSS", score: 10 },
      ],
    }),
  ).toMatchObject({
    status: "COMPLETED",
    visibility: "PRIVATE",
    participants: [
      { userId, outcome: "WIN" },
      { guestName: "Invitada", outcome: "LOSS" },
    ],
  });
  expect(
    CreateMatchRequestSchema.safeParse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      startedAt: "2026-11-13T18:30:00.000Z",
      status: "INCOMPLETE",
      participants: [{ guestName: "Invitada", outcome: "WIN" }],
    }).success,
  ).toBe(false);
  expect(
    CreateMatchRequestSchema.safeParse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      startedAt: "2026-11-13T18:30:00.000Z",
      participants: [{ userId }, { userId }],
    }).success,
  ).toBe(false);
  expect(UpdateMatchRequestSchema.safeParse({ participants: [] }).success).toBe(
    false,
  );
});

test("validates ordered match history date boundaries", () => {
  expect(
    MatchListQuerySchema.parse({
      startedFrom: "2026-11-13T05:00:00.000Z",
      startedBefore: "2026-11-14T05:00:00.000Z",
    }),
  ).toMatchObject({
    startedFrom: "2026-11-13T05:00:00.000Z",
    startedBefore: "2026-11-14T05:00:00.000Z",
  });
  expect(
    MatchListQuerySchema.safeParse({
      startedFrom: "2026-11-14T05:00:00.000Z",
      startedBefore: "2026-11-13T05:00:00.000Z",
    }).success,
  ).toBe(false);
});

test("keeps planned matches free of outcomes and scores", () => {
  const base = {
    gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    status: "PLANNED",
    startedAt: "2027-01-10T15:00:00.000Z",
  };
  expect(
    CreateMatchRequestSchema.parse({
      ...base,
      participants: [{ guestName: "Invitada" }],
    }),
  ).toMatchObject({
    status: "PLANNED",
    participants: [{ outcome: "NO_RESULT" }],
  });
  expect(
    CreateMatchRequestSchema.safeParse({
      ...base,
      participants: [{ guestName: "Invitada", score: 12 }],
    }).success,
  ).toBe(false);
  expect(
    CreateMatchRequestSchema.safeParse({
      ...base,
      participants: [{ guestName: "Invitada", outcome: "WIN" }],
    }).success,
  ).toBe(false);
});

test("normalizes copy creation and keeps lifecycle fields server-owned", () => {
  expect(
    CreateCopyRequestSchema.parse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      alias: "  Copy one  ",
      acquisition: {
        type: "PURCHASE",
        priceAmount: 120000,
        currencyCode: "cop",
      },
    }),
  ).toMatchObject({
    condition: "GOOD",
    alias: "Copy one",
    acquisition: { currencyCode: "COP" },
  });
  expect(
    CreateCopyRequestSchema.safeParse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      lifecycle: "EXITED",
    }).success,
  ).toBe(false);
  expect(
    CreateCopyRequestSchema.parse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      proposedEdition: {
        editionName: "  Deluxe  ",
        languageCode: " es ",
        publicationYear: 2024,
      },
    }).proposedEdition,
  ).toEqual({
    editionName: "Deluxe",
    languageCode: "es",
    publicationYear: 2024,
  });
  expect(
    CreateCopyRequestSchema.safeParse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      gameEditionId: "3297a863-b2f0-4746-bfec-e76517342f86",
      proposedEdition: { editionName: "Deluxe" },
    }).success,
  ).toBe(false);
  expect(
    CreateCopyRequestSchema.safeParse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      acquisition: { type: "PURCHASE", priceAmount: 10 },
    }).success,
  ).toBe(false);
});

test("defaults copy listing to active and bounds explicit history filters", () => {
  expect(CopyListQuerySchema.parse({})).toEqual({
    page: 1,
    pageSize: 20,
    lifecycle: "ACTIVE",
  });
  expect(
    CopyListQuerySchema.parse({ lifecycle: "ALL", page: "2", pageSize: "5" }),
  ).toEqual({ page: 2, pageSize: 5, lifecycle: "ALL" });
  expect(CopyListQuerySchema.safeParse({ lifecycle: "REMOVED" }).success).toBe(
    false,
  );
  expect(
    CopyListQuerySchema.parse({
      q: "  Azul  ",
      mechanic: "  tiles  ",
      minPlayers: "4",
      maxPlayers: "6",
    }),
  ).toMatchObject({
    q: "Azul",
    mechanic: "tiles",
    minPlayers: 4,
    maxPlayers: 6,
  });
  expect(
    CopyListQuerySchema.safeParse({ minPlayers: "6", maxPlayers: "4" }).success,
  ).toBe(false);
});

test("accepts editable copy metadata and edition changes", () => {
  expect(
    UpdateCopyRequestSchema.parse({
      alias: "  Table copy  ",
      notes: null,
      condition: "DAMAGED",
    }),
  ).toEqual({ alias: "Table copy", notes: null, condition: "DAMAGED" });
  expect(UpdateCopyRequestSchema.parse({ gameEditionId: null })).toEqual({
    gameEditionId: null,
  });
  expect(
    UpdateCopyRequestSchema.parse({
      proposedEdition: { editionName: "  Deluxe  ", languageCode: " es " },
    }),
  ).toEqual({
    proposedEdition: { editionName: "Deluxe", languageCode: "es" },
  });
  expect(
    UpdateCopyRequestSchema.safeParse({
      gameEditionId: "3297a863-b2f0-4746-bfec-e76517342f86",
      proposedEdition: { editionName: "Deluxe" },
    }).success,
  ).toBe(false);
  expect(UpdateCopyRequestSchema.safeParse({}).success).toBe(false);
  expect(
    UpdateCopyRequestSchema.safeParse({ lifecycle: "EXITED" }).success,
  ).toBe(false);
  expect(
    UpdateCopyRequestSchema.safeParse({ currentCollectionId: null }).success,
  ).toBe(false);
});

test("accepts only an explicit move destination", () => {
  expect(
    MoveCopyRequestSchema.parse({
      destinationCollectionId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    }),
  ).toEqual({
    destinationCollectionId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
  });
  expect(
    MoveCopyRequestSchema.safeParse({ destinationCollectionId: "invalid" })
      .success,
  ).toBe(false);
  expect(
    MoveCopyRequestSchema.safeParse({
      destinationCollectionId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
      lifecycle: "ACTIVE",
    }).success,
  ).toBe(false);
});

test("accepts only a stable copy exit reason", () => {
  expect(ExitCopyRequestSchema.parse({ reason: "DAMAGED" })).toEqual({
    reason: "DAMAGED",
  });
  expect(ExitCopyRequestSchema.safeParse({ reason: "BROKEN" }).success).toBe(
    false,
  );
  expect(
    ExitCopyRequestSchema.safeParse({
      reason: "SOLD",
      exitedAt: "2026-09-22T12:00:00.000Z",
    }).success,
  ).toBe(false);
});

test("normalizes private game creation and rejects unsafe or inverted fields", () => {
  expect(
    CreatePrivateGameRequestSchema.parse({
      name: "  Prototype  ",
      description: "  A private game  ",
      minPlayers: 1,
      maxPlayers: 4,
    }),
  ).toMatchObject({
    name: "Prototype",
    description: "A private game",
    minPlayers: 1,
    maxPlayers: 4,
  });
  expect(
    CreatePrivateGameRequestSchema.safeParse({
      name: "Invalid range",
      minPlayers: 4,
      maxPlayers: 2,
    }).success,
  ).toBe(false);
  expect(
    CreatePrivateGameRequestSchema.safeParse({
      name: "Invalid duration",
      minPlayers: 1,
      maxPlayers: 2,
      minDurationMinutes: 60,
      maxDurationMinutes: 30,
    }).success,
  ).toBe(false);
  expect(
    CreatePrivateGameRequestSchema.safeParse({
      name: "Invalid age",
      minPlayers: 1,
      maxPlayers: 2,
      minAge: 14,
      maxAge: 8,
    }).success,
  ).toBe(false);
  expect(
    CreatePrivateGameRequestSchema.safeParse({
      name: "Open optional ranges",
      minPlayers: 1,
      maxPlayers: 2,
      minDurationMinutes: 15,
      maxAge: 99,
    }).success,
  ).toBe(true);
  expect(
    CreatePrivateGameRequestSchema.safeParse({
      name: "Cannot publish",
      minPlayers: 1,
      maxPlayers: 2,
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
    }).success,
  ).toBe(false);
});

test("normalizes game list queries and validates visible summaries", () => {
  expect(GameListQuerySchema.parse({})).toEqual({
    page: 1,
    pageSize: 20,
    sort: "name",
  });
  expect(
    GameListQuerySchema.parse({
      q: "  catan  ",
      mechanic: "  trading  ",
      minPlayers: "3",
      maxPlayers: "5",
      page: "2",
      pageSize: "10",
      sort: "publicationYear",
    }),
  ).toEqual({
    q: "catan",
    mechanic: "trading",
    minPlayers: 3,
    maxPlayers: 5,
    page: 2,
    pageSize: 10,
    sort: "publicationYear",
  });
  expect(GameListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  expect(GameListQuerySchema.safeParse({ sort: "popularity" }).success).toBe(
    false,
  );
  expect(
    GameListQuerySchema.safeParse({ minPlayers: "8", maxPlayers: "4" }).success,
  ).toBe(false);
  expect(
    GameListResponseSchema.safeParse({
      games: [
        {
          id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
          name: "Catan",
          description: null,
          publicationYear: 1995,
          minPlayers: 3,
          maxPlayers: 4,
          mechanics: ["Trading"],
          categories: ["Económico"],
          coverMediaId: null,
          minDurationMinutes: 60,
          maxDurationMinutes: 120,
          minAge: 10,
          maxAge: null,
          complexity: 2.3,
          classification: "OFFICIAL",
          visibility: "PUBLIC",
          moderationStatus: "APPROVED",
          isOwnedByViewer: false,
          createdAt: "2026-09-21T20:00:00.000Z",
          updatedAt: "2026-09-21T20:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    }).success,
  ).toBe(true);
});

test("validates game detail parameters and editions", () => {
  expect(
    GameIdParamsSchema.safeParse({
      gameId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    }).success,
  ).toBe(true);
  expect(GameIdParamsSchema.safeParse({ gameId: "invalid" }).success).toBe(
    false,
  );
  expect(
    GameDetailResponseSchema.safeParse({
      game: {
        id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
        name: "Catan",
        description: null,
        publicationYear: 1995,
        minPlayers: 3,
        maxPlayers: 4,
        mechanics: ["Trading"],
        categories: ["Económico"],
        coverMediaId: null,
        minDurationMinutes: 60,
        maxDurationMinutes: 120,
        minAge: 10,
        maxAge: null,
        complexity: 2.3,
        classification: "OFFICIAL",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
        isOwnedByViewer: false,
        canManageCatalog: false,
        createdAt: "2026-09-21T20:00:00.000Z",
        updatedAt: "2026-09-21T20:00:00.000Z",
        editions: [
          {
            id: "3297a863-b2f0-4746-bfec-e76517342f86",
            editionName: "Spanish edition",
            editionNumber: null,
            languageCode: "es",
            publicationYear: null,
            isbn: null,
            sku: null,
            upc: null,
            notes: null,
            moderationStatus: "APPROVED",
            isOwnedByViewer: false,
            createdAt: "2026-09-21T20:00:00.000Z",
          },
        ],
      },
    }).success,
  ).toBe(true);
});

test("validates collection detail parameters and public capabilities", () => {
  expect(
    CollectionIdParamsSchema.safeParse({
      collectionId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    }).success,
  ).toBe(true);
  expect(
    CollectionIdParamsSchema.safeParse({ collectionId: "invalid" }).success,
  ).toBe(false);

  expect(
    CollectionDetailResponseSchema.safeParse({
      collection: {
        id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
        type: "PERSONAL",
        status: "ACTIVE",
        name: "Public games",
        description: null,
        visibility: "PUBLIC",
        isForSale: false,
        gameCount: 3,
        createdByUserId: "3297a863-b2f0-4746-bfec-e76517342f86",
        effectiveRole: null,
        canEdit: false,
        createdAt: "2026-09-21T20:00:00.000Z",
        updatedAt: "2026-09-21T20:00:00.000Z",
        archivedAt: null,
      },
    }).success,
  ).toBe(true);
});

test("normalizes collection list pagination and archived filter", () => {
  expect(CollectionListQuerySchema.parse({})).toEqual({
    page: 1,
    pageSize: 20,
    includeArchived: false,
  });
  expect(
    CollectionListQuerySchema.parse({
      page: "2",
      pageSize: "10",
      includeArchived: "true",
    }),
  ).toEqual({ page: 2, pageSize: 10, includeArchived: true });
  expect(
    CollectionListQuerySchema.safeParse({ includeArchived: "yes" }).success,
  ).toBe(false);
});

test("accepts a paginated collection list response", () => {
  expect(
    CollectionListResponseSchema.safeParse({
      collections: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      },
    }).success,
  ).toBe(true);
});

test("normalizes collection creation and rejects server-owned fields", () => {
  expect(
    CreateCollectionRequestSchema.parse({
      name: "  My games  ",
      description: "  Main shelf  ",
    }),
  ).toEqual({
    name: "My games",
    description: "Main shelf",
    visibility: "PRIVATE",
  });

  expect(
    CreateCollectionRequestSchema.safeParse({
      name: "For sale",
      isForSale: true,
    }).success,
  ).toBe(false);
});

test("accepts the public collection creation response", () => {
  expect(
    CreateCollectionResponseSchema.safeParse({
      collection: {
        id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
        type: "PERSONAL",
        status: "ACTIVE",
        name: "My games",
        description: null,
        visibility: "PRIVATE",
        isForSale: false,
        gameCount: 0,
        createdByUserId: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
        effectiveRole: "OWNER",
        createdAt: "2026-09-21T20:00:00.000Z",
        updatedAt: "2026-09-21T20:00:00.000Z",
        archivedAt: null,
      },
    }).success,
  ).toBe(true);
});

test("accepts the neutral health response contract", () => {
  const result = HealthResponseSchema.safeParse({
    status: "ok",
    service: "api",
  });

  expect(result.success).toBe(true);
});

test("accepts only editable profile fields", () => {
  expect(
    UpdateOwnProfileRequestSchema.parse({
      displayName: " Player ",
      visibility: "PUBLIC",
    }),
  ).toEqual({ displayName: "Player", visibility: "PUBLIC" });

  expect(
    UpdateOwnProfileRequestSchema.safeParse({ role: "ADMIN" }).success,
  ).toBe(false);
  expect(UpdateOwnProfileRequestSchema.safeParse({}).success).toBe(false);
});

test("accepts only editable collection metadata", () => {
  expect(
    UpdateCollectionRequestSchema.parse({
      name: "  Updated shelf  ",
      description: null,
      visibility: "PUBLIC",
    }),
  ).toEqual({
    name: "Updated shelf",
    description: null,
    visibility: "PUBLIC",
  });
  expect(UpdateCollectionRequestSchema.safeParse({}).success).toBe(false);
  expect(
    UpdateCollectionRequestSchema.safeParse({ status: "ARCHIVED" }).success,
  ).toBe(false);
  expect(
    UpdateCollectionRequestSchema.safeParse({ isForSale: true }).success,
  ).toBe(false);
});

test("normalizes a valid registration request", () => {
  expect(
    RegisterRequestSchema.parse({
      email: "Player@Example.com",
      username: "Player_One",
      password: "a long passphrase",
      displayName: "Player One",
    }),
  ).toEqual({
    email: "player@example.com",
    username: "player_one",
    password: "a long passphrase",
    displayName: "Player One",
  });
});

test("rejects weak registration credentials", () => {
  expect(
    RegisterRequestSchema.safeParse({
      email: "not-an-email",
      username: "invalid username",
      password: "too-short",
    }).success,
  ).toBe(false);
});

test("normalizes login email and validates profile URL branches", () => {
  expect(
    LoginRequestSchema.parse({
      email: "Player@Example.com",
      password: "password",
    }),
  ).toEqual({ email: "player@example.com", password: "password" });

  expect(
    UpdateOwnProfileRequestSchema.safeParse({
      avatarUrl: "https://example.com/avatar.png",
    }).success,
  ).toBe(true);
  expect(
    UpdateOwnProfileRequestSchema.safeParse({ avatarUrl: "ftp://example.com" })
      .success,
  ).toBe(false);
});

test("accepts the public registration response without credentials", () => {
  expect(
    RegisterResponseSchema.safeParse({
      user: {
        id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
        email: "player@example.com",
        username: "player_one",
        status: "ACTIVE",
        profile: { displayName: "Player One", visibility: "PRIVATE" },
      },
      csrfToken: "a-secure-csrf-token-with-enough-entropy",
    }).success,
  ).toBe(true);
});

test("accepts session roles used for role-aware navigation", () => {
  expect(
    CurrentSessionResponseSchema.safeParse({
      user: {
        id: "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
        email: "moderator@example.com",
        username: "moderator",
        status: "ACTIVE",
        roles: ["MODERATOR"],
        profile: { displayName: "Moderator", visibility: "PRIVATE" },
      },
    }).success,
  ).toBe(true);
});

test("rejects an invalid health response", () => {
  const result = HealthResponseSchema.safeParse({
    status: "down",
    service: "",
  });

  expect(result.success).toBe(false);
});

test("coerces pagination query values and applies defaults", () => {
  expect(PaginationQuerySchema.parse({ page: "2" })).toEqual({
    page: 2,
    pageSize: 20,
  });
});

test("rejects invalid resource parameters", () => {
  const result = ResourceIdParamsSchema.safeParse({ resourceId: "not-a-uuid" });

  expect(result.success).toBe(false);
});

test("accepts the public error envelope", () => {
  const result = ErrorResponseSchema.safeParse({
    error: {
      code: "VALIDATION_ERROR",
      message: "The request is invalid.",
      details: null,
      requestId: "request-123",
    },
  });

  expect(result.success).toBe(true);
});
