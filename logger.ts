import type { Logger } from "./types.ts";
const noop = () => {};
const NullLogger = {
  log: noop,
  error: noop,
  debug: noop,
} as Logger;

export function createLogger(env = Deno.env): Logger {
  const debug = env.get("CAROL_DEBUG");
  if (debug === "1" || debug === "true") {
    // TODO improve logging
    return console;
  } else {
    return NullLogger;
  }
}
