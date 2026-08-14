import { normalizeLabel } from './normalize';
import { EvaluatedValue } from './types';
import { DecimalValue, ExactDecimal } from './decimal';

export type ArithmeticOutcome = { kind: 'success'; value: number; exact: string; decimalPlaces: number } | { kind: 'error'; code: string; message: string };

export function evaluateArithmetic(source: string, variables: Map<string, EvaluatedValue>, variableLabels: Map<string, string> = new Map()): ArithmeticOutcome {
	const resolved = resolveVariables(source, variables);
	if (resolved.unknown) return { kind: 'error', code: 'unknown-variable', message: unknownVariableMessage(resolved.unknown, variables, variableLabels) };
	const parser = new Parser(resolved.expression);
	const value = parser.parse();
	if (value === null) return { kind: 'error', code: 'arithmetic-syntax', message: 'Malformed arithmetic expression.' };
	if (!value.isFinite()) return { kind: 'error', code: 'non-finite-result', message: 'The expression produced a non-finite result (possibly division by zero).' };
	const exact = value.isZero() ? '0' : value.toString();
	return { kind: 'success', value: Number(exact), exact, decimalPlaces: resolved.decimalPlaces };
}

function resolveVariables(source: string, variables: Map<string, EvaluatedValue>): { expression: string; unknown?: string; decimalPlaces: number } {
	let expression = source;
	let decimalPlaces = maximumLiteralDecimalPlaces(source);
	for (const [name, value] of Array.from(variables.entries()).sort((a, b) => b[0].length - a[0].length)) {
		if (value.kind !== 'number') continue;
		const pattern = name.split(/\s+/).map(escapeRegExp).join('\\s+');
		expression = expression.replace(new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`, 'giu'), (_m, prefix) => {
			decimalPlaces = Math.max(decimalPlaces, value.decimalPlaces);
			return `${prefix}(${value.exact ?? value.value.toString()})`;
		});
	}
	// Exponent markers are part of numeric literals, not variable identifiers.
	// Mask complete literals before looking for an unresolved name so `1.5e3+2`
	// reaches the arithmetic parser while a genuinely bare `e3` still errors.
	const identifierSource = expression.replace(
		/(^|[^\p{L}\p{N}_])((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/giu,
		(_match, prefix: string, literal: string) => `${prefix}${' '.repeat(literal.length)}`,
	);
	const identifier = identifierSource.match(/[\p{L}_][\p{L}\p{N}_ ]*/u)?.[0].trim();
	return identifier ? { expression, unknown: identifier, decimalPlaces } : { expression, decimalPlaces };
}

function unknownVariableMessage(raw: string, variables: Map<string, EvaluatedValue>, variableLabels: Map<string, string>): string {
	const name = normalizeLabel(raw);
	let best: { name: string; distance: number } | undefined;
	let tied = false;
	for (const known of variables.keys()) {
		const distance = damerauLevenshtein(name, known);
		if (!best || distance < best.distance) {
			best = { name: known, distance };
			tied = false;
		} else if (distance === best.distance) {
			tied = true;
		}
	}
	const accepted = best && !tied && (best.distance <= 1 || (best.distance === 2 && best.name.length >= 5));
	const suggestion = accepted && best ? ` Did you mean "${variableLabels.get(best.name) ?? best.name}"?` : '';
	return `Unknown variable "${raw}".${suggestion}`;
}

function damerauLevenshtein(a: string, b: string): number {
	const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
	for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
	for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
			}
		}
	}
	return matrix[a.length][b.length];
}

function maximumLiteralDecimalPlaces(source: string): number {
	let maximum = 0;
	for (const match of source.matchAll(/(?:^|[^\p{L}\p{N}_])(?:\d+(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?/giu)) {
		const mantissaPlaces = (match[1] ?? match[2] ?? '').length;
		const exponent = Number(match[3] ?? 0);
		maximum = Math.max(maximum, mantissaPlaces + Math.max(0, -exponent));
	}
	return maximum;
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

class Parser {
	private index = 0;
	constructor(private input: string) {}
	parse(): DecimalValue | null { const value = this.expression(); this.space(); return value !== null && this.index === this.input.length ? value : null; }
	private expression(): DecimalValue | null { let value = this.term(); if (value === null) return null; while (true) { this.space(); const op = this.peek(); if (op !== '+' && op !== '-') return value; this.index++; const rhs = this.term(); if (rhs === null) return null; value = op === '+' ? value.plus(rhs) : value.minus(rhs); } }
	private term(): DecimalValue | null { let value = this.power(); if (value === null) return null; while (true) { this.space(); const op = this.peek(); if (op !== '*' && op !== '/') { if (op !== '(') return value; const rhs = this.power(); if (rhs === null) return null; value = value.times(rhs); continue; } this.index++; const rhs = this.power(); if (rhs === null) return null; value = op === '*' ? value.times(rhs) : value.dividedBy(rhs); } }
	private power(): DecimalValue | null { const value = this.unary(); if (value === null) return null; this.space(); if (this.peek() !== '^') return value; this.index++; const rhs = this.power(); if (rhs === null) return null; try { return value.pow(rhs); } catch { return null; } }
	private unary(): DecimalValue | null { this.space(); const op = this.peek(); if (op !== '+' && op !== '-') return this.primary(); this.index++; const value = this.unary(); return value === null ? null : op === '-' ? value.negated() : value; }
	private primary(): DecimalValue | null { this.space(); if (this.peek() === '(') { this.index++; const value = this.expression(); this.space(); if (value === null || this.peek() !== ')') return null; this.index++; return value; } return this.number(); }
	private number(): DecimalValue | null { this.space(); const match = this.input.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i); if (!match) return null; this.index += match[0].length; try { return new ExactDecimal(match[0]); } catch { return null; } }
	private space() { while (/\s/.test(this.peek())) this.index++; }
	private peek() { return this.input[this.index] ?? ''; }
}
