import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, evaluateCompatibilityExpression } from '../main';
import { evaluateDocument } from '../src/document/evaluation-index';

const fixtureFiles = [
	'tests/01-membership-and-declaration-identity.md',
	'tests/02-filter-matrix.md',
	'tests/03-scope-and-errors.md',
	'tests/04-local-scopes.md',
	'tests/05-local-accumulations.md',
	'tests/06-august-ledger.md',
];

const failures: string[] = [];
let assertions = 0;

for (const file of fixtureFiles) {
	const source = readFileSync(file, 'utf8');
	const index = evaluateDocument(source, {
		marker: '=',
		formatNumber: formatFixtureNumber,
		evaluateCompatibility: (expression, values) => evaluateCompatibilityExpression(expression, values, DEFAULT_SETTINGS),
	});
	let fileAssertions = 0;
	for (const entry of index.entries()) {
		const followingLines = source.slice(entry.source.to).split('\n');
		const commentSource = followingLines[0].includes('<!--')
			? followingLines[0]
			: followingLines[1]?.trimStart().startsWith('<!--') ? followingLines[1] : '';
		const expected = commentSource.match(/<!--\s*expect:(value|error)\s+([^\s>]+)/i);
		if (!expected) continue;

		assertions++;
		fileAssertions++;
		const description = `${file}:${lineAt(source, entry.source.from)} ${entry.source.content}`;
		if (expected[1].toLowerCase() === 'value') {
			if (entry.outcome.kind !== 'success') {
				failures.push(`${description}: expected value ${expected[2]}, got ${describeOutcome(entry.outcome)}`);
			} else if (entry.outcome.display !== expected[2]) {
				failures.push(`${description}: expected value ${expected[2]}, got ${entry.outcome.display}`);
			}
		} else if (entry.outcome.kind !== 'error') {
			failures.push(`${description}: expected error ${expected[2]}, got ${describeOutcome(entry.outcome)}`);
		} else if (entry.outcome.diagnostic.code !== expected[2]) {
			failures.push(`${description}: expected error ${expected[2]}, got ${entry.outcome.diagnostic.code}`);
		}
	}
	assert.ok(fileAssertions > 0, `${file} contains no executable expectations`);
}

assert.ok(assertions >= 70, `Expected at least 70 fixture assertions, found ${assertions}`);
if (failures.length) {
	throw new assert.AssertionError({
		message: `${failures.length} of ${assertions} fixture assertions failed:\n${failures.join('\n')}`,
		actual: failures.length,
		expected: 0,
		operator: 'fixture specification',
	});
}

console.log(`All Markdown fixtures passed (${assertions} assertions across ${fixtureFiles.length} files).`);

function lineAt(source: string, offset: number): number {
	return source.slice(0, offset).split('\n').length;
}

function describeOutcome(outcome: ReturnType<ReturnType<typeof evaluateDocument>['outcomeAt']>): string {
	if (!outcome) return 'no outcome';
	if (outcome.kind === 'success') return `value ${outcome.display}`;
	if (outcome.kind === 'error') return `error ${outcome.diagnostic.code}`;
	return 'not-applicable';
}

function formatFixtureNumber(value: number, minimumDecimalPlaces = 0): string {
	let display = value.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
	if (minimumDecimalPlaces === 0) return display;
	const point = display.indexOf('.');
	if (point < 0) return `${display}.${'0'.repeat(minimumDecimalPlaces)}`;
	const present = display.length - point - 1;
	if (present < minimumDecimalPlaces) display += '0'.repeat(minimumDecimalPlaces - present);
	return display;
}
