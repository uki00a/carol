.PHONY: test lint example rpc

lint:
	deno fmt --check
	deno lint --unstable

test:
	deno test --allow-env --allow-read --allow-write --allow-run --allow-net

example:
	deno run --allow-env --allow-read --allow-write --allow-run --allow-net examples/hello.ts

rpc:
	deno run --allow-read --allow-write ./tools/generate_rpc.ts