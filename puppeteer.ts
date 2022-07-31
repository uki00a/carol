/**
 * This file contains parts adopted from https://github.com/puppeteer/puppeteer/blob/v5.5.0/src/node/Launcher.ts
 * which is licensed as follows:
 *
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  BrowserWebSocketTransport,
  BufReader,
  decode,
  puppeteer,
  resolve,
} from "./deps.ts";
import type { Browser, Target } from "./deps.ts";
import type { AppOptions } from "./types.ts";
import { getLocalDataDir } from "./util.ts";

class ExtendedBrowserWebSocketTransport extends BrowserWebSocketTransport {
  #ws: WebSocket;

  constructor(ws: WebSocket) {
    super(ws);
    this.#ws = ws;
  }

  async close(): Promise<void> {
    if (this.#ws.readyState === this.#ws.OPEN) {
      await super.close();
    }
  }
}

interface LaunchResult {
  browser: Browser;
  chromeProcess: Deno.Process;
}

export async function launch(
  executablePath: string,
  headless: boolean,
  options: AppOptions,
): Promise<LaunchResult> {
  const chromeArgs = prepareChromeArgs(executablePath, headless, options);
  const chromeProcess = Deno.run({
    cmd: chromeArgs,
    stderr: "piped",
  });
  const wsEndpoint = await waitForWSEndpoint(chromeProcess.stderr);
  const transport = await ExtendedBrowserWebSocketTransport.create(wsEndpoint);
  const browser = await puppeteer.connect({
    ignoreHTTPSErrors: true,
    transport,
  });
  await browser.waitForTarget((t: Target) => t.type() === "page");
  return {
    browser,
    chromeProcess,
  };
}

function prepareChromeArgs(
  executablePath: string,
  headless: boolean,
  options: AppOptions,
): string[] {
  const chromeArguments = [
    executablePath,
    // Default arguments
    "--disable-background-networking",
    "--enable-features=NetworkService,NetworkServiceInProcess",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-client-side-phishing-detection",
    "--disable-component-extensions-with-background-pages",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-features=TranslateUI",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--force-color-profile=srgb",
    "--metrics-recording-only",
    "--no-first-run",
    "--enable-automation",
    "--password-store=basic",
    "--use-mock-keychain",
    "--enable-blink-features=IdleDetection",
  ];
  const {
    args = [],
    userDataDir = null,
  } = options;

  if (userDataDir) {
    chromeArguments.push(`--user-data-dir=${resolve(userDataDir)}`);
  } else {
    const localDataDir = options.localDataDir || getLocalDataDir();
    chromeArguments.push(`--user-data-dir=${localDataDir}`);
  }
  if (headless) {
    chromeArguments.push("--headless", "--hide-scrollbars", "--mute-audio");
  }
  if (args.every((arg) => arg.startsWith("-"))) {
    chromeArguments.push("about:blank");
  }
  chromeArguments.push(...args);
  chromeArguments.push("--remote-debugging-port=0");

  return chromeArguments;
}

async function waitForWSEndpoint(r: Deno.Reader): Promise<string> {
  const b = BufReader.create(r);
  // TODO Handle timeout
  while (true) {
    const result = await b.readLine();
    if (result === null) {
      throw new Error("EOF");
    }
    const line = decode(result.line);
    const match = line.match(/^DevTools listening on (ws:\/\/.*?)\r?$/);
    if (match) {
      return match[1];
    }
  }
}
