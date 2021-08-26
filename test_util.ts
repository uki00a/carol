import { serve } from "./test_deps.ts";
import { join } from "./deps.ts";
import { locateChrome } from "./locate.ts";
import type { Application, AppOptions } from "./mod.ts";
import { launch } from "./mod.ts";

const chromeExecutable = await locateChrome();
const chromeDoesNotExist = !chromeExecutable;

export function testApp(
  name: string,
  fn: (app: Application) => Promise<void>,
  options: AppOptions,
): void {
  test(name, async () => {
    const app = await launch(options);
    try {
      await fn(app);
      await delayWhenRunningInCI();
    } finally {
      await app.exit();
    }
  });
}

// FIXME: Tests are flaky on CI. As a workaround, We put a short delay.
export async function delayWhenRunningInCI(): Promise<void> {
  if (Deno.env.get("CI")) {
    await delay(5000);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve, _) =>
    setTimeout(() => {
      resolve();
    }, ms)
  );
}

export function test(name: string, fn: () => Promise<void>): void {
  Deno.test({
    ignore: chromeDoesNotExist,
    name,
    fn: async () => {
      try {
        await fn();
      } finally {
        // FIXME `WebSocket#close seems not to remove a resource from ResourceTable...`
        const resources = Deno.resources() as Record<string, string>;
        for (const rid of Object.keys(resources)) {
          if (resources[rid] === "webSocketStream") {
            Deno.close(Number(rid));
          }
        }
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
      const body = await Deno.readFile(join("testdata/http", req.url));
      await req.respond({
        status: 200,
        body,
      });
    }
  })();
  return {
    async close() {
      server.close();
      await serverPromise;
    },
  };
}
