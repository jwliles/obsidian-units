import { build } from "esbuild";
import { pathToFileURL } from "node:url";

const outdir = `/tmp/obsidian-quantities-tests-${process.pid}`;
await build({
	entryPoints: [
		"tests/calculations.test.ts",
		"tests/compatibility.test.ts",
		"tests/fixtures.test.ts",
		"tests/metadata.test.ts",
	],
	bundle: true,
	platform: "node",
	format: "esm",
	target: "es2022",
	outdir,
	plugins: [
		{
			name: "obsidian-test-stubs",
			setup(build) {
				build.onResolve(
					{ filter: /^(obsidian|@codemirror\/state|@codemirror\/view)$/ },
					() => ({
						path: new URL("./obsidian-stub.ts", import.meta.url).pathname,
					}),
				);
			},
		},
	],
});
await import(pathToFileURL(`${outdir}/calculations.test.js`).href);
const compatibilityTests = await import(
	pathToFileURL(`${outdir}/compatibility.test.js`).href
);
await compatibilityTests.compatibilityTestsComplete;
await import(pathToFileURL(`${outdir}/fixtures.test.js`).href);
await import(pathToFileURL(`${outdir}/metadata.test.js`).href);
