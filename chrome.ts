/**
 * This file contains the code adapted from https://github.com/zserge/lorca/blob/a3e43396a47ea152501d3453514c7f373cea530a/chrome.go
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

/**
 * This file contains the code adapted from the folling urls:
 * * https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/carlo.js
 * * https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/http_request.js
 * They are licensed as follows:
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

import { Transport, createWSTransport, IncommingMessage } from "./transport.ts";
import { Logger, createLogger } from "./logger.ts";
import {
  assert,
  BufReader,
  concat,
  decode,
  deferred,
  Deferred,
  encode,
  encodeToBase64,
  exists,
  join,
  sprintf,
} from "./deps.ts";

export interface Chrome {
  // TODO add support for passing a JS function
  evaluate(expr: string): Promise<any>;
  bind(name: string, binding: Binding): Promise<void>;
  load(url: string): Promise<void>;
  serveFolder(folder: string, prefix?: string): void;
  serveOrigin(base: string, prefix?: string): void;
  exit(): Promise<void>;
  onExit(): Promise<void>;
}

type Binding = (args: any[]) => any;
type HTTPHeaders = { [header: string]: any };

interface Request {
  url: string;
  method: string;
  headers: object;
  rawResponse: string;
}

export class EvaluateError extends Error {}

const DUMMY_URL = new URL("https://domain/");

class ChromeImpl implements Chrome {
  #process: Deno.Process;
  #transport: Transport;
  #logger: Logger;

  #pending: Map<number, Deferred<any>> = new Map();
  #bindings: Map<string, Binding> = new Map();
  #exitPromise: Deferred<void> = deferred();
  #www: Array<{ prefix: string; folder?: string; baseURL?: URL }> = [];
  #requestInterceptionEnabled = false;

  #target!: string;
  #session!: string;
  #window!: number;

  constructor(
    process: Deno.Process,
    transport: Transport,
    logger: Logger,
  ) {
    this.#process = process;
    this.#transport = transport;
    this.#logger = logger;
  }

  async startSession(targetId: string): Promise<void> {
    this.#target = targetId;
    const id = 1;
    this.sendMessage(id, "Target.attachToTarget", {
      id,
      params: { targetId },
    });

    while (true) {
      const message = await this.#transport.receive();
      if (hasId(message, id)) {
        if (hasError(message)) {
          throw new Error(`Target error: ${message.error}`);
        }
        // FIXME
        if ((message as any).result && (message as any).result.sessionId) {
          this.#session = (message as any).result.sessionId;
          return;
        }
      }
    }
  }

  async findTarget(): Promise<string> {
    this.sendMessage(0, "Target.setDiscoverTargets", {
      params: { discover: true },
    });

    while (true) {
      const message = await this.#transport.receive();
      if (
        isTargetCreated(message) && message.params.targetInfo.type === "page"
      ) {
        return message.params.targetInfo.targetId;
      }
    }
  }

  evaluate(expr: string): Promise<any> {
    return this.sendMessageToTarget("Runtime.evaluate", {
      "expression": expr,
      "awaitPromise": true,
      "returnByValue": true,
    });
  }

  async load(url: string): Promise<void> {
    await this.enableRequestInterception();
    await this.sendMessageToTarget(
      "Page.navigate",
      { "url": new URL(url, DUMMY_URL).toString() },
    );
  }

  /**
   * This method is adopted from https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/carlo.js.
   * @param {string=} folder Folder with the web content.
   * @param {string=} prefix Only serve folder for requests with given prefix.
   */
  serveFolder(folder: string, prefix: string = ""): void {
    this.#www.push({ folder, prefix: wrapPrefix(prefix) });
  }

  /**
   * This method is adopted from https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/carlo.js.
   *
   * Serves pages from given origin, eg `http://localhost:8080`.
   * This can be used for the fast development mode available in web frameworks.
   *
   * @param {string} base
   * @param {string=} prefix Only serve folder for requests with given prefix.
   */
  serveOrigin(base: string, prefix = "") {
    this.#www.push(
      { baseURL: new URL(base + "/"), prefix: wrapPrefix(prefix) },
    );
  }

  private async enableRequestInterception(): Promise<void> {
    if (this.shouldEnableRequestInterception()) {
      this.#requestInterceptionEnabled = true;
      await this.sendMessageToTarget(
        "Network.setRequestInterception",
        { patterns: [{ urlPattern: "*" }] },
      );
    }
  }

  /**
   * This method is based on `Window#_handleRequest_`
   * @see https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/carlo.js
   */
  private async handleRequestIntercepted(params: {
    interceptionId: string;
    request: Request;
    resourceType: string;
  }): Promise<void> {
    const { request, interceptionId, resourceType } = params;
    const url = new URL(request.url);
    this.#logger.debug(`request url: ${url}`);

    if (url.hostname !== DUMMY_URL.hostname) {
      await this.deferRequestToBrowser(interceptionId, request);
      return;
    }

    const urlpathname = url.pathname;
    for (const entry of this.#www) {
      const { prefix } = entry;
      this.#logger.debug("prefix: " + prefix);
      if (!urlpathname.startsWith(prefix)) {
        continue;
      }

      const pathname = urlpathname.substr(prefix.length);
      this.#logger.debug("pathname: " + pathname);
      if (entry.baseURL != null) {
        await this.deferRequestToBrowser(
          interceptionId,
          request,
          { url: String(new URL(pathname, entry.baseURL)) },
        );
        return;
      }

      const folder = entry.folder;
      assert(folder != null);
      const fileName = join(folder, pathname);
      if (!await exists(fileName)) {
        continue;
      }

      this.#logger.debug("serveFile:", fileName);
      const headers = { "content-type": contentType(resourceType, fileName) };
      const body = await Deno.readFile(fileName);
      await this.fullfillRequest({ interceptionId, request, headers, body });
      return;
    }
    await this.deferRequestToBrowser(interceptionId, request);
  }

  /**
   * This methos is based on `Request#deferToBrowser`
   * @see https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/http_request.js
   */
  private deferRequestToBrowser(
    interceptionId: string,
    base: Request,
    overrides: Partial<Request> = {},
  ): Promise<object> {
    this.#logger.debug("deferRequestToBrowser:", overrides);
    assert(interceptionId != null, "interceptionId must be required");
    return this.resolveRequest(interceptionId, { ...base, ...overrides });
  }

  /**
   * This methos is based on `Request#fullfill`
   * @see https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/http_request.js
   */
  private fullfillRequest({
    interceptionId,
    request,
    headers,
    body,
    status = 200,
  }: {
    interceptionId: string;
    request: Request;
    headers: HTTPHeaders;
    body: Uint8Array;
    status?: number;
  }): Promise<object> {
    this.#logger.debug("fulfill", request.url);
    assert(interceptionId != null, "interceptionId must be required");
    const responseHeaders = {} as HTTPHeaders;
    if (headers) {
      for (const header of Object.keys(headers)) {
        responseHeaders[header.toLowerCase()] = headers[header];
      }
    }
    if (body && !("content-length" in responseHeaders)) {
      responseHeaders["content-length"] = body.byteLength;
    }

    const statusText = statusTexts[status] || "";
    const statusLine = `HTTP/1.1 ${status} ${statusText}`;

    const CRLF = "\r\n";
    let text = statusLine + CRLF;
    for (const header of Object.keys(responseHeaders)) {
      text += header + ": " + responseHeaders[header] + CRLF;
    }
    text += CRLF;
    let responseBuffer = encode(text);
    if (body) {
      responseBuffer = concat(responseBuffer, body);
    }

    return this.resolveRequest(interceptionId, {
      rawResponse: encodeToBase64(responseBuffer),
    });
  }

  /**
   * This methos is based on `Request#resolve_`
   * @see https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/http_request.js
   */
  private resolveRequest(
    interceptionId: string,
    request: Partial<Request>,
  ): Promise<object> {
    this.#logger.debug("resolveRequest:", request);
    assert(interceptionId != null, "interceptionId must be required");
    return this.sendMessageToTarget(
      "Network.continueInterceptedRequest",
      {
        interceptionId,
        ...request,
      },
    );
  }

  private shouldEnableRequestInterception(): boolean {
    return !this.#requestInterceptionEnabled && this.#www.length > 0;
  }

  async bind(name: string, binding: Binding): Promise<void> {
    const bindingExists = this.#bindings.has(name);
    this.#bindings.set(name, binding);
    if (bindingExists) {
      // Just replace callback and return, as the binding was already added to js
      // and adding it again would break it.
      return;
    }
    await this.sendMessageToTarget("Runtime.addBinding", { "name": name });

    const script = sprintf(
      `(() => {
      const bindingName = '%s';
      const binding = window[bindingName];
      window[bindingName] = async (...args) => {
      	const me = window[bindingName];
      	let errors = me['errors'];
      	let callbacks = me['callbacks'];
      	if (!callbacks) {
      		callbacks = new Map();
      		me['callbacks'] = callbacks;
      	}
      	if (!errors) {
      		errors = new Map();
      		me['errors'] = errors;
      	}
      	const seq = (me['lastSeq'] || 0) + 1;
      	me['lastSeq'] = seq;
      	const promise = new Promise((resolve, reject) => {
      		callbacks.set(seq, resolve);
      		errors.set(seq, reject);
      	});
      	binding(JSON.stringify({name: bindingName, seq, args}));
      	return promise;
      }})();
      `,
      name,
    );
    await this.sendMessageToTarget(
      "Page.addScriptToEvaluateOnNewDocument",
      { "source": script },
    );
    await this.evaluate(script);
  }

  async exit(): Promise<void> {
    this.#process.stderr!.close();
    this.#process.close();
    await this.#transport.close();
    this.#exitPromise.resolve();
  }

  onExit(): Promise<void> {
    return this.#exitPromise;
  }

  #lastId = 0;
  private nextId(): number {
    return ++this.#lastId;
  }

  sendMessageToTarget(method: string, args: object = {}) {
    assert(this.#session, "session must be created");
    const id = this.nextId();
    return this.sendMessage(id, "Target.sendMessageToTarget", {
      "params": {
        "message": JSON.stringify({
          "id": id,
          "method": method,
          "params": args,
        }),
        "sessionId": this.#session,
      },
    });
  }

  private sendMessage(
    id: number,
    method: string,
    args: object = {},
  ): Promise<object> {
    const message = {
      id,
      method,
      ...args,
    };
    this.#transport.send(message);
    const promise = deferred<object>();
    this.#pending.set(id, promise);
    return promise;
  }

  async getWindowForTarget(target: string): Promise<{
    windowId: number;
    bounds: object;
  }> {
    const msg = await this.sendMessageToTarget(
      "Browser.getWindowForTarget",
      { "targetId": target },
    );
    return msg as any; // FIXME
  }

  setWindow(windowId: number): void {
    this.#window = windowId;
  }

  async readLoop(): Promise<void> {
    while (!this.#transport.isClosed()) {
      let m!: IncommingMessage;
      try {
        m = await this.#transport.receive();
      } catch (err) {
        this.#logger.error(err);
        if (this.#transport.isClosed()) {
          break;
        }
      }

      if (m.method == "Target.receivedMessageFromTarget") {
        type TargetReceivedMessageFromTargetParams = {
          sessionId: string;
          message: string;
        };

        type TargetReceivedMessageFromTargetMessage = {
          id: number;
          method: string;
          params: object;
          error?: { message?: string };
          result: {
            result?: {
              description: string;
              type: string;
              subtype: string;
              value: object;
            };
            exceptionDetails?: {
              exception?: { value?: string };
            };
          };
        };

        const params = m.params as TargetReceivedMessageFromTargetParams;

        if (params.sessionId != this.#session) {
          continue;
        }

        const res = JSON.parse(
          params.message,
        ) as TargetReceivedMessageFromTargetMessage;

        if (
          res.id == null && res.method == "Runtime.consoleAPICalled" ||
          res.method == "Runtime.exceptionThrown"
        ) {
          this.#logger.log(params.message);
        } else if (res.id == null && res.method == "Runtime.bindingCalled") {
          type RuntimeBindingCalledParams = {
            id: number;
            name: string;
            payload: string;
          };
          type RuntimeBindingCalledParamsPayload = {
            name: string;
            seq: number;
            args: object[];
          };
          const { payload: payloadString, name: bindingName, id: contextId } =
            (res.params as RuntimeBindingCalledParams);
          const payload = JSON.parse(
            payloadString,
          ) as RuntimeBindingCalledParamsPayload; // FIXME

          const binding = this.#bindings.get(bindingName);
          if (binding) {
            (async () => {
              let result: string = "";
              let error: string = "";
              try {
                const r = await binding!(payload.args);
                result = JSON.stringify(r);
              } catch (err) {
                error = err instanceof Error ? err.message : String(err);
              }
              const expr = sprintf(
                `
	  						if (%[4]s) {
	  							window['%[1]s']['errors'].get(%[2]d)(%[4]s);
	  						} else {
	  							window['%[1]s']['callbacks'].get(%[2]d)(%[3]s);
	  						}
	  						window['%[1]s']['callbacks'].delete(%[2]d);
	  						window['%[1]s']['errors'].delete(%[2]d);
                `,
                payload.name,
                payload.seq,
                result,
                error ? JSON.stringify(error) : '""',
              );

              this.sendMessageToTarget("Runtime.evaluate", {
                "expression": expr,
                "contextId": contextId,
              });
            })();
          }
          continue;
        } else if (res.method === "Network.requestIntercepted") {
          this.handleRequestIntercepted(res.params as any); // FIXME
          continue;
        }

        const resc = this.#pending.get(res.id);
        this.#pending.delete(res.id);

        if (!resc) {
          continue;
        }

        if (res.error?.message) {
          resc.reject(new EvaluateError(res.error!.message));
        } else if (res.result.exceptionDetails?.exception?.value != null) {
          resc.reject(
            new EvaluateError(
              res.result.exceptionDetails.exception.value,
            ),
          );
        } else if (
          res.result.result?.type == "object" &&
          res.result.result.subtype == "error"
        ) {
          resc.reject(new EvaluateError(res.result.result.description));
        } else if (res.result.result?.type) {
          resc.resolve(res.result.result.value);
        } else {
          const message = JSON.parse(
            params.message,
          ) as TargetReceivedMessageFromTargetMessage;
          resc.resolve(message.result);
        }
      } else if (m.method == "Target.targetDestroyed") {
        type TargetDestroyedParams = {
          targetId: string;
        };
        const params = m.params as TargetDestroyedParams;
        if (params.targetId == this.#target) {
          await this.exit();
        }
      }
    }
  }
}

