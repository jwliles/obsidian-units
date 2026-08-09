import { strict as assert } from 'node:assert';
import { parseAggregate } from '../src/calculations/aggregate';
import { parseDeclaration } from '../src/calculations/declarations';
import { parseExpression } from '../src/calculations/expression-parser';
import { evaluateDocument } from '../src/document/evaluation-index';
import { scanInlineCode } from '../src/document/scanner';
import { concealDeclarationSigils, shouldConcealStructuralMarkerInReadingView } from '../main';

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
assert.equal(parseDeclaration('prose: label = ', '10', 0).kind, 'error');
assert.equal(parseDeclaration('first = `=1` second = ', '2', 0).kind, 'error');

// Aggregate grammar.
assert.equal(parseAggregate('sum:ex{ob,ls}{!late}').kind, 'success');
assert.equal(parseAggregate('median:ex').kind, 'success');
assert.equal(parseAggregate('sum:>').kind, 'success');
assert.equal(parseAggregate('sum::ex').kind, 'error');
const localAggregate = parseAggregate('sum@CAC{!late}');
assert.equal(localAggregate.kind, 'success');
if (localAggregate.kind === 'success') {
	assert.equal(localAggregate.node.scope, 'local');
	assert.equal(localAggregate.node.group, 'cac');
	assert.equal(localAggregate.node.groupSource, 'CAC');
}
const localAst = parseExpression('sum@ex{gr}');
assert.equal(localAst.kind, 'success');
if (localAst.kind === 'success') {
	assert.equal(localAst.node.kind, 'aggregate');
	if (localAst.node.kind === 'aggregate') assert.equal(localAst.node.scope, 'local');
}
const scalarAst = parseExpression('CAC * 2');
assert.equal(scalarAst.kind, 'success');
if (scalarAst.kind === 'success') assert.equal(scalarAst.node.kind, 'scalar');
const aggregateContainingAst = parseExpression('sum:ex + 10');
assert.equal(aggregateContainingAst.kind, 'success');
if (aggregateContainingAst.kind === 'success' && aggregateContainingAst.node.kind === 'scalar') {
	assert.equal(aggregateContainingAst.node.aggregates.length, 1);
}
const compactAggregateContainingAst = parseExpression('sum:ex+10');
assert.equal(compactAggregateContainingAst.kind, 'success');
if (compactAggregateContainingAst.kind === 'success' && compactAggregateContainingAst.node.kind === 'scalar') {
	assert.equal(compactAggregateContainingAst.node.aggregates.length, 1);
	assert.equal(compactAggregateContainingAst.node.aggregates[0].node.group, 'ex');
}
assert.equal(parseDeclaration('Cost:bad-name = ', '10', 0).kind, 'error');
assert.equal(parseAggregate('sum:ex{ob,!late}').kind, 'error');
const mixedFilter = parseAggregate('sum:ex{ob,!late}');
if (mixedFilter.kind === 'error') assert.match(mixedFilter.message, /separate clauses/);
assert.equal(parseAggregate('sum:ex{}').kind, 'error');
assert.equal(parseAggregate('unknown:ex').kind, 'error');
assert.equal(parseAggregate('sum:ex{ob').kind, 'error');
const labelHistoryAggregate = parseAggregate('sum:Running total');
assert.equal(labelHistoryAggregate.kind, 'success');
if (labelHistoryAggregate.kind === 'success') assert.equal(labelHistoryAggregate.node.group, 'running total');

