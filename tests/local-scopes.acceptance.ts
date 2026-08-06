/**
 * Pending local-scope evaluator acceptance test.
 *
 * This file is type-checked by the production build but is intentionally not
 * imported by run-tests.mjs until local accumulation evaluation is
 * implemented. Calling runLocalScopeAcceptance now should fail, which keeps
 * the desired behavior executable without breaking the existing regression
 * gate before implementation begins.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, evaluateCompatibilityExpression } from '../main';
import { evaluateDocument } from '../src/document/evaluation-index';

export function runLocalScopeAcceptance(): void {
	const source = readFileSync('tests/04-local-scopes.md', 'utf8');
	const index = evaluateDocument(source, {
		marker: '=',
		formatNumber: formatNumber,
		evaluateCompatibility: (expression, values) => evaluateCompatibilityExpression(expression, values, DEFAULT_SETTINGS),
	});
	let assertions = 0;
	for (const entry of index.entries()) {
		const remainder = source.slice(entry.source.to).split('\n')[0];
		const expected = remainder.match(/<!--\s*expect:(value|error)\s+([^\s>]+)/i);
		if (!expected) continue;
		if (expected[1].toLowerCase() === 'value') {
			assert.equal(entry.outcome.kind, 'success', `Expected local success for ${entry.source.content}`);
			if (entry.outcome.kind === 'success') assert.equal(entry.outcome.display, expected[2]);
		} else {
			assert.equal(entry.outcome.kind, 'error', `Expected local error for ${entry.source.content}`);
			if (entry.outcome.kind === 'error') assert.equal(entry.outcome.diagnostic.code, expected[2]);
		}
		assertions++;
	}
	assert.ok(assertions >= 10, `Expected at least 10 local-scope assertions, found ${assertions}`);
}

function formatNumber(value: number, minimumDecimalPlaces = 0): string {
	let result = value.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
	if (minimumDecimalPlaces === 0) return result;
	const point = result.indexOf('.');
	if (point < 0) return `${result}.${'0'.repeat(minimumDecimalPlaces)}`;
	const present = result.length - point - 1;
	if (present < minimumDecimalPlaces) result += '0'.repeat(minimumDecimalPlaces - present);
	return result;
}
