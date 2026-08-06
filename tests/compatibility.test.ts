import { strict as assert } from 'node:assert';
import { DEFAULT_SETTINGS, diagnoseConversion, evaluateCompatibilityExpression, evaluateInlineExpressionFallback, parseConversion } from '../main';
import { evaluateDocument } from '../src/document/evaluation-index';

const settings = { ...DEFAULT_SETTINGS, densities: [] };
const evaluate = (source: string, explicit = true) => evaluateInlineExpressionFallback(source, settings, new Map(), explicit);

// Representative conversion categories and command-style parsing without an inline marker.
for (const source of ['5 ft to cm', '2 cups to ml', '180 lb to kg', '72 F to C', '55 mph to km/h', '10 MiB to MB']) {
	assert.ok(parseConversion(source, settings), `Expected conversion: ${source}`);
	assert.ok(evaluate(source, false), `Command intent should evaluate: ${source}`);
}

// Inline modes, arithmetic compatibility, and plural consumption.
assert.match(evaluate('33 meters to feet | result')!.text, /feet/);
assert.match(evaluate('33 meters to feet | value')!.text, /^108\.2677$/);
assert.equal(evaluate('33 meters to feet | unit')!.text, 'feet');
assert.equal(evaluate('10 / 2 =')!.text, '5');
assert.equal(evaluate('2(3 + 4)')!.text, '14');
assert.equal(evaluate('33 ounces to gram')!.consumeTrailingS, true);

// Density conversion in both directions.
const densitySettings = { ...settings, densities: [{ name: 'maple syrup', value: 1.37, unit: 'g/ml' }] };
assert.ok(evaluateInlineExpressionFallback('1 tsp of maple syrup to g', densitySettings, new Map(), true));
assert.ok(evaluateInlineExpressionFallback('100 g of maple syrup to ml', densitySettings, new Map(), true));

// Specific conversion diagnostics flow through the shared document outcome.
assert.match(diagnoseConversion('5 mystery to cm', settings)!, /Unknown unit/);
assert.match(diagnoseConversion('1 tsp to g', settings)!, /without a material/);
assert.match(diagnoseConversion('1 tsp of unobtainium to g', settings)!, /Unknown material/);
assert.match(diagnoseConversion('1 m to kg', settings)!, /incompatible units/);

const diagnosticIndex = evaluateDocument('`=5 mystery to cm`', {
	formatNumber: String,
	evaluateCompatibility: (source, values) => evaluateCompatibilityExpression(source, values, settings),
});
const diagnostic = diagnosticIndex.entries()[0].outcome;
assert.equal(diagnostic.kind, 'error');
if (diagnostic.kind === 'error') {
	assert.equal(diagnostic.diagnostic.code, 'conversion-error');
	assert.match(diagnostic.diagnostic.message, /Unknown unit/);
}

console.log('All compatibility and diagnostic tests passed.');
