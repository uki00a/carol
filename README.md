# Carol

**Note: This module is still work in progress**.

This module is made to build desktop applications using Deno and HTML.

It uses locally-installed Google Chrome to provide UI.

It's based on excellent works of [lorca](https://github.com/zserge/lorca) and [carlo](https://github.com/GoogleChromeLabs/carlo).

## Examples

```typescript
import { launch } from "https://deno.land/x/carol@v0.0.2/mod.ts";

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