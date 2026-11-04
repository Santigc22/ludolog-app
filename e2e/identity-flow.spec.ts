import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

async function registerFromUi(
  page: import("@playwright/test").Page,
  suffix: string,
) {
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre visible").fill("Coleccionista E2E");
  await page.getByLabel("Nombre de usuario").fill(`collector_${suffix}`);
  await page
    .getByLabel("Correo electrónico")
    .fill(`collector-${suffix}@example.com`);
  await page.getByLabel("Contraseña").fill("a sufficiently long e2e password");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
}

async function createCollectionFromUi(
  page: import("@playwright/test").Page,
  name: string,
) {
  const emptyAction = page.getByRole("button", {
    name: "Crear mi primera ludoteca",
  });
  if (await emptyAction.isVisible().catch(() => false)) {
    await emptyAction.click();
  } else {
    await page.getByRole("button", { name: "Nueva ludoteca" }).click();
  }
  const form = page.locator("form").filter({ hasText: "Crea una ludoteca" });
  await form.getByLabel("Nombre").fill(name);
  await form.getByRole("button", { name: "Crear ludoteca" }).click();
  await expect(page.getByText("Tu ludoteca quedó creada.")).toBeVisible();
  const href = await page
    .getByRole("link", { name: new RegExp(name) })
    .getAttribute("href");
  if (href === null)
    throw new Error(`Collection link was not rendered for ${name}`);
  return href;
}

test("registers, manages a profile and a personal collection, then logs out", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);

  await page.goto("/acceso");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre visible").fill("Jugador E2E");
  await page.getByLabel("Nombre de usuario").fill(`player_${suffix}`);
  await page
    .getByLabel("Correo electrónico")
    .fill(`player-${suffix}@example.com`);
  await page.getByLabel("Contraseña").fill("a sufficiently long e2e password");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();

  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByText(`@player_${suffix}`)).toBeVisible();

  await page.getByLabel("Biografía").fill("Eurogames y juegos cooperativos");
  await page.getByLabel("Ubicación").fill("Bogotá");
  await page.getByLabel("Visibilidad").selectOption("PUBLIC");
  await page.getByRole("button", { name: "Guardar perfil" }).click();

  await expect(page.getByText("Tu perfil quedó actualizado.")).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText("Pública"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Mis ludotecas" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu primera estantería empieza aquí" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear mi primera ludoteca" }).click();
  await page.getByLabel("Nombre").fill("Colección E2E");
  await page.getByLabel("Descripción").fill("Juegos para tardes de domingo");
  await page.getByLabel("Visibilidad").selectOption("PUBLIC");
  await page.getByRole("button", { name: "Crear ludoteca" }).click();

  await expect(page.getByText("Tu ludoteca quedó creada.")).toBeVisible();
  await page.getByRole("link", { name: /Colección E2E/ }).click();
  await expect(
    page.getByRole("heading", { name: "Colección E2E" }),
  ).toBeVisible();

  const collectionEditor = page
    .locator("form")
    .filter({ hasText: "Edita tu ludoteca" });
  await collectionEditor.getByLabel("Nombre").fill("Colección principal E2E");
  await collectionEditor
    .getByRole("button", { name: "Guardar cambios" })
    .click();
  await expect(page.getByText("Los cambios quedaron guardados.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archivar" }).click();
  await expect(
    page.getByText("La ludoteca quedó archivada sin eliminar su historial."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Esta ludoteca está archivada" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Catálogo" }).click();
  await expect(
    page.getByRole("heading", { name: "Explora juegos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear juego privado" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(`Prototipo ${suffix}`);
  await page.getByLabel("Jugadores mínimos").fill("2");
  await page.getByLabel("Jugadores máximos").fill("4");
  await page
    .getByRole("button", { name: "Crear juego privado" })
    .last()
    .click();
  await expect(
    page.getByText("Tu juego privado quedó creado y solo tú puedes verlo."),
  ).toBeVisible();
  await page.getByRole("link", { name: /Abrir juego/ }).click();
  await expect(page.getByText("Juego privado · Tuyo")).toBeVisible();
  await page.getByRole("button", { name: /Sin edición específica/ }).click();
  await expect(page.getByText(/Necesitas una ludoteca activa/)).toBeVisible();

  await page.getByRole("link", { name: "Mi perfil" }).click();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu mesa está guardada" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al acceso" })).toBeVisible();
});

