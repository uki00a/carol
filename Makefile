.PHONY: test lint

lint:
	deno fmt --check

test:
	deno test --allow-env --allow-read --allow-write --allow-run --allow-net