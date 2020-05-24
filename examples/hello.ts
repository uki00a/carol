import { launch } from "../mod.ts";
import { serve } from "https://deno.land/std@0.51.0/http/server.ts";
import {
  join,
  fromFileUrl,
  dirname,
} from "https://deno.land/std@0.51.0/path/mod.ts";

const address = "127.0.0.1:8000";
const file = await Deno.readFile(
  fromFileUrl(join(dirname(import.meta.url), "index.html")),
);

(async () => {
  for await (const req of serve(address)) {
    req.respond({
      headers: new Headers([["Content-Type", "text/html"]]),
      body: file,
    });
  }
})();

const app = await launch({
  title: "Hello carol",
  width: 480,
  height: 320,
});

await app.exposeFunction("greet", (name: string) => `Hello, ${name}!`);
await app.load(`http://${address}`);