test("registers, moves and exits the same physical copy with preserved history", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const sourceName = `Origen ${suffix}`;
  const destinationName = `Destino ${suffix}`;
  const gameName = `Juego de copias ${suffix}`;
  const copyAlias = `Copia trazable ${suffix}`;

  await registerFromUi(page, suffix);
  await page.getByRole("link", { name: "Mis ludotecas" }).click();
  const sourceHref = await createCollectionFromUi(page, sourceName);
  const destinationHref = await createCollectionFromUi(page, destinationName);

  await page.getByRole("link", { name: "Catálogo" }).click();
  await page.getByRole("button", { name: "Crear juego privado" }).click();
  const gameForm = page
    .locator("form")
    .filter({ hasText: "Nuevo juego privado" });
  await gameForm.getByLabel("Nombre", { exact: true }).fill(gameName);
  await gameForm.getByLabel("Jugadores mínimos").fill("1");
  await gameForm.getByLabel("Jugadores máximos").fill("4");
  await gameForm.getByRole("button", { name: "Crear juego privado" }).click();
  await expect(
    page.getByText("Tu juego privado quedó creado y solo tú puedes verlo."),
  ).toBeVisible();

  await page.goto(sourceHref);
  await expect(page.getByRole("heading", { name: sourceName })).toBeVisible();
  await page.getByRole("button", { name: "Registrar copia" }).click();
  const copyForm = page.locator("form").filter({ hasText: "Nueva copia" });
  await copyForm.getByLabel("Juego visible").selectOption({ label: gameName });
  await expect(
    copyForm.getByLabel("Edición del juego seleccionado"),
  ).toBeEnabled();
  await copyForm.getByLabel("Condición").selectOption("DAMAGED");
  await copyForm.getByLabel("Alias").fill(copyAlias);

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/collections\/[^/]+\/copies$/.test(new URL(response.url()).pathname),
  );
  await copyForm.getByRole("button", { name: "Registrar copia" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  const created = (await createResponse.json()) as {
    copy: { id: string; lifecycle: string; condition: string };
  };
  expect(created.copy.lifecycle).toBe("ACTIVE");
  expect(created.copy.condition).toBe("DAMAGED");

  const detail = page.getByLabel("Detalle de la copia");
  await expect(detail).toContainText("Dañada");
  await expect(
    detail.getByText("Marcarla como dañada no la retira automáticamente."),
  ).toBeVisible();

  await detail.getByLabel("Destino").focus();
  await expect(
    detail.getByRole("option", { name: destinationName }),
  ).toHaveCount(1);
  await detail.getByLabel("Destino").selectOption({ label: destinationName });
  page.once("dialog", (dialog) => dialog.accept());
  const moveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/copies/${created.copy.id}/move`),
  );
  await detail.getByRole("button", { name: "Mover copia" }).click();
  const moveResponse = await moveResponsePromise;
  expect(moveResponse.status()).toBe(200);
  const moved = (await moveResponse.json()) as {
    copy: {
      id: string;
      lifecycle: string;
      collectionHistory: Array<{ endedAt: string | null }>;
    };
  };
  expect(moved.copy.id).toBe(created.copy.id);
  expect(moved.copy.lifecycle).toBe("ACTIVE");
  expect(moved.copy.collectionHistory).toHaveLength(2);
  expect(
    moved.copy.collectionHistory.filter(({ endedAt }) => endedAt === null),
  ).toHaveLength(1);

  await page.goto(destinationHref);
  await page.getByRole("button", { name: new RegExp(copyAlias) }).click();
  const movedDetail = page.getByLabel("Detalle de la copia");
  await expect(movedDetail).toContainText("2 tramo(s)");
  await expect(
    movedDetail.getByText(/conservará historial y adquisiciones/),
  ).toBeVisible();
  await movedDetail.getByLabel("Causa").selectOption("DAMAGED");
  page.once("dialog", (dialog) => dialog.accept());
  const exitResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/copies/${created.copy.id}/exit`),
  );
  await movedDetail.getByRole("button", { name: "Retirar copia" }).click();
  const exitResponse = await exitResponsePromise;
  expect(exitResponse.status()).toBe(200);
  const exited = (await exitResponse.json()) as {
    copy: {
      id: string;
      lifecycle: string;
      currentCollectionId: string | null;
      exitReason: string | null;
      collectionHistory: Array<{ endedAt: string | null }>;
    };
  };
  expect(exited.copy).toMatchObject({
    id: created.copy.id,
    lifecycle: "EXITED",
    currentCollectionId: null,
    exitReason: "DAMAGED",
  });
  expect(
    exited.copy.collectionHistory.every(({ endedAt }) => endedAt !== null),
  ).toBe(true);
  await expect(movedDetail).toContainText("Retirada");
  await expect(movedDetail).toContainText("DAMAGED");
});
