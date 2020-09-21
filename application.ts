import type { Chrome } from "./chrome.ts";

export interface Application {
  load(url: string): Promise<void>;
  // deno-lint-ignore no-explicit-any
  evaluate(expression: string): Promise<any>;
  exit(): Promise<void>;
  exposeFunction(
    name: string,
    // deno-lint-ignore no-explicit-any
    binding: (...args: any[]) => any,
  ): Promise<void>;
  serveFolder(folder: string, prefix?: string): void;
  serveOrigin(base: string, prefix?: string): void;
  onExit(): Promise<void>;
}

export function createApplication(chrome: Chrome): Application {
  return {
    load(url) {
      return chrome.load(url);
    },
    evaluate(expression) {
      return chrome.evaluate(expression);
    },
    async exit() {
      await chrome.exit();
    },
    exposeFunction(name, binding) {
      return chrome.bind(name, (args) => binding(...args));
    },
    serveFolder(folder, prefix) {
      return chrome.serveFolder(folder, prefix);
    },
    serveOrigin(base, prefix) {
      return chrome.serveOrigin(base, prefix);
    },
    onExit() {
      return chrome.onExit();
    },
  };
}
