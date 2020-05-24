import { Chrome } from "./chrome.ts";

export interface Application {
  load(url: string): Promise<void>;
  evaluate(expression: string): Promise<any>;
  exit(): Promise<void>;
  exposeFunction(name: string, binding: (...args: any[]) => any): Promise<void>;
}

export function createApplication(chrome: Chrome): Application {
  return {
    load(url: string): Promise<void> {
      return chrome.load(url);
    },
    evaluate(expression: string): Promise<any> {
      return chrome.evaluate(expression);
    },
    exit() {
      return chrome.exit();
    },
    exposeFunction(name: string, binding: (...args: any[]) => any) {
      return chrome.bind(name, (args) => binding(...args));
    },
  };
}
