import { app } from "./app.js";
import { apiConfig } from "./config/environment.js";
import { closeDatabase } from "./infrastructure/database/index.js";

const server = app.listen(apiConfig.port, () => {
  console.log(`Ludoteca API listening on port ${apiConfig.port}`);
});

let isShuttingDown = false;

function shutdown(): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  server.close(async (error) => {
    if (error) {
      console.error("Failed to close the HTTP server", error);
      process.exitCode = 1;
    }

    try {
      await closeDatabase();
    } catch (databaseError) {
      console.error("Failed to close the database pool", databaseError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
