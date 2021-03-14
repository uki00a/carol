/**
 * This file contains the code adapted from https://github.com/zserge/lorca/blob/a3e43396a47ea152501d3453514c7f373cea530a/ui.go
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
 * This file contains the code adapted from https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/test/app.spec.js
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
  assertEquals,
  assertStrictEquals,
  assertStringIncludes,
  assertThrowsAsync,
  dirname,
  fromFileUrl,
  join,
} from "./deps.ts";
import {
  delayWhenRunningInCI,
  startFileServer,
  test,
  testApp,
} from "./test_util.ts";
import { EvaluateError, launch } from "./mod.ts";
import type { Application } from "./mod.ts";

async function waitForPageLoad(app: Application): Promise<void> {
  // Wait for page load
  for (let i = 0; i < 10; i++) {
    const url = await app.evaluate("window.location.href");
    assertStrictEquals(typeof url, "string");
    if (url.startsWith("http://")) {
      break;
    }
  }
}

const options = {
  width: 480,
  height: 320,
  args: ["--headless"],
};

testApp("Application#evaluate (part 1)", async (app) => {
  const res1 = await app.evaluate(`2+3`);
  assertStrictEquals(res1, 5);

  const res2 = await app.evaluate(`"foo" + "bar"`);
  assertStrictEquals(res2, "foobar");

  const res3 = await app.evaluate(`[1,2,3].map(n => n * 2)`);
  assertEquals(res3, [2, 4, 6]);

  await assertThrowsAsync(() => app.evaluate(`throw fail`), EvaluateError);
}, options);

testApp("Application#evaluate (part 2)", async (app) => {
  for (
    const test of [
      { expr: ``, result: undefined },
      { expr: `42`, result: 42 },
      { expr: `2+3`, result: 5 },
      { expr: `(() => ({x: 5, y: 7}))()`, result: { "x": 5, "y": 7 } },
      { expr: `(() => ([1,'foo',false]))()`, result: [1, "foo", false] },
      { expr: `((a, b) => a*b)(3, 7)`, result: 21 },
      { expr: `Promise.resolve(42)`, result: 42 },
      { expr: `Promise.reject('foo')`, error: "foo" },
      { expr: `throw "bar"`, error: "bar" },
      { expr: `2+`, error: `SyntaxError: Unexpected end of input` },
    ]
  ) {
    try {
      const result = await app.evaluate(test.expr);
      assertEquals(result, test.result);
    } catch (error) {
      if (test.error == null) {
        throw error;
      }
      assertEquals(test.error, error.message);
      assert(
        error instanceof EvaluateError,
        "The error should be instanceof EvaluateError",
      );
    }
  }
}, options);

testApp("Application#exposeFunction (part 1)", async (app) => {
  await app.exposeFunction("add", (a: number, b: number) => a + b);
  await app.exposeFunction("rand", () => Math.random());
  await app.exposeFunction("strlen", (s: string) => s.length);
  await app.exposeFunction("atoi", (s: string) => parseInt(s));
  await app.exposeFunction("shouldFail", () => {
    throw "hello";
  });

  assertStrictEquals(await app.evaluate(`add(2, 3)`), 5);
  assertStrictEquals(typeof await app.evaluate(`rand()`), "number");
  assertStrictEquals(await app.evaluate(`strlen('foo')`), 3);
  assertStrictEquals(await app.evaluate(`atoi('123')`), 123);
  await assertThrowsAsync(
    () => app.evaluate("shouldFail()"),
    EvaluateError,
    "hello",
  );
}, options);

testApp("Application#exposeFunction (part 2)", async (app) => {
  await app.exposeFunction("add", (...args: unknown[]): number => {
    assertStrictEquals(args.length, 2, "2 arguments expected");
    assertStrictEquals(typeof args[0], "number");
    assertStrictEquals(typeof args[1], "number");
    const [a, b] = args as [number, number];
    return a + b;
  });
  const res = await app.evaluate(`window.add(2, 3)`);
  assertStrictEquals(res, 5);

  await assertThrowsAsync(
    () => app.evaluate(`window.add("foo", "bar")`),
    EvaluateError,
  );

  await assertThrowsAsync(
    () => app.evaluate(`window.add(1, 2, 3)`),
    EvaluateError,
  );
}, options);

test("Application#onExit", async () => {
  const app = await launch({
    width: 480,
    height: 320,
    args: ["--headless"],
  });

  let called = false;
  app.onExit().then(() => {
    called = true;
  });

  await delayWhenRunningInCI();
  await app.exit();

  assert(called);
});

testApp(
  "Application#serveFolder",
  async (app) => {
    const testdataFolder = join(
      dirname(fromFileUrl(import.meta.url)),
      "testdata",
      "folder",
    );
    app.serveFolder(testdataFolder);
    await app.load("index.html");
    // Wait for page load
    for (let i = 0; i < 10; i++) {
      const url = await app.evaluate("window.location.href");
      assertStrictEquals(typeof url, "string");
      if (url.startsWith("http://")) {
        break;
      }
    }
    const result = await app.evaluate("document.body.textContent");
    assertStrictEquals(result, "hello file");
  },
  options,
);

testApp(
  "Application#serveFolder with prefix",
  async (app) => {
    const testdataFolder = join(
      dirname(fromFileUrl(import.meta.url)),
      "testdata",
      "folder",
    );
    app.serveFolder(testdataFolder, "prefix");
    await app.load("prefix/index.html");
    await waitForPageLoad(app);
    const result = await app.evaluate("document.body.textContent");
    assertStrictEquals(result, "hello file");
  },
  options,
);

testApp(
  "Application#serveOrigin works",
  async (app) => {
    const port = 3000;
    const server = startFileServer(port);
    try {
      app.serveOrigin(`http://127.0.0.1:${port}`);
      await app.load("index.html");
      await waitForPageLoad(app);
      const result = await app.evaluate("document.body.textContent");
      assertStringIncludes(result, "hello http");
    } finally {
      await server.close();
    }
  },
  options,
);

testApp(
  "Application#serveOrigin: prefix is respected",
  async (app) => {
    const port = 3000;
    const server = startFileServer(port);
    try {
      app.serveOrigin(`http://127.0.0.1:${port}`, "prefix");
      await app.load("prefix/index.html");
      await waitForPageLoad(app);
      const result = await app.evaluate("document.body.textContent");
      assertStringIncludes(result, "hello http");
    } finally {
      await server.close();
    }
  },
  options,
);

testApp("Application#load", async (app) => {
  await app.load("data:text/html,<html><body>Hello</body></html>");

  // Wait for page load...
  for (let i = 0; i < 10; i++) {
    const url = await app.evaluate(`window.location.href`);
    assertStrictEquals(typeof url, "string", "url must be string");
    if (url.startsWith(`"data:text/html,`)) {
      break;
    }
  }

  const res = await app.evaluate(
    `document.body ? document.body.innerText :
    new Promise(res => window.onload = () => res(document.body.innerText))`,
  );

  assertStrictEquals(res, "Hello");
}, options);

test("custom executablePath", async () => {
  await assertThrowsAsync(async () => {
    await launch({
      executablePath: "/",
      width: 480,
      height: 320,
      args: ["--headless"],
    });
  }, Deno.errors.PermissionDenied); // TODO Is this correct? (PermissionDenied)
});
