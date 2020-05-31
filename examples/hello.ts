import { launch } from "../mod.ts";
import { dirname } from "../deps.ts";

const app = await launch({
  title: "Hello carol",
  width: 480,
  height: 320,
});

app.onExit().then(() => Deno.exit(0));

await app.exposeFunction("greet", (name: string) => `Hello, ${name}!`);
const folder = dirname(new URL(import.meta.url).pathname);
app.serveFolder(folder);
await app.load(`index.html`);
