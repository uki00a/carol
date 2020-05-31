import { Chrome } from "./chrome.ts";

export interface Application {
  load(url: string): Promise<void>;
  evaluate(expression: string): Promise<any>;
  exit(): Promise<void>;
  exposeFunction(name: string, binding: (...args: any[]) => any): Promise<void>;
  serveFolder(folder: string, prefix?: string): void;
  serveOrigin(base: string, prefix?: string): void;
  onExit(): Promise<void>;
}

export function createApplication(chrome: Chrome): Application {
  return {
    load(url: string): Promise<void> {
      return chrome.load(url);
    },
    evaluate(expression: string): Promise<any> {
      return chrome.evaluate(expression);
    },
    async exit() {
      await chrome.exit();
    },
    exposeFunction(name: string, binding: (...args: any[]) => any) {
      return chrome.bind(name, (args) => binding(...args));
    },
    serveFolder(folder: string, prefix?: string) {
      return chrome.serveFolder(folder, prefix);
    },
    serveOrigin(base: string, prefix?: string) {
      return chrome.serveOrigin(base, prefix);
    },
    onExit() {
      return chrome.onExit();
    },
  };
}
