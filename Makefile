.PHONY: test lint example rpc_client

lint:
	deno fmt --check --ignore=LICENSE.md
	deno lint

test:
	RUST_BACKTRACE=1 deno test --allow-env --allow-read --allow-write --allow-run --allow-net --doc --import-map=import_map.test.json

example:
	deno run --allow-env --allow-read --allow-write --allow-run --allow-net examples/hello.ts

rpc_client:
	deno run --allow-read --allow-write --allow-run --allow-net ./tools/generate_rpc_client.ts
