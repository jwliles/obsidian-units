import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, evaluateCompatibilityExpression } from '../main';
import { evaluateDocument } from '../src/document/evaluation-index';

const fixtureFiles = [
	'tests/01-namespaces-and-duplicate-labels.md',
	'tests/02-filter-matrix.md',
	'tests/03-scope-and-errors.md',
];

let assertions = 0;
for (const file of fixtureFiles) {
	const source = readFileSync(file, 'utf8');
	const index = evaluateDocument(source, {
		marker: '=',
		formatNumber: formatFixtureNumber,
		evaluateCompatibility: (expression, values) => evaluateCompatibilityExpression(expression, values, DEFAULT_SETTINGS),
	});
	for (const entry of index.entries()) {
		const followingLines = source.slice(entry.source.to).split('\n');
		const commentSource = followingLines[0].includes('<!--')
			? followingLines[0]
			: followingLines[1]?.trimStart().startsWith('<!--') ? followingLines[1] : '';
		const comment = commentSource.match(/<!--\s*(ERROR\s*:)?\s*([^>]*?)\s*-->/i);
		if (!comment) continue;
		if (comment[1]) {
			assert.equal(entry.outcome.kind, 'error', `${file}: expected an error for ${entry.source.content}`);
			assertions++;
			continue;
		}
		const expectedValue = comment[2].match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))/)?.[1];
		if (expectedValue === undefined) continue;
		assert.equal(entry.outcome.kind, 'success', `${file}: expected success for ${entry.source.content}`);
		if (entry.outcome.kind === 'success') {
			assert.equal(entry.outcome.display, expectedValue, `${file}: unexpected display for ${entry.source.content}`);
		}
		assertions++;
	}
}

assert.ok(assertions >= 30, `Expected at least 30 fixture assertions, found ${assertions}`);
console.log(`All Markdown fixtures passed (${assertions} assertions).`);

function formatFixtureNumber(value: number, minimumDecimalPlaces = 0): string {
	let display = value.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
	if (minimumDecimalPlaces === 0) return display;
	const point = display.indexOf('.');
	if (point < 0) return `${display}.${'0'.repeat(minimumDecimalPlaces)}`;
	const present = display.length - point - 1;
	if (present < minimumDecimalPlaces) display += '0'.repeat(minimumDecimalPlaces - present);
	return display;
}
