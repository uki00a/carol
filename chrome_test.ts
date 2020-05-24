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


import { assertEquals } from "./deps.ts";
import { runChrome, EvaluateError } from "./chrome.ts";
import { locateChrome } from "./locate.ts";
import { assert } from "https://deno.land/std@0.51.0/testing/asserts.ts";
const { test } = Deno;

//const test = async (opts: {
//  ignore: boolean,
//  name: string,
//  fn: () => Promise<void>
//}): Promise<void> => {
//  try {
//    await opts.fn();
//  } finally {
//
//  }
//};

const chromeExecutable = await locateChrome();
const ignore = !chromeExecutable;

test({
  ignore,
  name: "Chrome#evaluate",
  async fn(){
    const chrome = await runChrome({
      executable: chromeExecutable,
      args: ["--user-data-dir=/tmp", "--headless", "--remote-debugging-port=0"]
    });
    try {
	    for (const test of [
        //{expr: ``, result: ``},
	    	{expr: `42`, result: `42`},
	    	{expr: `2+3`, result: `5`},
	    	{expr: `(() => ({x: 5, y: 7}))()`, result: `{"x":5,"y":7}`},
	    	{expr: `(() => ([1,'foo',false]))()`, result: `[1,"foo",false]`},
	    	{expr: `((a, b) => a*b)(3, 7)`, result: `21`},
	    	{expr: `Promise.resolve(42)`, result: `42`},
	    	{expr: `Promise.reject('foo')`, error: `"foo"`},
	    	{expr: `throw "bar"`, error: `"bar"`},
        {expr: `2+`, error: `SyntaxError: Unexpected end of input`},
	    ]) {
        try {
          const result = await chrome.evaluate(test.expr);
          assertEquals(result, test.result);
        } catch (error) {
          if (test.error == null) {
            throw error;
          }
          assertEquals(test.error, error.message);
          assert(error instanceof EvaluateError, "The error should be instanceof EvaluateError");
        }
      }
    } finally {
      chrome.exit();
    }
  }
});
