import { strict as assert } from 'node:assert';
import { parseAggregate } from '../src/calculations/aggregate';
import { parseDeclaration } from '../src/calculations/declarations';
import { evaluateDocument } from '../src/document/evaluation-index';

const options = { formatNumber: (value: number) => String(value) };

function outcomes(source: string) {
	return evaluateDocument(source, options).entries().map((entry) => entry.outcome);
}

function displays(source: string) {
	return outcomes(source).map((outcome) => outcome.kind === 'success' ? outcome.display : outcome.kind);
}

function successValue(source: string, index: number): number {
	const outcome = outcomes(source)[index];
	if (outcome.kind !== 'success') throw new Error(`Expected success, got ${outcome.kind}`);
	if (outcome.value.kind !== 'number') throw new Error('Expected a number');
	return outcome.value.value;
}

// Explicit ownership and declarations.
assert.deepEqual(displays('Use `npm run build`.\n`=2 + 3 * 4`'), ['not-applicable', '14']);
const declaration = parseDeclaration('Hourly rate:PAY:bonus:pay = ', '24.50', 10);
assert.equal(declaration.kind, 'success');
if (declaration.kind === 'success') {
	assert.equal(declaration.declaration.label, 'Hourly rate');
	assert.deepEqual(declaration.declaration.groups, ['pay', 'bonus']);
}
assert.equal(parseDeclaration('invalid=name = ', '10', 0).kind, 'error');
assert.equal(parseDeclaration('name: = ', '10', 0).kind, 'error');

// Aggregate grammar.
assert.equal(parseAggregate('sum:ex{ob,ls}{!late}').kind, 'success');
assert.equal(parseAggregate('sum:ex{ob,!late}').kind, 'error');
assert.equal(parseAggregate('sum:ex{}').kind, 'error');
assert.equal(parseAggregate('unknown:ex').kind, 'error');
assert.equal(parseAggregate('sum:ex{ob').kind, 'error');

// Reassignment updates lookup but retains every group member.
const repeated = [
	'Vendor:ex:gr = `=60.00`',
	'Vendor:ex:gr = `=25.00`',
	'latest = `=Vendor`',
	'expense total = `=sum:ex`',
].join('\n');
assert.equal(successValue(repeated, 2), 25);
assert.equal(successValue(repeated, 3), 85);

// Positive and negated filters partition the base group.
const income = [
	'paycheck:ic = `=645.45`',
	'bonus:ic:bonus = `=723.98`',
	'regular income = `=sum:ic{!bonus}`',
	'bonus income = `=sum:ic{bonus}`',
	'total income = `=sum:ic`',
].join('\n');
assert.equal(successValue(income, 2), 645.45);
assert.equal(successValue(income, 3), 723.98);
assert.equal(successValue(income, 4), 1369.43);

// Clause-scoped NOT and repeated-clause AND.
const filters = [
	'A:ex:ob = `=10`',
	'B:ex:ls:late = `=20`',
	'C:ex:gr = `=30`',
	'`=sum:ex{!ob,!ls}`',
	'`=sum:ex{ob,ls}{!late}`',
].join('\n');
assert.equal(successValue(filters, 3), 30);
assert.equal(successValue(filters, 4), 10);

// Empty identities/errors, forward scope, suggestions, and aggregate group rejection.
assert.deepEqual(displays('`=sum:none`\n`=count:none`'), ['0', '0']);
for (const fn of ['avg', 'min', 'max']) assert.equal(outcomes(`\`=${fn}:none\``)[0].kind, 'error');
const typo = outcomes('CPI = `=330.30`\nratio = `=CIP / 299.97`')[1];
assert.equal(typo.kind, 'error');
if (typo.kind === 'error') {
	assert.equal(typo.diagnostic.code, 'unknown-variable');
	assert.match(typo.diagnostic.message, /Did you mean "cpi"/);
}
assert.equal(outcomes('total:ex = `=sum:ex`')[0].kind, 'error');
assert.equal(outcomes('later = `=future`\nfuture = `=2`')[0].kind, 'error');

const quantityDocument = evaluateDocument('length:measure = `=1 m to cm`\n`=sum:measure`', {
	...options,
	evaluateCompatibility: (source) => source.includes(' to ')
		? { kind: 'success', value: { kind: 'quantity', value: 100, unit: 'cm', dimension: 'length' }, display: '1 meter = 100 centimeters' }
		: null,
});
assert.equal(quantityDocument.entries()[1].outcome.kind, 'error');
const circular = outcomes('self = `=self + 1`')[0];
assert.equal(circular.kind, 'error');
if (circular.kind === 'error') assert.equal(circular.diagnostic.code, 'circular-reference');
const divideByZero = outcomes('`=1 / 0`')[0];
assert.equal(divideByZero.kind, 'error');
if (divideByZero.kind === 'error') assert.equal(divideByZero.diagnostic.code, 'non-finite-result');

console.log('All grouped calculation tests passed.');
