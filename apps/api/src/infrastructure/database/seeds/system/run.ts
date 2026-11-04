import { closeDatabase } from "../../client.js";
import { seedSystemData } from "./seed.js";

try {
  await seedSystemData();
  console.log("System seeds applied successfully");
} finally {
  await closeDatabase();
}
