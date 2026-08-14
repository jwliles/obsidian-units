import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { DEFAULT_SETTINGS, evaluateCompatibilityExpression, formatNumber } from '../main';
import { evaluateDocument } from '../src/document/evaluation-index';

const fixtureFiles = readdirSync('tests')
	.filter((name) => /^\d{2}-.*\.md$/.test(name))
	.sort()
	.map((name) => `tests/${name}`);

const failures: string[] = [];
let assertions = 0;

for (const file of fixtureFiles) {
	const source = readFileSync(file, 'utf8');
	const index = evaluateDocument(source, {
		marker: '=',
		formatNumber: formatFixtureNumber,
		evaluateCompatibility: (expression, values) => evaluateCompatibilityExpression(expression, values, DEFAULT_SETTINGS),
	});
	const structures = new Map(index.structures().map((entry) => [entry.source.from, entry.node.kind]));
	const diagnostics = new Map(index.diagnostics().map((item) => [item.offset, item]));
	let fileAssertions = 0;
	for (const entry of index.entries()) {
		const followingLines = source.slice(entry.source.to).split('\n');
		const commentSource = followingLines[0].includes('<!--')
			? followingLines[0]
			: followingLines[1]?.trimStart().startsWith('<!--') ? followingLines[1] : '';
		const expected = commentSource.match(/<!--\s*expect:(value|empty|error|structure|warning)(?:\s+(.+?))?\s*-->/i);
		if (!expected) continue;

		assertions++;
		fileAssertions++;
		const description = `${file}:${lineAt(source, entry.source.from)} ${entry.source.content}`;
		const expectation = expected[1].toLowerCase();
		if (expectation === 'value' || expectation === 'empty') {
			const expectedDisplay = expectation === 'empty' ? '' : expected[2];
			if (entry.outcome.kind !== 'success') {
				failures.push(`${description}: expected ${expectation === 'empty' ? 'an empty value' : `value ${expectedDisplay}`}, got ${describeOutcome(entry.outcome)}`);
			} else if (entry.outcome.display !== expectedDisplay) {
				failures.push(`${description}: expected value ${expectedDisplay || '<empty>'}, got ${entry.outcome.display || '<empty>'}`);
			}
		} else if (expectation === 'structure') {
			const actual = structures.get(entry.source.from);
			if (actual !== expected[2]) failures.push(`${description}: expected structure ${expected[2]}, got ${actual ?? 'none'}`);
		} else if (expectation === 'warning') {
			const actual = diagnostics.get(entry.source.from);
			if (!actual || actual.severity !== 'warning' || actual.code !== expected[2]) {
				failures.push(`${description}: expected warning ${expected[2]}, got ${actual ? `${actual.severity} ${actual.code}` : 'none'}`);
			}
		} else if (entry.outcome.kind !== 'error') {
			failures.push(`${description}: expected error ${expected[2]}, got ${describeOutcome(entry.outcome)}`);
		} else if (entry.outcome.diagnostic.code !== expected[2]) {
			failures.push(`${description}: expected error ${expected[2]}, got ${entry.outcome.diagnostic.code}`);
		}
	}
	assert.ok(fileAssertions > 0, `${file} contains no executable expectations`);
}

assert.ok(assertions >= 200, `Expected at least 200 fixture assertions, found ${assertions}`);
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

function formatFixtureNumber(value: number | string, minimumDecimalPlaces = 0): string {
	return formatNumber(value, 4, minimumDecimalPlaces);
}
