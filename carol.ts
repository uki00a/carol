/**
 * Adopted from https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/carlo.js
 * which is licensed as follows:
 * 
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  assert,
  decode,
  decodeFromBase64,
  deferred,
  dirname,
  encodeToBase64,
  EventEmitter,
  exists,
  fromFileUrl,
  join,
} from "./deps.ts";
import type { Browser, CDPSession, Page, Target } from "./deps.ts";
import { launch as launchPuppeteer } from "./puppeteer.ts";
import { createLogger } from "./logger.ts";
import type * as types from "./types.ts";
import { locateChrome } from "./locate.ts";
import { HttpRequest } from "./http_request.ts";
import type { HttpRequestParams } from "./http_request.ts";
import { Color } from "./color.ts";
import { rpc } from "./rpc/mod.ts";
import { BASE64_ENCODED_RPC_CLIENT_SOURCE } from "./rpc.client.ts";
import type { HandleProxy } from "./rpc/mod.ts";
import { features } from "./features/mod.js";
import type * as Messages from "./rpc/messages.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

let testMode = false;

/**
 * Thrown when `Application.evaluate`/`Window.evaluate` fails.
 */
export class EvaluateError extends Error {}

interface PendingWindow {
  callback(window: Window): void;
  options: types.AppOptions;
}

type WWW = Array<{
  baseURL?: URL;
  folder?: string;
  prefix: string;
}>;

type Self = typeof self;
type RPC = typeof rpc;

interface ExtendedSelf extends Self {
  rpc: RPC;
  carol: Carol;
  receivedFromParent(message: Messages.Any): void;
}

interface Carol {
  loadParams(): Promise<unknown>;
}

class Application extends EventEmitter implements types.Application {
  /**
   * @private
   */
  session_!: CDPSession;
  private exited_ = false;
  private windowSeq_ = 0;

  /**
   * @private
   */
  // deno-lint-ignore ban-types
  exposedFunctions_: Array<{ name: string; func: Function }> = [];

  /**
   * @private
   */
  readonly www_: WWW = [];

  /**
   * @private
   */
  httpHandler_: types.HttpHandler | null = null;
  private readonly pendingWindows_ = new Map<string, PendingWindow>();
  private readonly windows_ = new Map<Page, Window>();
  private readonly done_ = deferred<void>();

  constructor(
    private readonly browser: Browser,
    private readonly chromeProcess: Deno.Process,
    private readonly logger_: types.Logger,
    /** @private */
    readonly options_: types.AppOptions,
  ) {
    super();
  }

  /**
   * @private
   */
  async init_(): Promise<void> {
    this.logger_.debug("[app] Configuring browser");
    this.browser.target().createCDPSession();
    let page!: Page;
    await Promise.all([
      this.browser.target().createCDPSession().then((session: CDPSession) => {
        this.session_ = session;
        if (this.options_.icon) {
          this.setIcon(this.options_.icon);
        }
      }),
      this.browser.defaultBrowserContext()
        .overridePermissions("https://domain", [
          "geolocation",
          "midi",
          "notifications",
          "camera",
          "microphone",
          "clipboard-read",
          "clipboard-write",
        ]),
      this.browser.pages().then((pages: Page[]) => page = pages[0]),
    ]);

    this.browser.on("targetcreated", this.targetCreated_.bind(this));

    // Simulate the pageCreated sequence.
    let callback!: () => void;
    const result = new Promise<void>((f) => callback = f);
    this.pendingWindows_.set("", { options: this.options_, callback });
    this.pageCreated_(page);
    return result;
  }

  async exit(): Promise<void> {
    this.logger_.debug("[app] app.exit...");
    if (this.exited_) {
      return;
    }
    this.exited_ = true;
    if (this.chromeProcess.stdout) {
      this.chromeProcess.stdout.close();
    }
    if (this.chromeProcess.stderr) {
      this.chromeProcess.stderr.close();
    }
    this.chromeProcess.close();
    await this.browser.close();
    this.done_.resolve();
    this.emit(Application.Events.Exit, null);
  }

