export function assertDevelopmentSeedTarget(
  nodeEnvironment: string,
  databaseUrl: string,
): void {
  const databaseName = decodeURIComponent(
    new URL(databaseUrl).pathname.slice(1),
  );

  if (nodeEnvironment !== "development" || databaseName !== "ludoteca_dev") {
    throw new Error(
      "Development seeds require NODE_ENV=development and DATABASE_URL targeting ludoteca_dev",
    );
  }
}
