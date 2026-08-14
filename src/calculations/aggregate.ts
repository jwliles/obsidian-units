import { normalizeLabel, normalizeSigil } from './normalize';

export type AggregateFunction = 'sum' | 'count' | 'avg' | 'median' | 'min' | 'max' | 'list';
export type AggregateScope = 'global' | 'local' | 'regional';
export interface AggregateFilter { negated: boolean; sigils: string[] }
export interface AggregateExpression { fn: AggregateFunction; scope: AggregateScope; group: string; groupSource: string; filters: AggregateFilter[]; resultCollection: boolean }
export interface AggregateOccurrence { node: AggregateExpression; from: number; to: number }
export type AggregateParseOutcome = { kind: 'success'; node: AggregateExpression } | { kind: 'none' } | { kind: 'error'; code?: string; message: string };

const FUNCTIONS = ['sum', 'count', 'avg', 'median', 'min', 'max', 'list'] as const;
const RESERVED = new Set(['top', 'bottom']);

export function parseAggregate(source: string): AggregateParseOutcome {
	const trimmed = source.trim();
	const anyHead = trimmed.match(/^([\p{L}]+)(@|:>|::?)/u);
	if (anyHead && !(FUNCTIONS as readonly string[]).includes(anyHead[1].toLowerCase())) {
		return error(`Unknown aggregate function "${anyHead[1]}".`);
	}
	if (/^(?:sum|count|avg|median|min|max|list)::/i.test(trimmed)) return error('Malformed aggregate expression.');
	for (const clause of trimmed.matchAll(/\{([^{}]*)\}/g)) {
		if (!clause[1].trim()) return error('Aggregate filters cannot be empty.');
		const terms = clause[1].split(',').map((term) => term.trim());
		const negative = terms.map((term) => term.startsWith('!'));
		if (negative.some(Boolean) && !negative.every(Boolean)) {
			return error('Positive and negative sigils cannot be mixed in one filter clause. Use {!gr,!ls} to exclude both, or separate clauses like {ls}{!gr} to combine polarities.');
		}
		if (terms.some((term) => RESERVED.has(normalizeMembership(term.replace(/^!/, '').trim())))) {
			return error('"top" and "bottom" are reserved for regional structure.', 'reserved-identifier');
		}
	}
	const namedTarget = trimmed.match(/^(?:sum|count|avg|median|min|max|list)(?:@|:)(?!>)([^{}+\-*/^)]+)/i)?.[1].trim();
	if (namedTarget && RESERVED.has(normalizeMembership(namedTarget))) {
		return error('"top" and "bottom" are reserved for regional structure.', 'reserved-identifier');
	}
	const leading = source.length - source.trimStart().length;
	const parsed = parseAggregateAt(source, leading);
	if (!parsed) {
		if (/^(?:sum|count|avg|median|min|max|list)(?:\b|[:@])/i.test(trimmed)) return error('Malformed aggregate expression.');
		return { kind: 'none' };
	}
	if (source.slice(parsed.to).trim()) return error('Malformed aggregate expression.');
	return { kind: 'success', node: parsed.node };
}

export function findAggregateOccurrences(source: string): AggregateOccurrence[] {
	const occurrences: AggregateOccurrence[] = [];
	const startPattern = /\b(?:sum|count|avg|median|min|max|list)(?=[:@])/giu;
	for (const match of source.matchAll(startPattern)) {
		const from = match.index ?? 0;
		const parsed = parseAggregateAt(source, from);
		if (parsed) occurrences.push({ node: parsed.node, from, to: parsed.to });
	}
	return occurrences.filter((item, index) => index === 0 || item.from >= occurrences[index - 1].to);
}

function parseAggregateAt(source: string, from: number): AggregateOccurrence | null {
	const input = source.slice(from);
	const head = input.match(/^([\p{L}]+)(@|:>|:)(?!:)/u);
	if (!head) return null;
	const fn = head[1].toLowerCase();
	if (!(FUNCTIONS as readonly string[]).includes(fn)) return null;
	const scope: AggregateScope = head[2] === '@' ? 'local' : head[2] === ':>' ? 'regional' : 'global';
	let index = head[0].length;
	let groupSource = '';
	let group = '';
	let resultCollection = false;

	if (scope === 'regional') {
		if (input.slice(index, index + 2) === '[]') {
			if (fn === 'list') return null;
			resultCollection = true;
			index += 2;
		} else {
			const rest = input.slice(index);
			let end = rest.length;
			const filter = rest.indexOf('{');
			if (filter >= 0) end = Math.min(end, filter);
			const closeParen = rest.indexOf(')');
			if (closeParen >= 0) end = Math.min(end, closeParen);
			const operator = rest.search(/[+\-*/^]/u);
			if (operator >= 0) end = Math.min(end, operator);
			groupSource = rest.slice(0, end).trim();
			group = groupSource ? normalizeMembership(groupSource) : '';
			if (groupSource && !validMembership(group)) return null;
			index += end;
			while (/\s/u.test(input[index] ?? '')) index++;
		}
	} else {
		const rest = input.slice(index);
		let end = rest.length;
		const filter = rest.indexOf('{');
		if (filter >= 0) end = Math.min(end, filter);
		const closeParen = rest.indexOf(')');
		if (closeParen >= 0) end = Math.min(end, closeParen);
		const operator = rest.search(/[+\-*/^]/u);
		if (operator >= 0) end = Math.min(end, operator);
		groupSource = rest.slice(0, end).trim();
		group = normalizeMembership(groupSource);
		if (!validMembership(group)) return null;
		index += end;
		while (/\s/u.test(input[index] ?? '')) index++;
	}

	const filters: AggregateFilter[] = [];
	while (input[index] === '{') {
		const close = input.indexOf('}', index + 1);
		if (close < 0) return null;
		const content = input.slice(index + 1, close);
		if (!content.trim()) return null;
		const terms = content.split(',').map((term) => term.trim());
		const negative = terms.map((term) => term.startsWith('!'));
		if (negative.some(Boolean) && !negative.every(Boolean)) return null;
		const sigils = terms.map((term) => normalizeMembership(term.replace(/^!/, '').trim()));
		if (sigils.some((sigil) => !validMembership(sigil) || RESERVED.has(sigil))) return null;
		filters.push({ negated: negative[0], sigils: Array.from(new Set(sigils)) });
		index = close + 1;
	}

	return { node: { fn: fn as AggregateFunction, scope, group, groupSource, filters, resultCollection }, from, to: from + index };
}

function normalizeMembership(value: string): string {
	return /\s/u.test(value) ? normalizeLabel(value) : normalizeSigil(value);
}

function validMembership(value: string): boolean {
	return value.length > 0 && !RESERVED.has(value) && !/[=:{},!|`+\-*/^()]/u.test(value);
}

function error(message: string, code?: string): AggregateParseOutcome {
	return { kind: 'error', code, message };
}
