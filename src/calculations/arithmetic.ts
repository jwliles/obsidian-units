import { normalizeLabel } from './normalize';
import { EvaluatedValue } from './types';

export type ArithmeticOutcome = { kind: 'success'; value: number } | { kind: 'error'; code: string; message: string };

export function evaluateArithmetic(source: string, variables: Map<string, EvaluatedValue>): ArithmeticOutcome {
	const resolved = resolveVariables(source, variables);
	if (resolved.unknown) return { kind: 'error', code: 'unknown-variable', message: unknownVariableMessage(resolved.unknown, variables) };
	const parser = new Parser(resolved.expression);
	const value = parser.parse();
	if (value === null) return { kind: 'error', code: 'arithmetic-syntax', message: 'Malformed arithmetic expression.' };
	if (!Number.isFinite(value)) return { kind: 'error', code: 'non-finite-result', message: 'The expression produced a non-finite result (possibly division by zero).' };
	return { kind: 'success', value };
}

function resolveVariables(source: string, variables: Map<string, EvaluatedValue>): { expression: string; unknown?: string } {
	let expression = source;
	for (const [name, value] of Array.from(variables.entries()).sort((a, b) => b[0].length - a[0].length)) {
		if (value.kind !== 'number') continue;
		const pattern = name.split(/\s+/).map(escapeRegExp).join('\\s+');
		expression = expression.replace(new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`, 'giu'), (_m, prefix) => `${prefix}(${value.value})`);
	}
	const identifier = expression.match(/[\p{L}_][\p{L}\p{N}_ ]*/u)?.[0].trim();
	return identifier ? { expression, unknown: identifier } : { expression };
}

function unknownVariableMessage(raw: string, variables: Map<string, EvaluatedValue>): string {
	const name = normalizeLabel(raw);
	let best: { name: string; distance: number } | undefined;
	for (const known of variables.keys()) {
		const distance = levenshtein(name, known);
		if (!best || distance < best.distance) best = { name: known, distance };
	}
	const suggestion = best && best.distance <= Math.max(2, Math.floor(name.length / 3)) ? ` Did you mean "${best.name}"?` : '';
	return `Unknown variable "${raw}".${suggestion}`;
}

function levenshtein(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let previous = row[0]; row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1)); previous = old;
		}
	}
	return row[b.length];
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

class Parser {
	private index = 0;
	constructor(private input: string) {}
	parse(): number | null { const value = this.expression(); this.space(); return value !== null && this.index === this.input.length ? value : null; }
	private expression(): number | null { let value = this.term(); if (value === null) return null; while (true) { this.space(); const op = this.peek(); if (op !== '+' && op !== '-') return value; this.index++; const rhs = this.term(); if (rhs === null) return null; value = op === '+' ? value + rhs : value - rhs; } }
	private term(): number | null { let value = this.power(); if (value === null) return null; while (true) { this.space(); const op = this.peek(); if (op !== '*' && op !== '/') { if (op !== '(') return value; const rhs = this.power(); if (rhs === null) return null; value *= rhs; continue; } this.index++; const rhs = this.power(); if (rhs === null) return null; value = op === '*' ? value * rhs : value / rhs; } }
	private power(): number | null { const value = this.unary(); if (value === null) return null; this.space(); if (this.peek() !== '^') return value; this.index++; const rhs = this.power(); return rhs === null ? null : Math.pow(value, rhs); }
	private unary(): number | null { this.space(); const op = this.peek(); if (op !== '+' && op !== '-') return this.primary(); this.index++; const value = this.unary(); return value === null ? null : op === '-' ? -value : value; }
	private primary(): number | null { this.space(); if (this.peek() === '(') { this.index++; const value = this.expression(); this.space(); if (value === null || this.peek() !== ')') return null; this.index++; return value; } return this.number(); }
	private number(): number | null { this.space(); const match = this.input.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i); if (!match) return null; this.index += match[0].length; return Number(match[0]); }
	private space() { while (/\s/.test(this.peek())) this.index++; }
	private peek() { return this.input[this.index] ?? ''; }
}