  onExit(): Promise<void> {
    return this.done_;
  }

  mainWindow(): Window {
    for (const window of this.windows_.values()) {
      return window;
    }
    throw new Error("main window not found.");
  }

  createWindow(
    options_: Partial<types.AppOptions> = {},
  ): Promise<Window> {
    const options = Object.assign(
      {},
      this.options_,
      options_,
    ) as types.AppOptions;
    const seq = String(++this.windowSeq_);
    if (!this.windows_.size) {
      throw new Error("Needs at least one window to create more.");
    }

    const params = [] as string[];
    for (const prop of ["top", "left", "width", "height"] as const) {
      const value = options[prop];
      if (typeof value === "number") {
        params.push(`${prop}=${value}`);
      }
    }

    for (const page of this.windows_.keys()) {
      page.evaluate(
        `window.open('about:blank?seq=${seq}', '', '${params.join(",")}')`,
      );
      break;
    }

    return new Promise((callback) => {
      this.pendingWindows_.set(seq, { options, callback });
    });
  }

  windows(): Window[] {
    return Array.from(this.windows_.values());
  }

  // deno-lint-ignore ban-types
  exposeFunction(name: string, func: Function): Promise<unknown[]> {
    this.exposedFunctions_.push({ name, func });
    return Promise.all(
      this.windows().map((window) => window.exposeFunction(name, func)),
    );
  }

  // deno-lint-ignore no-explicit-any, ban-types
  evaluate(pageFunction: Function | string, ...args: unknown[]): Promise<any> {
    return this.mainWindow().evaluate(pageFunction, ...args);
  }

  serveFolder(folder = "", prefix = ""): void {
    this.www_.push({ folder, prefix: wrapPrefix(prefix) });
  }

  serveOrigin(base: string, prefix = "") {
    this.www_.push(
      { baseURL: new URL(base + "/"), prefix: wrapPrefix(prefix) },
    );
  }

  serveHandler(handler: types.HttpHandler): void {
    this.httpHandler_ = handler;
  }

  load(uri = "", ...params: unknown[]): Promise<unknown> {
    return this.mainWindow()!.load(uri, ...params);
  }

  async setIcon(icon: string | Uint8Array): Promise<void> {
    const buffer = typeof icon === "string" ? await Deno.readFile(icon) : icon;
    this.session_.send("Browser.setDockTile", { image: encodeToBase64(buffer) })
      .catch((e) => {
        this.logger_.error("[app] ", e);
      });
  }

  /**
   * Puppeteer browser object for test.
   */
  browserForTest(): Browser {
    return this.browser;
  }

  private async targetCreated_(target: Target): Promise<void> {
    const page = await target.page();
    if (!page) {
      return;
    }
    this.pageCreated_(page);
  }

  private async pageCreated_(page: Page) {
    const url = page.url();
    this.logger_.debug("[app] Page created at", url);
    const seq = url.startsWith("about:blank?seq=")
      ? url.substr("about:blank?seq=".length)
      : "";
    const params = this.pendingWindows_.get(seq);
    const { callback, options } = params || { options: this.options_ };
    this.pendingWindows_.delete(seq);
    const window = new Window(this, page, this.logger_, options);
    await window.init_();
    this.windows_.set(page, window);
    if (callback) {
      callback(window);
    }
    this.emit(Application.Events.Window, window);
  }

  /**
   * @private
   */
  windowClosed_(window: Window): void {
    this.logger_.debug("[app] window closed", window.loadURI_);
    this.windows_.delete(window.page_);
    if (!this.windows_.size) {
      this.exit();
    }
  }

  static Events = {
    Exit: "exit",
    Window: "window",
  };
}

