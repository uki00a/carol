import { launch } from "../mod.ts";

const app = await launch({
  title: "Hello carol",
  width: 480,
  height: 320,
});

await app.load("data:text/html,<div>Hello, world!</div>");
