export interface Logger {
  log(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
  debug(message: unknown, ...args: unknown[]): void;
}

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