// Reassignment updates lookup but retains every group member.
const repeated = [
	'Vendor:ex:gr = `=60.00`',
	'Vendor:ex:gr = `=25.00`',
	'latest = `=Vendor`',
	'expense total = `=sum:ex`',
].join('\n');
assert.equal(successValue(repeated, 2), 25);
assert.equal(successValue(repeated, 3), 85);
assert.equal(successValue('A:ex = `=10`\nB = `=sum:ex+5`', 1), 15);
assert.equal(successValue('Budget = `=20`\nA:ex = `=7`\nB = `=Budget-sum:ex`', 2), 13);

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
for (const fn of ['sum', 'count', 'avg', 'median', 'min', 'max']) {
	const unknownGroup = outcomes(`\`=${fn}:none\``)[0];
	assert.equal(unknownGroup.kind, 'error');
	if (unknownGroup.kind === 'error') assert.equal(unknownGroup.diagnostic.code, 'unknown-group');
}
const emptyFiltered = outcomes('item:known = `=1`\n`=sum:known{missing}`\n`=count:known{missing}`');
assert.equal(emptyFiltered[1].kind === 'success' ? emptyFiltered[1].display : '', '0');
assert.equal(emptyFiltered[2].kind === 'success' ? emptyFiltered[2].display : '', '0');
for (const fn of ['avg', 'median', 'min', 'max']) assert.equal(outcomes(`item:known = \`=1\`\n\`=${fn}:known{missing}\``)[1].kind, 'error');
const typo = outcomes('CPI = `=330.30`\nratio = `=CIP / 299.97`')[1];
assert.equal(typo.kind, 'error');
if (typo.kind === 'error') {
	assert.equal(typo.diagnostic.code, 'unknown-variable');
	assert.match(typo.diagnostic.message, /Did you mean "CPI"/);
}
const implicitHistory = outcomes('Walmart = `=10`\n`=sum:Walmart`')[1];
assert.equal(implicitHistory.kind, 'success');
if (implicitHistory.kind === 'success') assert.equal(implicitHistory.value.value, 10);
const noSuggestion = outcomes('tiny = `=zq * 2`')[0];
assert.equal(noSuggestion.kind, 'error');
if (noSuggestion.kind === 'error') assert.doesNotMatch(noSuggestion.diagnostic.message, /Did you mean/);
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

const failedShortName = outcomes('a:t = `=5.00`\ntotal:t = `=sum:t`\nrunning total = `=sum:t`\ndoubled = `=running total * 2`');
assert.equal(failedShortName[3].kind, 'success');
if (failedShortName[3].kind === 'success') assert.equal(failedShortName[3].value.value, 10);

const customMarker = evaluateDocument('CAC = `=200`\nTotal = `~CAC + 1`\nGood = `~2`', {
	...options,
	marker: '~',
	incorrectMarkers: ['='],
}).entries().map((entry) => entry.outcome);
assert.equal(customMarker[0].kind, 'error');
if (customMarker[0].kind === 'error') assert.equal(customMarker[0].diagnostic.code, 'incorrect-marker');
assert.equal(customMarker[1].kind, 'error');
if (customMarker[1].kind === 'error') assert.equal(customMarker[1].diagnostic.code, 'unbound-variable');
assert.equal(customMarker[2].kind, 'success');

assert.deepEqual(scanInlineCode('`=1`\n<!-- `=2` -->\n```md\n`=3`\n```\n`=4`').map((span) => span.content), ['=1', '=4']);

const structuralDocument = evaluateDocument('`=Top`\nA = `=2`\n`=BOTTOM`\n`=sum:>`', options);
assert.deepEqual(structuralDocument.structures().map((entry) => entry.node.kind), ['region-top', 'region-bottom']);
const structuralResult = structuralDocument.entries()[3].outcome;
assert.equal(structuralResult.kind === 'success' ? structuralResult.value.value : NaN, 2);
assert.equal(evaluateDocument('`=top`', options).diagnostics()[0]?.code, 'unclosed-region');
assert.equal(shouldConcealStructuralMarkerInReadingView(true), true);
assert.equal(shouldConcealStructuralMarkerInReadingView(true, { severity: 'warning' }), false);
assert.equal(shouldConcealStructuralMarkerInReadingView(false), false);
assert.equal(concealDeclarationSigils('Cost:ex:food = '), 'Cost = ');
assert.equal(concealDeclarationSigils(' | Cost:ex:food = '), ' | Cost = ');
assert.equal(concealDeclarationSigils('Cost = '), 'Cost = ');
assert.equal(concealDeclarationSigils('Prose: remains visible'), 'Prose: remains visible');

const localFunctions = outcomes('A:g = `=1.00`\nB:g = `=3.00`\n`=avg@g`\n`=min@g`\n`=max@g`');
assert.equal(localFunctions[2].kind === 'success' ? localFunctions[2].value.value : NaN, 2);
assert.equal(localFunctions[3].kind === 'success' ? localFunctions[3].value.value : NaN, 1);
assert.equal(localFunctions[4].kind === 'success' ? localFunctions[4].value.value : NaN, 3);
if (localFunctions[2].kind === 'success') {
	assert.deepEqual(localFunctions[2].value.provenance?.localAccumulationIds, ['local:g:1']);
}

console.log('All grouped calculation tests passed.');
