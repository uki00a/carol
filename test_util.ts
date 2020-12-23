import { serve, serveFile } from "./test_deps.ts";
import type { Server } from "./test_deps.ts";
import { Chrome, runChrome } from "./chrome.ts";
import { assert, deferred, join } from "./deps.ts";
import { locateChrome } from "./locate.ts";
import type { Application } from "./application.ts";
import { launch, LaunchOptions } from "./mod.ts";

const chromeExecutable = await locateChrome();
const chromeDoesNotExist = !chromeExecutable;

const defaultChromeArgs = [
  "--user-data-dir=/tmp",
  "--headless",
  "--remote-debugging-port=0",
];

export function testChrome(
  name: string,
  fn: (chrome: Chrome) => Promise<void>,
  args = defaultChromeArgs,
): void {
  Deno.test({
    ignore: chromeDoesNotExist,
    name,
    async fn() {
      const chrome = await runChrome({
        executable: chromeExecutable,
        args,
      });
      try {
        await fn(chrome);
      } finally {
        try {
          await chrome.exit();
        } catch (err) {
          // TODO(#17) Some tests fail frequently in CI (needs more investigation)
          assert(err instanceof Deno.errors.ConnectionReset);
        }
      }
    },
  });
}

export function testApp(
  name: string,
  fn: (app: Application) => Promise<void>,
  options: LaunchOptions,
): void {
  Deno.test({
    ignore: chromeDoesNotExist,
    name,
    async fn() {
      const app = await launch(options);
      try {
        await fn(app);
      } finally {
        try {
          await app.exit();
        } catch (err) {
          // TODO(#17) Some tests fail frequently in CI (needs more investigation)
          assert(err instanceof Deno.errors.ConnectionReset);
        }
      }
    },
  });
}

export function test(name: string, fn: () => Promise<void>): void {
  Deno.test({
    ignore: chromeDoesNotExist,
    name,
    async fn() {
      try {
        await fn();
      } catch (err) {
        // TODO(#17) Some tests fail frequently in CI (needs more investigation)
        assert(err instanceof Deno.errors.ConnectionReset);
      }
    },
  });
}

interface FileServer {
  close(): Promise<void>;
}

export function startFileServer(port: number): FileServer {
  const server = serve({ port });
  const serverPromise = (async () => {
    for await (const req of server) {
      await req.respond(await serveFile(req, join("testdata/http", req.url)));
    }
  })();
  return {
    async close() {
      server.close();
      await serverPromise;
    },
  };
}
