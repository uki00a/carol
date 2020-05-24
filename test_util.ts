import { locateChrome } from "./locate.ts";

export const chromeExecutable = await locateChrome();
export const chromeDoesNotExist = !chromeExecutable;
