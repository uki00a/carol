.PHONY: test lint example rpc_client

lint:
	deno fmt --check
	deno lint --unstable

test:
	deno test --allow-env --allow-read --allow-write --allow-run --allow-net

example:
	deno run --allow-env --allow-read --allow-write --allow-run --allow-net examples/hello.ts

rpc_client:
	deno run --allow-read --allow-write --allow-run ./tools/generate_rpc_client.ts
