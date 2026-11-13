import { apiConfig } from "../../config/environment.js";
import { LocalObjectStorage } from "./local-object-storage.js";

export const objectStorage = new LocalObjectStorage(apiConfig.mediaStoragePath);
export type { ObjectStorage } from "./object-storage.js";
