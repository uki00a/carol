import { dirname, fromFileUrl, join } from "./deps.ts";

export function getLocalDataDir(): string {
  const __dirname = import.meta.url.startsWith("file://")
    ? dirname(fromFileUrl(import.meta.url))
    : Deno.makeTempDirSync({ prefix: "carol" });
  const localDataDir = join(__dirname, ".local-data");
  return localDataDir;
}
