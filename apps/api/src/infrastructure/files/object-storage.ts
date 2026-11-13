export interface ObjectStorage {
  put(objectKey: string, contents: Buffer): Promise<void>;
  read(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}
