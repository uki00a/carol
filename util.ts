import { dirname, fromFileUrl, join } from "./deps.ts";

export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new Error("assertion failed: " + msg);
  }
}

export function getLocalDataDir(): string {
  const __dirname = import.meta.url.startsWith("file://")
    ? dirname(fromFileUrl(import.meta.url))
    : Deno.makeTempDirSync({ prefix: "carol" });
  const localDataDir = join(__dirname, ".local-data");
  return localDataDir;
}

export function tryClose(closer: Deno.Closer): void {
  try {
    closer.close();
  } catch (error) {
    if (!(error instanceof Deno.errors.BadResource)) {
      throw error;
    }
  }
}
