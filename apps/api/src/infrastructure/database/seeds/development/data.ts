export const developmentGames = [
  {
    id: "e3030001-0000-4000-8000-000000000001",
    name: "Catan",
    publicationYear: 1995,
    minPlayers: 3,
    maxPlayers: 4,
    minDurationMinutes: 60,
    maxDurationMinutes: 120,
    minAge: 10,
    complexity: "2.30",
    mechanics: ["Gestión de recursos", "Construcción de redes", "Negociación"],
    categories: ["Civilización", "Económico"],
  },
  {
    id: "e3030001-0000-4000-8000-000000000002",
    name: "Flip 7",
    publicationYear: 2024,
    minPlayers: 3,
    maxPlayers: 18,
    minDurationMinutes: 20,
    maxDurationMinutes: 30,
    minAge: 8,
    complexity: "1.10",
    mechanics: ["Presiona tu suerte", "Colección de conjuntos"],
    categories: ["Cartas", "Familiar"],
  },
  {
    id: "e3030001-0000-4000-8000-000000000003",
    name: "Azul",
    publicationYear: 2017,
    minPlayers: 2,
    maxPlayers: 4,
    minDurationMinutes: 30,
    maxDurationMinutes: 45,
    minAge: 8,
    complexity: "1.80",
    mechanics: ["Colocación de losetas", "Colección de conjuntos"],
    categories: ["Abstracto", "Familiar"],
  },
  {
    id: "e3030001-0000-4000-8000-000000000004",
    name: "Pandemic",
    publicationYear: 2008,
    minPlayers: 2,
    maxPlayers: 4,
    minDurationMinutes: 45,
    maxDurationMinutes: 60,
    minAge: 8,
    complexity: "2.40",
    mechanics: ["Puntos de acción", "Gestión de mano"],
    categories: ["Cooperativo", "Medicina"],
  },
] as const;

export const developmentGameEditions = [
  {
    id: "e3030002-0000-4000-8000-000000000001",
    gameId: developmentGames[0].id,
    editionName: "Edición de referencia en español",
    languageCode: "es",
  },
] as const;

export const developmentUserPassword = "LudotecaDev2026!";

export const developmentUsers = [
  {
    id: "e3030010-0000-4000-8000-000000000001",
    email: "admin@ludoteca.local",
    username: "admin_dev",
    displayName: "Administración local",
    role: "ADMIN",
  },
  {
    id: "e3030010-0000-4000-8000-000000000002",
    email: "usuario@ludoteca.local",
    username: "usuario_dev",
    displayName: "Usuario local",
    role: "USER",
  },
  {
    id: "e3030010-0000-4000-8000-000000000003",
    email: "moderador@ludoteca.local",
    username: "moderador_dev",
    displayName: "Moderación local",
    role: "MODERATOR",
  },
  {
    id: "e3030010-0000-4000-8000-000000000004",
    email: "contenido@ludoteca.local",
    username: "contenido_dev",
    displayName: "Contenido local",
    role: "CONTENT_MANAGER",
  },
] as const;

export const developmentModerationCases = developmentGames.map(
  (game, index) => ({
    id: `e3030012-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    gameId: game.id,
    submittedByUserId: developmentUsers[3].id,
    approvedByUserId: developmentUsers[2].id,
    submissionActionId: `e3030013-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    approvalActionId: `e3030014-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    submittedAt: new Date(`2026-09-01T12:0${index}:00.000Z`),
    approvedAt: new Date(`2026-09-01T13:0${index}:00.000Z`),
  }),
);

export const developmentCollections = [
  {
    id: "e3030011-0000-4000-8000-000000000001",
    name: "Ludoteca compartida principal",
    createdByUserId: developmentUsers[0].id,
  },
  {
    id: "e3030011-0000-4000-8000-000000000002",
    name: "Ludoteca compartida secundaria",
    createdByUserId: developmentUsers[1].id,
  },
] as const;

export const developmentCollectionMembers = [
  {
    collectionId: developmentCollections[0].id,
    userId: developmentUsers[0].id,
    role: "OWNER",
  },
  {
    collectionId: developmentCollections[0].id,
    userId: developmentUsers[1].id,
    role: "MANAGER",
  },
  {
    collectionId: developmentCollections[0].id,
    userId: developmentUsers[2].id,
    role: "VIEWER",
  },
  {
    collectionId: developmentCollections[0].id,
    userId: developmentUsers[3].id,
    role: "MEMBER",
  },
  {
    collectionId: developmentCollections[1].id,
    userId: developmentUsers[1].id,
    role: "OWNER",
  },
  {
    collectionId: developmentCollections[1].id,
    userId: developmentUsers[0].id,
    role: "MANAGER",
  },
  {
    collectionId: developmentCollections[1].id,
    userId: developmentUsers[2].id,
    role: "VIEWER",
  },
  {
    collectionId: developmentCollections[1].id,
    userId: developmentUsers[3].id,
    role: "MEMBER",
  },
] as const;
