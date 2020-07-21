/**
 * Substantial parts adapted from https://github.com/zserge/lorca/blob/a3e43396a47ea152501d3453514c7f373cea530a/chrome_test.go
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

import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrowsAsync,
} from "./deps.ts";
import { EvaluateError } from "./chrome.ts";
import { testChrome } from "./test_util.ts";
const { test } = Deno;

testChrome("Chrome#evaluate", async (chrome) => {
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
      const result = await chrome.evaluate(test.expr);
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
});

testChrome("Chrome#load", async (chrome) => {
  await chrome.load("data:text/html,<html><body>Hello</body></html>");

  for (let i = 0; i < 10; i++) {
    const url = await chrome.evaluate(`window.location.href`);
    assertStrictEquals(typeof url, "string", "url must be string");
    if (url.startsWith(`"data:text/html,`)) {
      break;
    }
  }

  const res = await chrome.evaluate(
    `document.body ? document.body.innerText :
    new Promise(res => window.onload = () => res(document.body.innerText))`,
  );

  assertStrictEquals(res, "Hello");
});

testChrome("Chrome#bind", async (chrome) => {
  await chrome.bind("add", (args: any[]): number => {
    assertStrictEquals(args.length, 2, "2 arguments expected");
    assertStrictEquals(typeof args[0], "number");
    assertStrictEquals(typeof args[1], "number");
    const [a, b] = args;
    return a + b;
  });
  const res = await chrome.evaluate(`window.add(2, 3)`);
  assertStrictEquals(res, 5);

  await assertThrowsAsync(
    () => chrome.evaluate(`window.add("foo", "bar")`),
    EvaluateError,
  );

  await assertThrowsAsync(
    () => chrome.evaluate(`window.add(1, 2, 3)`),
    EvaluateError,
  );
});
