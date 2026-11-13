import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { ObjectStorage } from "./object-storage.js";

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export class LocalObjectStorage implements ObjectStorage {
  readonly #root: string;

  constructor(root: string) {
    this.#root = path.resolve(root);
  }

  #resolve(objectKey: string): string {
    if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(objectKey)) {
      throw new Error("Invalid media object key");
    }
    const resolved = path.resolve(this.#root, objectKey);
    if (!resolved.startsWith(`${this.#root}${path.sep}`)) {
      throw new Error("Media object key escaped the storage root");
    }
    return resolved;
  }

  async put(objectKey: string, contents: Buffer): Promise<void> {
    const destination = this.#resolve(objectKey);
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, contents, { flag: "wx" });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  read(objectKey: string): Promise<Buffer> {
    return readFile(this.#resolve(objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    try {
      await rm(this.#resolve(objectKey));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
}
