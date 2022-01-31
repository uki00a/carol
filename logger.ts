import type { Logger } from "./types.ts";
const noop = () => {};
const NullLogger = {
  log: noop,
  error: noop,
  debug: noop,
} as Logger;

export async function createLogger(env = Deno.env): Promise<Logger> {
  const carolDebugVar = "CAROL_DEBUG";
  const status = await Deno.permissions.query({
    name: "env",
    variable: carolDebugVar,
  });
  if (status.state !== "granted") {
    return NullLogger;
  }

  const debug = env.get(carolDebugVar);
  if (debug === "1" || debug === "true") {
    // TODO improve logging
    return console;
  } else {
    return NullLogger;
  }
}
