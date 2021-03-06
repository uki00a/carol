import { launch } from "../mod.ts";
import { dirname, fromFileUrl, join } from "../deps.ts";

const app = await launch({
  title: "Hello carol",
  width: 480,
  height: 320,
});

app.onExit().then(() => Deno.exit(0));

await app.exposeFunction("greet", (name: string) => `Hello, ${name}!`);

if (import.meta.url.startsWith("file://")) {
  const folder = dirname(fromFileUrl(import.meta.url));
  app.serveFolder(folder);
  await app.load("index.html");
} else {
  const url = new URL(import.meta.url);
  app.serveOrigin(url.origin);
  await app.load(join(dirname(url.pathname), "index.html"));
}
