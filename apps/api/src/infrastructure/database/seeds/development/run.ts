import { apiConfig } from "../../../../config/environment.js";
import { closeDatabase } from "../../client.js";
import {
  developmentCollections,
  developmentGameEditions,
  developmentGames,
  developmentModerationCases,
  developmentUsers,
} from "./data.js";
import { seedDevelopmentCatalog } from "./seed.js";
import { assertDevelopmentSeedTarget } from "./target.js";

assertDevelopmentSeedTarget(apiConfig.nodeEnv, apiConfig.databaseUrl);

try {
  await seedDevelopmentCatalog();
  console.log(
    `Development seed applied: ${developmentUsers.length} users, ${developmentCollections.length} collections, ${developmentGames.length} games, ${developmentGameEditions.length} edition and ${developmentModerationCases.length} moderation cases`,
  );
} finally {
  await closeDatabase();
}
