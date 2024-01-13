export { exists } from "https://deno.land/std@0.212.0/fs/exists.ts";
export { dirname } from "https://deno.land/std@0.212.0/path/dirname.ts";
export { fromFileUrl } from "https://deno.land/std@0.212.0/path/from_file_url.ts";
export { join } from "https://deno.land/std@0.212.0/path/join.ts";
export { resolve } from "https://deno.land/std@0.212.0/path/resolve.ts";
export { BufReader } from "https://deno.land/std@0.212.0/io/buf_reader.ts";
export { concat } from "https://deno.land/std@0.212.0/bytes/mod.ts";
// TODO: Remove this import statement.
export { decode, encode } from "https://deno.land/std@0.84.0/encoding/utf8.ts";
export {
  decodeBase64 as decodeFromBase64,
  encodeBase64 as encodeToBase64,
} from "https://deno.land/std@0.212.0/encoding/base64.ts";
export { deferred } from "https://deno.land/std@0.149.0/async/deferred.ts";
export type { Deferred } from "https://deno.land/std@0.149.0/async/deferred.ts";

export { readAll } from "https://deno.land/std@0.212.0/streams/read_all.ts";
export { writeAll } from "https://deno.land/std@0.212.0/streams/write_all.ts";

export { assert } from "https://deno.land/std@0.212.0/assert/assert.ts";
export { assertEquals } from "https://deno.land/std@0.212.0/assert/assert_equals.ts";
export { assertRejects } from "https://deno.land/std@0.212.0/assert/assert_rejects.ts";
export { assertStrictEquals } from "https://deno.land/std@0.212.0/assert/assert_strict_equals.ts";
export { assertStringIncludes } from "https://deno.land/std@0.212.0/assert/assert_string_includes.ts";
export { fail } from "https://deno.land/std@0.212.0/assert/fail.ts";

export {
  type Browser,
  BrowserWebSocketTransport,
  type CDPSession,
  default as puppeteer,
  EventEmitter,
  type Page,
  type Target,
} from "https://esm.sh/puppeteer-core@20.1.0/lib/esm/puppeteer/puppeteer-core.js?pin=v135";
