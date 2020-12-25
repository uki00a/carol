import { dirname, encodeToBase64, fromFileUrl, join } from "../deps.ts";
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

async function main(): Promise<void> {
  const __dirname = dirname(fromFileUrl(import.meta.url));
  const rootDir = join(__dirname, "..");
  const output = await transpileRpcModule(rootDir);
  validateOutput(output);
  await Deno.writeTextFile(
    join(rootDir, "rpc.out.ts"),
    `export default "${encodeToBase64(output)}";`, // Maybe we should escape `output`...
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