class Window extends EventEmitter implements types.Window {
  private readonly options_: types.AppOptions;
  private readonly www_: WWW = [];
  private _lastWebWorldId?: string;

  /**
   * @private
   */
  session_!: CDPSession;
  private paramsForReuse_: unknown;
  private httpHandler_: types.HttpHandler | null = null;

  /**
   * @private
   */
  loadURI_!: string;

  private loadParams_!: unknown[];
  private domContentLoadedCallback_?: () => void;
  private windowId_: unknown;
  private interceptionInitialized_ = false;
  private hostHandle_: HandleProxy;
  private receivedFromChild_!: (message: Messages.Any) => void;

  constructor(
    /**
     * @private
     */
    readonly app_: Application,
    /**
     * @private
     */
    readonly page_: Page,
    private readonly logger_: types.Logger,
    options: types.AppOptions,
  ) {
    super();
    this.options_ = Object.assign({}, app_.options_, options);
    this.www_ = [];
    this.page_.on("close", this.closed_.bind(this));
    this.page_.on("domcontentloaded", this.domContentLoaded_.bind(this));
    this.hostHandle_ = rpc.handle(new HostWindow(this));
  }

  /**
   * @private
   */
  async init_(): Promise<void> {
    this.logger_.debug("[app] Configuring window");
    const targetId = this.page_.target()._targetInfo.targetId;
    assert(this.options_.bgcolor);
    const bgcolor = Color.parse(this.options_.bgcolor);
    assert(bgcolor, "Invalid bgcolor");
    const bgcolorRGBA = bgcolor.canonicalRGBA();
    this.session_ = await this.page_.target().createCDPSession();

    await Promise.all([
      this.session_.send(
        "Runtime.evaluate",
        { expression: "self.paramsForReuse", returnByValue: true },
      )
        .then((response) => {
          this.paramsForReuse_ = response.result.value;
        }),
      this.session_.send(
        "Emulation.setDefaultBackgroundColorOverride",
        {
          color: {
            r: bgcolorRGBA[0],
            g: bgcolorRGBA[1],
            b: bgcolorRGBA[2],
            a: bgcolorRGBA[3] * 255,
          },
        },
      ),
      this.app_.session_.send("Browser.getWindowForTarget", { targetId })
        .then(this.initBounds_.bind(this)),
      this.configureRpcOnce_(),
      ...this.app_.exposedFunctions_.map(({ name, func }) =>
        this.exposeFunction(name, func)
      ),
    ]);
  }

  // deno-lint-ignore ban-types
  exposeFunction(name: string, func: Function): Promise<void> {
    this.logger_.debug("[app] Exposing function", name);
    return this.page_.exposeFunction(name, func);
  }

  async evaluate(
    // deno-lint-ignore ban-types
    pageFunction: string | Function,
    ...args: unknown[]
    // deno-lint-ignore no-explicit-any
  ): Promise<any> {
    try {
      const result = await this.page_.evaluate(pageFunction, ...args);
      return result;
    } catch (err) {
      if (
        err instanceof Error && err.message.startsWith("Evaluation failed: ")
      ) {
        throw new EvaluateError(
          err.message.slice("Evaluation failed: ".length),
        );
      }
      throw err;
    }
  }

  serveFolder(folder = "", prefix = ""): void {
    this.www_.push({ folder, prefix: wrapPrefix(prefix) });
  }

  serveOrigin(base: string, prefix = "") {
    this.www_.push(
      { baseURL: new URL(base + "/"), prefix: wrapPrefix(prefix) },
    );
  }

  /**
   * Calls given handler for each request and allows called to handle it.
   *
   * @param handler to be used for each request.
   */
  serveHandler(handler: types.HttpHandler) {
    this.httpHandler_ = handler;
  }

