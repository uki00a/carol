.PHONY: test
test:
	deno test --allow-env --allow-read --allow-run --allow-net ./chrome_test.ts