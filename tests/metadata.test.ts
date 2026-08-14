import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const packageMetadata = JSON.parse(readFileSync('package.json', 'utf8'));
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));

assert.equal(manifest.id, 'obsidian-quantities');
assert.equal(manifest.name, 'Obsidian Quantities');
assert.equal(packageMetadata.name, manifest.id);
assert.equal(packageMetadata.version, manifest.version);
assert.equal(packageMetadata.description, manifest.description);
assert.equal(versions[manifest.version], manifest.minAppVersion);

for (const file of ['README.md', 'MANUAL.md', 'SEMANTICS.md', 'DESIGN_RECORD.md', 'main.ts', 'styles.css']) {
	const source = readFileSync(file, 'utf8');
	assert.doesNotMatch(source, /Obsidian Units|obsidian-units|ObsidianUnits/);
}

console.log('All plugin metadata tests passed.');