  async load(uri = "", ...params: unknown[]): Promise<unknown> {
    this.logger_.debug("[app] Load page", uri);
    this.loadURI_ = uri;
    this.loadParams_ = params;
    await this.initializeInterception_();
    this.logger_.debug("[app] Navigating the page to", this.loadURI_);

    const result = new Promise<void>((f) => this.domContentLoadedCallback_ = f);
    // Await here to process exceptions.
    await this.page_.goto(
      new URL(this.loadURI_, "https://domain/").toString(),
      { timeout: 0, waitFor: "domcontentloaded" },
    );
    // Available in Chrome M73+.
    this.session_.send("Page.resetNavigationHistory").catch((e) => {});
    // Make sure domContentLoaded callback is processed before we return.
    // That indirection is here to handle debug-related reloads we did not call for.
    return result;
  }

  initBounds_(result: { windowId: unknown }) {
    this.windowId_ = result.windowId;
    return this.setBounds(
      {
        top: this.options_.top!,
        left: this.options_.left!,
        width: this.options_.width!,
        height: this.options_.height!,
      },
    );
  }

  /**
   * Puppeteer page object for test.
   */
  pageForTest(): Page {
    return this.page_;
  }

  /**
   * Returns value specified in the carol.launch(options.paramsForReuse). This is handy
   * when Carol is reused across app runs. First Carol lapp successfully starts the browser.
   * Second carol attempts to start the browser, but browser profile is already in use.
   * Yet, new window is being opened in the first Carol app. This new window returns
   * options.paramsForReuse passed into the second Carol. This was single app knows what to
   * do with the additional windows.
   */
  paramsForReuse(): unknown {
    return this.paramsForReuse_;
  }

  /**
   * @private
   */
  async configureRpcOnce_() {
    await this.page_.exposeFunction(
      "receivedFromChild",
      (data: Messages.Any) => this.receivedFromChild_(data),
    );

    await this.page_.evaluateOnNewDocument(
      (rpcFile: string, features: string[]) => {
        const module = { exports: {} as { default: RPC } };
        const exports = module.exports;
        eval(rpcFile);
        (self as ExtendedSelf).rpc = module.exports.default;
        (self as ExtendedSelf).carol = {} as Carol;
        let argvCallback: (loadParams: unknown) => void;
        const argvPromise = new Promise<unknown>((f) => argvCallback = f);
        (self as ExtendedSelf).carol.loadParams = () => argvPromise;

        function transport(
          receivedFromParent: ExtendedSelf["receivedFromParent"],
        ): (message: unknown) => void {
          (self as ExtendedSelf).receivedFromParent = receivedFromParent;
          // @ts-ignore This function is defined in the browser environement using `exposeFunction`.
          // deno-lint-ignore no-undef
          return receivedFromChild;
        }

        (self as ExtendedSelf).rpc.initWorld(
          transport,
          async (loadParams, win) => {
            argvCallback(loadParams);

            // @ts-ignore This function is called in the browser environment.
            // deno-lint-ignore no-undef
            if (document.readyState === "loading") {
              await new Promise((f) =>
                // @ts-ignore This function is called in the browser environment.
                // deno-lint-ignore no-undef
                document.addEventListener("DOMContentLoaded", f)
              );
            }

            for (const feature of features) {
              eval(`(${feature})`)(win);
            }
          },
        );
      },
      decode(decodeFromBase64(BASE64_ENCODED_RPC_CLIENT_SOURCE)),
      features.map((f) => f.toString()),
    );
  }

  async domContentLoaded_() {
    this.logger_.debug("[app] Creating rpc world for page...");
    const transport = (receivedFromChild: (message: Messages.Any) => void) => {
      this.receivedFromChild_ = receivedFromChild;
      return (data: unknown) => {
        const json = JSON.stringify(data);
        if (this.session_._connection) {
          this.session_.send(
            "Runtime.evaluate",
            { expression: `self.receivedFromParent(${json})` },
          );
        }
      };
    };
    if (this._lastWebWorldId) {
      rpc.disposeWorld(this._lastWebWorldId);
    }
    const { worldId } = await rpc.createWorld(
      transport,
      this.loadParams_,
      this.hostHandle_,
    );
    this.logger_.debug("[app] World created", worldId);
    this._lastWebWorldId = worldId;

    this.domContentLoadedCallback_!();
  }

