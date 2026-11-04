import { describe, expect, test } from "vitest";

import {
  copyInventoryStructuralCodes,
  lookupSeeds,
} from "../src/infrastructure/database/seeds/system/data.js";

function codesFor(table: string): string[] {
  return (
    lookupSeeds
      .find((seed) => seed.table === table)
      ?.rows.map(({ code }) => code) ?? []
  );
}

describe("copy inventory system data", () => {
  test("defines the stable lifecycle and condition codes", () => {
    expect(codesFor("copy_lifecycle_statuses")).toEqual(
      copyInventoryStructuralCodes.lifecycleStatuses,
    );
    expect(codesFor("copy_condition_statuses")).toEqual(
      copyInventoryStructuralCodes.conditionStatuses,
    );
    expect(copyInventoryStructuralCodes.lifecycleStatuses).toEqual([
      "ACTIVE",
      "EXITED",
    ]);
    expect(copyInventoryStructuralCodes.conditionStatuses).toContain("DAMAGED");
  });

  test("defines exit reasons separately from acquisition types", () => {
    expect(codesFor("copy_exit_reasons")).toEqual(
      copyInventoryStructuralCodes.exitReasons,
    );
    expect(codesFor("acquisition_types")).toEqual(
      copyInventoryStructuralCodes.acquisitionTypes,
    );
    expect(copyInventoryStructuralCodes.exitReasons).toContain("DAMAGED");
    expect(copyInventoryStructuralCodes.acquisitionTypes).not.toContain(
      "DAMAGED",
    );
  });
});
