import { join } from "./deps.ts";
import { locateChrome } from "./locate.ts";

const chromeExecutable = await locateChrome();
const chromeDoesNotExist = !chromeExecutable;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function test(
  name: string,
  fn: (t: Deno.TestContext) => Promise<void>,
): void {
  Deno.test({
    ignore: chromeDoesNotExist,
    permissions: {
      env: ["CI"],
      read: true,
      write: true,
      run: [chromeExecutable],
      net: true,
    },
    name,
    fn: async (t) => {
      try {
        await fn(t);
      } finally {
        // FIXME: Workaround for flaky tests...
        if (Deno.env.get("CI")) {
          await sleep(5000);
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
