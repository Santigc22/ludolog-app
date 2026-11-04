import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveArgon2 = promisify(argon2);
const memoryKiB = 19 * 1024;
const passes = 2;
const parallelism = 1;
const tagLength = 32;

export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const derivedKey = await deriveArgon2("argon2id", {
    message: Buffer.from(password, "utf8"),
    nonce,
    memory: memoryKiB,
    passes,
    parallelism,
    tagLength,
  });

  return [
    "$argon2id$v=19",
    `m=${memoryKiB},t=${passes},p=${parallelism}`,
    nonce.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

type ParsedHash = Readonly<{
  memory: number;
  passes: number;
  parallelism: number;
  nonce: Buffer;
  expected: Buffer;
}>;

function parsePasswordHash(encoded: string): ParsedHash | null {
  const match =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(
      encoded,
    );

  if (match === null) {
    return null;
  }

  return {
    memory: Number(match[1]),
    passes: Number(match[2]),
    parallelism: Number(match[3]),
    nonce: Buffer.from(match[4] ?? "", "base64url"),
    expected: Buffer.from(match[5] ?? "", "base64url"),
  };
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encoded);

  if (parsed === null || parsed.expected.length === 0) {
    return false;
  }

  const actual = await deriveArgon2("argon2id", {
    message: Buffer.from(password, "utf8"),
    nonce: parsed.nonce,
    memory: parsed.memory,
    passes: parsed.passes,
    parallelism: parsed.parallelism,
    tagLength: parsed.expected.length,
  });

  return timingSafeEqual(actual, parsed.expected);
}

let dummyPasswordHash: Promise<string> | undefined;

export function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hashPassword("dummy-password-never-used-for-login");
  return dummyPasswordHash;
}
