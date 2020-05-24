# Carol

[![Build Status](https://github.com/uki00a/carol/workflows/CI/badge.svg)](https://github.com/uki00a/carol/actions)
![https://img.shields.io/github/tag/uki00a/carol.svg](https://img.shields.io/github/tag/uki00a/carol.svg)
[![license](https://img.shields.io/github/license/uki00a/carol.svg)](https://github.com/uki00a/carol)
[![deno doc](https://doc.deno.land/badge.svg)](https://doc.deno.land/https/deno.land/x/carol/mod.ts)

**Note: This module is still work in progress**.

This module is made to build desktop applications using Deno and HTML.

It uses locally-installed Google Chrome to provide UI.

It's based on excellent works of [lorca](https://github.com/zserge/lorca) and [carlo](https://github.com/GoogleChromeLabs/carlo).

## Examples

```typescript
import { launch } from "https://deno.land/x/carol@v0.0.4/mod.ts";

const app = await launch({
  title: "Hello carol app!",
  width: 480,
  height: 320
});

app.onExit().then(() => Deno.exit(0));

await app.load("data:text/html,<div>Hello, world!</div>");
```

## License

- This module contains substantial parts based on other libraries. They have preserved their individual licenses and copyrights. Eveything is licensed under the MIT license.
- Additional work with this module is licensed under the MIT license.