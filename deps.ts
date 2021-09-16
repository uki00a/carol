export { exists } from "https://deno.land/std@0.107.0/fs/exists.ts";
export {
  dirname,
  fromFileUrl,
  join,
  resolve,
} from "https://deno.land/std@0.107.0/path/mod.ts";
export { BufReader } from "https://deno.land/std@0.107.0/io/bufio.ts";
export { concat } from "https://deno.land/std@0.107.0/bytes/mod.ts";
// TODO: Remove this import statement.
export { decode, encode } from "https://deno.land/std@0.84.0/encoding/utf8.ts";
export {
  decode as decodeFromBase64,
  encode as encodeToBase64,
} from "https://deno.land/std@0.107.0/encoding/base64.ts";
export { deferred } from "https://deno.land/std@0.107.0/async/deferred.ts";
export type { Deferred } from "https://deno.land/std@0.107.0/async/deferred.ts";

export { readAll, writeAll } from "https://deno.land/std@0.107.0/io/util.ts";

export {
  assert,
  assertEquals,
  assertStrictEquals,
  assertStringIncludes,
  assertThrowsAsync,
  fail,
} from "https://deno.land/std@0.107.0/testing/asserts.ts";

export { default as puppeteer } from "https://unpkg.com/puppeteer@10.2.0/lib/esm/puppeteer/web.js";
export { EventEmitter } from "https://unpkg.com/puppeteer@10.2.0/lib/esm/puppeteer/common/EventEmitter.js";

export type { Browser } from "https://unpkg.com/puppeteer@10.2.0/lib/esm/puppeteer/common/Browser.js";
export type { Target } from "https://unpkg.com/puppeteer@10.2.0/lib/esm/puppeteer/common/Target.js";
export type { CDPSession } from "https://unpkg.com/puppeteer@10.2.0/lib/esm/puppeteer/common/Connection.js";
export type { Page } from "https://unpkg.com/puppeteer@10.2.0/lib/esm/puppeteer/common/Page.js";
