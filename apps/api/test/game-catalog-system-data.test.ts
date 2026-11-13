import { describe, expect, test } from "vitest";

import {
  gameCatalogStructuralCodes,
  initialGameScopePolicy,
  lookupSeeds,
  rolePermissionSeeds,
} from "../src/infrastructure/database/seeds/system/data.js";

function codesFor(table: string): string[] {
  return (
    lookupSeeds
      .find((seed) => seed.table === table)
      ?.rows.map(({ code }) => code) ?? []
  );
}

describe("game catalog system data", () => {
  test("defines stable structural codes through system seeds", () => {
    expect(codesFor("game_classifications")).toEqual(
      gameCatalogStructuralCodes.classifications,
    );
    expect(codesFor("moderation_statuses")).toEqual(
      gameCatalogStructuralCodes.moderationStatuses,
    );
    expect(codesFor("visibility_levels")).toEqual(
      expect.arrayContaining([...gameCatalogStructuralCodes.visibilityLevels]),
    );
  });

  test("keeps initial private and public Game scopes unambiguous", () => {
    expect(initialGameScopePolicy.privateGame).toEqual({
      classification: "PRIVATE",
      moderationStatus: "DRAFT",
      visibility: "PRIVATE",
      requiresOwner: true,
    });
    expect(initialGameScopePolicy.publicCatalogGame).toEqual({
      allowedClassifications: ["OFFICIAL", "COMMUNITY"],
      moderationStatus: "APPROVED",
      visibility: "PUBLIC",
      requiresOwner: false,
    });
    expect(initialGameScopePolicy.groupVisibilitySupported).toBe(false);
    expect(gameCatalogStructuralCodes.visibilityLevels).not.toContain("GROUP");
  });

  test("does not mix development games into structural data", () => {
    expect(lookupSeeds.some(({ table }) => table === "games")).toBe(false);
    expect(lookupSeeds.some(({ table }) => table === "game_editions")).toBe(
      false,
    );
  });

  test("reserves public game administration for content managers and admins", () => {
    expect(rolePermissionSeeds.CONTENT_MANAGER).toContain(
      "catalog.game.manage",
    );
    expect(rolePermissionSeeds.ADMIN).toContain("catalog.game.manage");
    expect(rolePermissionSeeds.MODERATOR).not.toContain("catalog.game.manage");
    expect(rolePermissionSeeds.USER).not.toContain("catalog.game.manage");
    expect(rolePermissionSeeds.ADMIN).toContain("catalog.game.publish_direct");
    expect(rolePermissionSeeds.CONTENT_MANAGER).not.toContain(
      "catalog.game.publish_direct",
    );
  });
});
