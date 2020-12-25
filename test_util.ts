import { serve, serveFile } from "./test_deps.ts";
import { join } from "./deps.ts";
import { locateChrome } from "./locate.ts";
import type { Application, LaunchOptions } from "./mod.ts";
import { launch } from "./mod.ts";

const chromeExecutable = await locateChrome();
const chromeDoesNotExist = !chromeExecutable;

export function testApp(
  name: string,
  fn: (app: Application) => Promise<void>,
  options: LaunchOptions,
): void {
  test(name, async () => {
    const app = await launch(options);
    try {
      await fn(app);
    } finally {
      await app.exit();
      if (Deno.env.get("CI")) {
        await new Promise<void>((resolve, _) =>
          setTimeout(() => {
            resolve();
          }, 1000)
        );
      }
    }
  });
}

export function test(name: string, fn: () => Promise<void>): void {
  Deno.test({
    // TODO `WebSocket#close seems not to remove a resource from ResourceTable...`
    sanitizeResources: false,
    ignore: chromeDoesNotExist,
    name,
    fn,
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
