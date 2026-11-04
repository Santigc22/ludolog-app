import { describe, expect, test } from "vitest";

import {
  developmentGameEditions,
  developmentGames,
  developmentCollectionMembers,
  developmentCollections,
  developmentUserPassword,
  developmentUsers,
} from "../src/infrastructure/database/seeds/development/data.js";
import { assertDevelopmentSeedTarget } from "../src/infrastructure/database/seeds/development/target.js";

describe("development game seed", () => {
  test("contains only the four explicit development titles with stable IDs", () => {
    expect(developmentGames.map(({ name }) => name)).toEqual([
      "Catan",
      "Flip 7",
      "Azul",
      "Pandemic",
    ]);
    expect(new Set(developmentGames.map(({ id }) => id)).size).toBe(
      developmentGames.length,
    );
    expect(developmentGameEditions).toHaveLength(1);
    expect(
      developmentGames.some(
        ({ id }) => id === developmentGameEditions[0].gameId,
      ),
    ).toBe(true);
  });

  test("defines local identities and collection roles for manual testing", () => {
    expect(developmentUserPassword.length).toBeGreaterThanOrEqual(15);
    expect(developmentUsers.map(({ role }) => role)).toEqual([
      "ADMIN",
      "USER",
      "MODERATOR",
      "CONTENT_MANAGER",
    ]);
    expect(new Set(developmentUsers.map(({ email }) => email)).size).toBe(4);
    expect(developmentCollections).toHaveLength(2);
    expect(developmentCollectionMembers).toHaveLength(8);
    expect(
      developmentCollectionMembers.some(({ role }) => role === "OWNER"),
    ).toBe(true);
    expect(
      developmentCollectionMembers.some(({ role }) => role === "MANAGER"),
    ).toBe(true);
    expect(
      developmentCollectionMembers.some(({ role }) => role === "VIEWER"),
    ).toBe(true);
  });

  test("accepts only the explicit development database target", () => {
    expect(() =>
      assertDevelopmentSeedTarget(
        "development",
        "postgresql://app:secret@localhost:5433/ludoteca_dev",
      ),
    ).not.toThrow();

    expect(() =>
      assertDevelopmentSeedTarget(
        "production",
        "postgresql://app:secret@localhost:5433/ludoteca_dev",
      ),
    ).toThrow(/NODE_ENV=development/);
    expect(() =>
      assertDevelopmentSeedTarget(
        "development",
        "postgresql://app:secret@localhost:5433/ludoteca_test",
      ),
    ).toThrow(/ludoteca_dev/);
  });
});
