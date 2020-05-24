/**
 * Substantial parts adapted from https://github.com/zserge/lorca/blob/a3e43396a47ea152501d3453514c7f373cea530a/ui.go
 * which is licensed as follows:
 *
 * MIT License
 *
 * Copyright (c) 2018 Serge Zaitsev
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { locateChrome } "./locate.ts";

export interface Application {
  load(url: string | URL): Promise<void>;
  exposeFunction(): Promise<void>;
}

export interface LaunchOptions {
  title?: string;
  width?: number;
  height?: number;
  args?: string[];
  userDataDir?: string;
}

const defaultChromeArgs = [
	"--disable-background-networking",
	"--disable-background-timer-throttling",
	"--disable-backgrounding-occluded-windows",
	"--disable-breakpad",
	"--disable-client-side-phishing-detection",
	"--disable-default-apps",
	"--disable-dev-shm-usage",
	"--disable-infobars",
	"--disable-extensions",
	"--disable-features=site-per-process",
	"--disable-hang-monitor",
	"--disable-ipc-flooding-protection",
	"--disable-popup-blocking",
	"--disable-prompt-on-repost",
	"--disable-renderer-backgrounding",
	"--disable-sync",
	"--disable-translate",
	"--disable-windows10-custom-titlebar",
	"--metrics-recording-only",
	"--no-first-run",
	"--no-default-browser-check",
	"--safebrowsing-disable-auto-update",
	"--enable-automation",
	"--password-store=basic",
	"--use-mock-keychain",
];

export async function launch(options: LaunchOptions = {}) {
  const args = await prepareChromeArgs(options);
  console.log(args);
}

async function prepareChromeArgs(options: LaunchOptions): Promise<string[]> {
  const args = [...defaultChromeArgs];  
  args.push(`--app=${options.title || "Carol"}`);
  if (options.userDataDir == null) {
    const tempDir = await Deno.makeTempDir({ prefix: "carol" });
    args.push(`--user-data-dir=${tempDir}`);
  } else {
    args.push(`--user-data-dir=${options.userDataDir}`);
  }
  if (options.width && options.height) {
    args.push(`--window-size=${options.width},${options.height}`);
  }
  args.push(...(options.args || []));
  args.push("--remote-debugging-port=0");
  return args;
}
