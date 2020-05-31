export interface Logger {
  log(message: any, ...args: any[]): void;
  error(message: any, ...args: any[]): void;
  debug(message: any, ...args: any[]): void;
}

const noop = () => {};
const NullLogger = {
  log: noop,
  error: noop,
  debug: noop
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