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
  const listener = Deno.listen({ port });
  const serverPromise = (async () => {
    for await (const conn of listener) {
      const httpConn = Deno.serveHttp(conn);
      const event = await httpConn.nextRequest();
      if (event == null) {
        conn.close();
        break;
      }
      const { request, respondWith } = event;
      const url = new URL(request.url);
      const body = await Deno.readFile(join("testdata/http", url.pathname));
      const resp = new Response(body);
      await respondWith(resp);
      httpConn.close();
    }
  })();
  return {
    async close() {
      listener.close();
      await serverPromise;
    },
  };
}