  // deno-lint-ignore require-await
  async initializeInterception_(): Promise<void> {
    this.logger_.debug("[app] Initializing network interception...");
    if (this.interceptionInitialized_) {
      return;
    }
    if (
      this.www_.length + this.app_.www_.length === 0 && !this.httpHandler_ &&
      !this.app_.httpHandler_
    ) {
      return;
    }
    this.interceptionInitialized_ = true;
    this.session_.on(
      "Network.requestIntercepted",
      this.requestIntercepted_.bind(this),
    );
    return this.session_.send(
      "Network.setRequestInterception",
      { patterns: [{ urlPattern: "*" }] },
    );
  }

  requestIntercepted_(payload: HttpRequestParams): void {
    this.logger_.debug("[server] intercepted:", payload.request.url);
    const handlers = [] as types.HttpHandler[];
    if (this.httpHandler_) {
      handlers.push(this.httpHandler_);
    }
    if (this.app_.httpHandler_) {
      handlers.push(this.app_.httpHandler_);
    }
    handlers.push((request) => this.handleRequest_(request));
    new HttpRequest(this.session_, this.logger_, payload, handlers);
  }

  async handleRequest_(request: types.HttpRequest): Promise<void> {
    const url = new URL(request.url());
    this.logger_.debug("[server] request url:", url.toString());

    if (url.hostname !== "domain") {
      request.deferToBrowser();
      return;
    }

    const urlpathname = url.pathname;
    for (
      const { prefix, folder, baseURL } of this.app_.www_.concat(this.www_)
    ) {
      this.logger_.debug("[server] prefix:", prefix);
      if (!urlpathname.startsWith(prefix)) {
        continue;
      }

      const pathname = urlpathname.substr(prefix.length);
      this.logger_.debug("[server] pathname:", pathname);
      if (baseURL) {
        request.deferToBrowser({ url: String(new URL(pathname, baseURL)) });
        return;
      }
      const fileName = join(folder!, pathname);
      console.log("[folder/fileName]");
      console.log(folder);
      console.log(fileName);
      if (!await exists(fileName)) {
        continue;
      }

      const headers = {
        "content-type": contentType(request, fileName),
      } as Record<string, string>;
      const body = await Deno.readFile(fileName);
      request.fulfill({ headers, body });
      return;
    }
    request.deferToBrowser();
  }

