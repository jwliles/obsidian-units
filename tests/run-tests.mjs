import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const outdir = `/tmp/obsidian-units-tests-${process.pid}`;
await build({
	entryPoints: ['tests/calculations.test.ts', 'tests/compatibility.test.ts', 'tests/fixtures.test.ts', 'tests/local-scopes.acceptance.ts'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outdir,
	plugins: [{
		name: 'obsidian-test-stubs',
		setup(build) {
			build.onResolve({ filter: /^(obsidian|@codemirror\/state|@codemirror\/view)$/ }, () => ({
				path: new URL('./obsidian-stub.ts', import.meta.url).pathname,
			}));
		},
	}],
});
await import(pathToFileURL(`${outdir}/calculations.test.js`).href);
await import(pathToFileURL(`${outdir}/compatibility.test.js`).href);
await import(pathToFileURL(`${outdir}/fixtures.test.js`).href);
await import(pathToFileURL(`${outdir}/local-scopes.acceptance.js`).href);
