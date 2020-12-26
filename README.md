# Carol

[![Build Status](https://github.com/uki00a/carol/workflows/ci/badge.svg)](https://github.com/uki00a/carol/actions)
![https://img.shields.io/github/tag/uki00a/carol.svg](https://img.shields.io/github/tag/uki00a/carol.svg)
[![license](https://img.shields.io/github/license/uki00a/carol.svg)](https://github.com/uki00a/carol)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/carol/mod.ts)

**Note: This module is still work in progress.**

Carol is a deno module to build desktop applications using Deno, HTML, and Google Chrome. This module is a port of [carlo](https://github.com/GoogleChromeLabs/carlo) to Deno.

## Requirements

- Deno🦕
- Google Chrome (Carol uses locally-installed Google Chrome to provide UI.)

## Examples

```typescript
import { launch } from "https://deno.land/x/carol@v0.0.9/mod.ts";
import { dirname, join } from "https://deno.land/std@0.70.0/path/mod.ts";

const app = await launch({
  title: "Hello Deno!",
  width: 480,
  height: 320
});

app.onExit().then(() => Deno.exit(0));

await app.exposeFunction("greet", (name: string) => `Hello, ${name}!`);
const folder = join(dirname(new URL(import.meta.url).pathname), "public");
app.serveFolder(folder); // Serve contents from "./public" folder
await app.load("index.html");
```

## Links

- [API Documentation](https://doc.deno.land/https/deno.land/x/carol/mod.ts)
- [carlo](https://github.com/GoogleChromeLabs/carlo)
- [lorca](https://github.com/zserge/lorca)

## License

- This module contains code adopted from the following projects. They have preserved their individual licenses and copyrights.
  - [carlo](https://github.com/GoogleChromeLabs/carlo)
  - [lorca](https://github.com/zserge/lorca)
- Additional work with this module is licensed under the MIT license.