  async bounds(): Promise<types.Bounds> {
    const { bounds } = await this.app_.session_.send(
      "Browser.getWindowBounds",
      { windowId: this.windowId_ },
    );
    return {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
  }

  async setBounds(bounds: types.Bounds): Promise<void> {
    await this.app_.session_.send(
      "Browser.setWindowBounds",
      { windowId: this.windowId_, bounds },
    );
  }

  async fullscreen(): Promise<void> {
    const bounds = { windowState: "fullscreen" };
    await this.app_.session_.send(
      "Browser.setWindowBounds",
      { windowId: this.windowId_, bounds },
    );
  }

  async minimize(): Promise<void> {
    const bounds = { windowState: "minimized" };
    await this.app_.session_.send(
      "Browser.setWindowBounds",
      { windowId: this.windowId_, bounds },
    );
  }

  async maximize(): Promise<void> {
    const bounds = { windowState: "maximized" };
    await this.app_.session_.send(
      "Browser.setWindowBounds",
      { windowId: this.windowId_, bounds },
    );
  }

  bringToFront(): Promise<void> {
    return this.page_.bringToFront();
  }

  close(): Promise<void> {
    return this.page_.close();
  }

  closed_() {
    rpc.dispose(this.hostHandle_);
    this.app_.windowClosed_(this);
    this.emit(Window.Events.Close, null);
  }

  isClosed(): boolean {
    return this.page_.isClosed();
  }

  static Events = {
    Close: "close",
  };
}

const imageContentTypes = new Map([
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["svg", "image/svg+xml"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["png", "image/png"],
  ["ico", "image/ico"],
  ["tiff", "image/tiff"],
  ["tif", "image/tiff"],
  ["bmp", "image/bmp"],
]);

const fontContentTypes = new Map([
  ["ttf", "font/opentype"],
  ["otf", "font/opentype"],
  ["ttc", "font/opentype"],
  ["woff", "application/font-woff"],
]);

function contentType(
  request: types.HttpRequest,
  fileName: string,
): string | undefined {
  const dotIndex = fileName.lastIndexOf(".");
  const extension = fileName.substr(dotIndex + 1);
  switch (request.resourceType()) {
    case "Document":
      return "text/html";
    case "Script":
      return "text/javascript";
    case "Stylesheet":
      return "text/css";
    case "Image":
      return imageContentTypes.get(extension) || "image/png";
    case "Font":
      return fontContentTypes.get(extension) || "application/font-woff";
  }
}

/**
 * Launches the app and returns `Application` object.
 */
export async function launch(
  options_: types.AppOptions = {},
): Promise<types.Application> {
  const options = Object.assign(options_) as types.AppOptions;
  const logger = options.logger ?? createLogger();
  logger.debug("[app] Launching Carlo", options_);
  if (!options.bgcolor) {
    options.bgcolor = "#ffffff";
  }
  options.localDataDir = options.localDataDir || join(__dirname, ".local-data");

  const executablePath = options.executablePath ?? await locateChrome();
  if (!executablePath) {
    console.error(
      "Could not find Chrome installation, please make sure Chrome browser is installed from https://www.google.com/chrome/.",
    );
    Deno.exit(0);
  }

  const targetPage = `
    <title>${encodeURIComponent(options.title || "")}</title>
    <style>html{background:${encodeURIComponent(options.bgcolor)};}</style>
    <script>self.paramsForReuse = ${
    JSON.stringify(options.paramsForReuse || undefined)
  };</script>`;

  const args = [
    `--app=data:text/html,${targetPage}`,
    `--enable-features=NetworkService,NetworkServiceInProcess`,
  ];

  if (options.args) {
    args.push(...options.args);
  }
  if (typeof options.width === "number" && typeof options.height === "number") {
    args.push(`--window-size=${options.width},${options.height}`);
  }
  if (typeof options.left === "number" && typeof options.top === "number") {
    args.push(`--window-position=${options.left},${options.top}`);
  }

  options.args = args;

  try {
    const { browser, chromeProcess } = await launchPuppeteer(
      executablePath,
      testMode,
      options,
    );
    const app = new Application(browser, chromeProcess, logger, options);
    await app.init_();
    return app;
  } catch (e) {
    if (e.toString().includes("Target closed")) {
      throw new Error(
        "Could not start the browser or the browser was already running with the given profile.",
      );
    } else {
      throw e;
    }
  }
}

class HostWindow {
  window_: Window;

  constructor(win: Window) {
    this.window_ = win;
  }

  closeBrowser(): void {
    // Allow rpc response to land.
    setTimeout(() => this.window_.app_.exit(), 0);
  }

  async fileInfo(expression: string) {
    const { result } = await this.window_.session_.send(
      "Runtime.evaluate",
      { expression },
    );
    return this.window_.session_.send(
      "DOM.getFileInfo",
      { objectId: result.objectId },
    );
  }
}

export function enterTestMode() {
  testMode = true;
}

function wrapPrefix(prefix: string): string {
  if (!prefix.startsWith("/")) prefix = "/" + prefix;
  if (!prefix.endsWith("/")) prefix += "/";
  return prefix;
}
