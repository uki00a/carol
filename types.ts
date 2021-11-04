/**
 * Some documents are adopted from https://github.com/GoogleChromeLabs/carlo/blob/master/API.md
 */

export interface AppOptions {
  /**
   * Application icon
   */
  icon?: string;

  /**
   * Initial window top offset (px)
   */
  top?: number;

  /**
   * Initial window left offset (px)
   */
  left?: number;

  /**
   * Initial window width (px)
   */
  width?: number;

  /**
   * Initial window height (px)
   */
  height?: number;

  /**
   * Background color
   * @example "#ff0000"
   */
  bgcolor?: string;
  localDataDir?: string;

  /**
   * Path to a User Data Directory
   * @see http://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md
   */
  userDataDir?: string;

  /**
   * Window title
   */
  title?: string;

  /**
   * Additional arguments to be passed into a Chrome executable
   * @see https://peter.sh/experiments/chromium-command-line-switches/
   */
  args?: string[];

  paramsForReuse?: unknown;

  /**
   * A logger used to log debug information.
   */
  logger?: Logger;

  /**
   * Path to a Chrome executable file.
   * If this options is not set, carol automatically locates a Chrome executable file.
   */
  executablePath?: string;
}

export interface Application {
  /**
   * Close the app windows.
   */
  exit(message?: string): Promise<string|void>;

  /**
   * Returns the promise that will be resolved when the app is closed.
   */
  onExit(): Promise<string|void>;

  /**
   * @return main window.
   */
  mainWindow(): Window;

  /**
   * Creates a new window.
   */
  createWindow(): Promise<Window>;

  /**
   * Returns all currently opened windows.
   */
  windows(): Window[];

  /**
   * Adds a function called `name` to the page's `window` object.
   */
  // deno-lint-ignore ban-types
  exposeFunction(name: string, func: Function): Promise<unknown[]>;

  /**
   * This is equivalent to `app.mainWindow().evaluate()`.
   */
  // deno-lint-ignore no-explicit-any, ban-types
  evaluate(pageFunction: Function | string, ...args: unknown[]): Promise<any>;

  /**
   * Serves pages from the given `folder`.
   * @param folder Folder with the web content.
   * @param prefix Only serve folder for requests with given prefix.
   */
  serveFolder(folder?: string, prefix?: string): void;

  /**
   * Serves pages from given origin, eg `http://localhost:8080`.
   * This can be used for the fast development mode available in web frameworks.
   *
   * @param prefix Only serve folder for requests with given prefix.
   */
  serveOrigin(base: string, prefix?: string): void;

  /**
   * Calls given `handler` for each request and allows called to handle it.
   *
   * @param handler to be used for each request.
   */
  serveHandler(handler: HttpHandler): void;

  /**
   * This is equivalent to `app.mainWindow().load()`.
   */
  load(uri?: string, ...params: unknown[]): Promise<unknown>;

  /**
   * Set the application icon shown in the OS dock / task swicher.
   */
  setIcon(icon: string | Uint8Array): Promise<void>;
}

export interface Window {
  /**
   * Same as `Application.exposeFunction`, but only applies to the current window.
   */
  // deno-lint-ignore ban-types
  exposeFunction(name: string, func: Function): Promise<void>;

  /**
   * Evaluates `pageFunction` in the page context.
   *
   * @param pageFunction to be evaluated in the page context
   * @param args passed into `pageFunction`
   * @return `Promise` which resolves to the return value of `pageFunction`.
   */
  evaluate(
    // deno-lint-ignore ban-types
    pageFunction: string | Function,
    ...args: unknown[]
    // deno-lint-ignore no-explicit-any
  ): Promise<any>;

  /**
   * Same as `Application.serveFolder`, but only applies to the current window.
   */
  serveFolder(folder?: string, prefix?: string): void;

  /**
   * Same as `Application.serveOrigin`, but only applies to the current window.
   */
  serveOrigin(base: string, prefix?: string): void;

  /**
   * Same as `AppOptions.serveHandler`, but only applies to the current window requests.
   */
  serveHandler(handler: HttpHandler): void;

  /**
   * Navigates the corresponding web page to the given `uri`.
   */
  load(uri?: string, ...params: unknown[]): Promise<unknown>;

  /**
   * Returns window bounds.
   */
  bounds(): Promise<Bounds>;

  /**
   * Sets window bounds.
   */
  setBounds(bounds: Bounds): Promise<void>;

  /**
   * Turns the window into the full screen mode.
   */
  fullscreen(): Promise<void>;

  /**
   * Minimizes the window.
   */
  minimize(): Promise<void>;

  /**
   * Maximizes the window.
   */
  maximize(): Promise<void>;

  /**
   * Brings this window to front.
   */
  bringToFront(): Promise<void>;

  /**
   * Closes the window.
   */
  close(): Promise<void>;

  /**
   * Returns `true` if this window is closed.
   */
  isClosed(): boolean;
}

export interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HttpHandler {
  (request: HttpRequest): void | Promise<void>;
}

/**
 * Intercepted request instance that can be resolved to the client's liking.
 */
export interface HttpRequest {
  /**
   * Network request url.
   */
  url(): string;

  /**
   * Network request method.
   */
  method(): string;

  /**
   * @return HTTP request headers.
   */
  headers(): Record<string, string>;

  resourceType(): string;

  /**
   * Aborts the request.
   */
  abort(): Promise<unknown>;

  /**
   * Fails the request.
   */
  fail(): Promise<unknown>;

  /**
   * Falls through to the next handler.
   */
  continue(): void;

  /**
   * Continues the request with the provided overrides to the url, method or
   * headers.
   *
   * @param overrides
   * Overrides to apply to the request before it hits network.
   */
  deferToBrowser(overrides?: Overrides): Promise<unknown>;

  /**
   * Fulfills the request with the given data.
   */
  fulfill(data: {
    status?: number;
    headers?: Record<string, string>;
    body?: Uint8Array;
  }): Promise<unknown>;
}

export interface Overrides {
  url?: string;
  string?: string;
  method?: string;
  headers?: Record<string, string>;
}

/**
 * A logger used to log debug information.
 */
export interface Logger {
  log(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
  debug(message: unknown, ...args: unknown[]): void;
}