function hasId(x: object, id: number): x is { id: number } {
  return x && (x as any).id === id;
}

function hasError(x: object): x is { error: any } {
  return x && (x as any).error != null;
}

function isTargetCreated(x: object): x is {
  method: "Target.targetCreated";
  params: {
    targetInfo: {
      type: string;
      targetId: string;
    };
  };
} {
  return x && (x as any)["method"] === "Target.targetCreated";
}

export interface RunChromeOptions {
  executable: string;
  args: string[];
}

export async function runChrome(options: RunChromeOptions): Promise<Chrome> {
  const process = Deno.run({
    cmd: [options.executable, ...options.args],
    stderr: "piped",
  });
  const wsEndpoint = await waitForWSEndpoint(process.stderr!);
  const transport = await createWSTransport(wsEndpoint);
  const logger = createLogger();
  return createChrome({
    process,
    transport,
    logger,
    headless: options.args.includes("--headless"),
  });
}

export interface CreateChromeOptions {
  process: Deno.Process;
  transport: Transport;
  logger: Logger;
  headless: boolean;
}

export async function createChrome({
  process,
  transport,
  logger,
  headless,
}: CreateChromeOptions): Promise<Chrome> {
  const chrome = new ChromeImpl(process, transport, logger);
  try {
    const targetId = await chrome.findTarget();
    await chrome.startSession(targetId);
    chrome.readLoop();
    for (
      const [method, params] of [
        ["Page.enable"],
        [
          "Target.setAutoAttach",
          { "autoAttach": true, "waitForDebuggerOnStart": false },
        ],
        ["Network.enable"],
        ["Runtime.enable"],
        ["Security.enable"],
        ["Performance.enable"],
        ["Log.enable"],
      ] as Array<[string, object | undefined]>
    ) {
      try {
        chrome.sendMessageToTarget(method, params);
      } catch (error) {
        chrome.exit();
        // chrome.process.wait();
        throw error;
      }
    }

    if (!headless) {
      try {
        const window = await chrome.getWindowForTarget(targetId);
        chrome.setWindow(window.windowId);
      } catch (err) {
        chrome.exit();
        throw err;
      }
    }

    return chrome;
  } catch (err) {
    chrome.exit();
    throw err;
  }
}

async function waitForWSEndpoint(r: Deno.Reader): Promise<string> {
  const b = BufReader.create(r);
  // TODO handle timeout
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

function wrapPrefix(prefix: string): string {
  if (!prefix.startsWith("/")) prefix = "/" + prefix;
  if (!prefix.endsWith("/")) prefix += "/";
  return prefix;
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

function contentType(resourceType: string, fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const extension = fileName.substr(dotIndex + 1);
  switch (resourceType) {
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
    default:
      assert(false, "Unexpected resource type: " + resourceType);
  }
}

const statusTexts = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "208": "Already Reported",
  "209": "IM Used",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Found",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "306": "Switch Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Payload Too Large",
  "414": "URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "421": "Misdirected Request",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "451": "Unavailable For Legal Reasons",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "508": "Loop Detected",
  "510": "Not Extended",
  "511": "Network Authentication Required",
} as { [status: string]: string };
