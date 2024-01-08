export { exists } from "https://deno.land/std@0.211.0/fs/exists.ts";
export { dirname } from "https://deno.land/std@0.211.0/path/dirname.ts";
export { fromFileUrl } from "https://deno.land/std@0.211.0/path/from_file_url.ts";
export { join } from "https://deno.land/std@0.211.0/path/join.ts";
export { resolve } from "https://deno.land/std@0.211.0/path/resolve.ts";
export { BufReader } from "https://deno.land/std@0.211.0/io/buf_reader.ts";
export { concat } from "https://deno.land/std@0.211.0/bytes/mod.ts";
// TODO: Remove this import statement.
export { decode, encode } from "https://deno.land/std@0.84.0/encoding/utf8.ts";
export {
  decodeBase64 as decodeFromBase64,
  encodeBase64 as encodeToBase64,
} from "https://deno.land/std@0.211.0/encoding/base64.ts";
export { deferred } from "https://deno.land/std@0.149.0/async/deferred.ts";
export type { Deferred } from "https://deno.land/std@0.149.0/async/deferred.ts";

export { readAll } from "https://deno.land/std@0.211.0/streams/read_all.ts";
export { writeAll } from "https://deno.land/std@0.211.0/streams/write_all.ts";

export {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  fail,
} from "https://deno.land/std@0.149.0/assert/mod.ts";

export { default as puppeteer } from "https://unpkg.com/puppeteer@13.3.2/lib/esm/puppeteer/web.js";
export { EventEmitter } from "https://unpkg.com/puppeteer@13.3.2/lib/esm/puppeteer/common/EventEmitter.js";
export { BrowserWebSocketTransport } from "https://unpkg.com/puppeteer@13.3.2/lib/esm/puppeteer/common/BrowserWebSocketTransport.js";

export type { Browser } from "https://unpkg.com/puppeteer@13.3.2/lib/esm/puppeteer/common/Browser.js";
export type { Target } from "https://unpkg.com/puppeteer@13.3.2/lib/esm/puppeteer/common/Target.js";
export type { CDPSession } from "https://unpkg.com/puppeteer@13.3.2/lib/esm/puppeteer/common/Connection.js";
export type { Page } from "https://unpkg.com/puppeteer@13.3.2/lib/esm/puppeteer/common/Page.js";
