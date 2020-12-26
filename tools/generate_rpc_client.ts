import {
  decode,
  dirname,
  encode,
  encodeToBase64,
  fromFileUrl,
  join,
} from "../deps.ts";
// @deno-types="https://unpkg.com/typescript@4.0.3/lib/typescript.d.ts"
import { default as ts } from "https://jspm.dev/typescript@4.0.3/lib/typescript.js";

async function transpileRpcModule(rootDir: string): Promise<string> {
  const source = await Deno.readTextFile(join(rootDir, "rpc/rpc.ts"));
  return transpile(source);
}

// TODO Use Deno.transpileOnly
async function transpile(source: string): Promise<string> {
  const result = await ts.transpileModule(
    source,
    {
      compilerOptions: {
        removeComments: true,
        module: ts.ModuleKind.CommonJS,
      },
    },
  );
  if (result.diagnostics && result.diagnostics.length > 0) {
    // TODO Format diagnostics
    throw new Error("Compilation failed");
  }
  return result.outputText;
}

function validateOutput(output: string): void {
  if (/require\(.+\)/.test(output)) {
    throw new Error("rpc/rpc.ts should not import any modules");
  }
}

async function formatSource(source: string): Promise<string> {
  const deno = Deno.run({
    cmd: [Deno.execPath(), "fmt", "-"],
    stdin: "piped",
    stdout: "piped",
  });
  await Deno.writeAll(deno.stdin, encode(source));
  deno.stdin.close();
  const formattedSource = await Deno.readAll(deno.stdout);
  deno.stdout.close();
  deno.close();
  return decode(formattedSource);
}

async function main(): Promise<void> {
  const __dirname = dirname(fromFileUrl(import.meta.url));
  const rootDir = join(__dirname, "..");
  const output = await transpileRpcModule(rootDir);
  validateOutput(output);
  await Deno.writeTextFile(
    join(rootDir, "rpc.client.ts"),
    await formatSource(
      `export const BASE64_ENCODED_RPC_CLIENT_SOURCE = "${
        encodeToBase64(output)
      }";`,
    ), // Maybe we should escape `output`...
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
