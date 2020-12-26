export interface AppOptions {
  icon?: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  bgcolor?: string;
  localDataDir?: string;
  userDataDir?: string;

  /**
   * Window title
   */
  title?: string;
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
  exit(): Promise<void>;

  /**
   * Returns the promise that will be resolved when the app is closed.
   */
  onExit(): Promise<void>;

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
   *
   * @param pageFunction to be evaluated in the page context
   * @param args passed into `pageFunction`
   */
  // deno-lint-ignore no-explicit-any, ban-types
  evaluate(pageFunction: Function | string, ...args: unknown[]): Promise<any>;

  /**
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
  // deno-lint-ignore ban-types
  exposeFunction(name: string, func: Function): Promise<void>;

  evaluate(
    // deno-lint-ignore ban-types
    pageFunction: string | Function,
    ...args: unknown[]
    // deno-lint-ignore no-explicit-any
  ): Promise<any>;

  serveFolder(folder?: string, prefix?: string): void;

  /**
   * Serves pages from given origin, eg `http://localhost:8080`.
   * This can be used for the fast development mode available in web frameworks.
   *
   * @param prefix Only serve folder for requests with given prefix.
   */
  serveOrigin(base: string, prefix?: string): void;

  /**
   * Calls given handler for each request and allows called to handle it.
   *
   * @param handler to be used for each request.
   */
  serveHandler(handler: HttpHandler): void;

  load(uri?: string, ...params: unknown[]): Promise<unknown>;
  bounds(): Promise<Bounds>;
  setBounds(bounds: Bounds): Promise<void>;
  fullscreen(): Promise<void>;

  minimize(): Promise<void>;

  maximize(): Promise<void>;
  bringToFront(): Promise<void>;
  close(): Promise<void>;

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
  url(): string;

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

export interface Logger {
  log(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
  debug(message: unknown, ...args: unknown[]): void;
}
