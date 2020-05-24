# Carol

Note: This module is **still work in progress**.

This module is based on excellent works of [lorca](https://github.com/zserge/lorca) and [carlo](https://github.com/GoogleChromeLabs/carlo).

## Examples

```typescript
import { launch } from "../mod.ts";

const app = await launch({
  title: "Hello carol app!",
  width: 480,
  height: 320
});

await app.load("data:text/html,<div>Hello, world!</div>");
```

## License

- This module contains substantial parts based on other libraries. They have preserved their individual licenses and copyrights. Eveything is licensed under the MIT license.
- Additional work with this module is licensed under the MIT license.