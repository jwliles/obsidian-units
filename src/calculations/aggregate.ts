import { normalizeLabel, normalizeSigil } from './normalize';

export type AggregateFunction = 'sum' | 'count' | 'avg' | 'min' | 'max';
export interface AggregateFilter { negated: boolean; sigils: string[] }
export interface AggregateExpression { fn: AggregateFunction; scope: 'global' | 'local'; group: string; groupSource: string; filters: AggregateFilter[] }
export type AggregateParseOutcome = { kind: 'success'; node: AggregateExpression } | { kind: 'none' } | { kind: 'error'; message: string };

export function parseAggregate(source: string): AggregateParseOutcome {
	const trimmed = source.trim();
	const head = trimmed.match(/^([\p{L}]+)(::?)(.*)$/u);
	if (!head) {
		if (/^(?:sum|count|avg|min|max)\s*:/i.test(trimmed) || /^(?:sum|count|avg|min|max)\b/i.test(trimmed)) {
			return { kind: 'error', message: 'Malformed aggregate expression.' };
		}
		return { kind: 'none' };
	}
	const fn = head[1].toLowerCase();
	if (!['sum', 'count', 'avg', 'min', 'max'].includes(fn)) {
		return { kind: 'error', message: `Unknown aggregate function "${head[1]}".` };
	}
	const scope = head[2] === '::' ? 'local' : 'global';
	const filterStart = head[3].indexOf('{');
	const groupSource = (filterStart < 0 ? head[3] : head[3].slice(0, filterStart)).trim();
	const group = normalizeMembership(groupSource);
	if (!validMembership(group)) return { kind: 'error', message: 'Invalid aggregate group.' };

	const filters: AggregateFilter[] = [];
	let rest = filterStart < 0 ? '' : head[3].slice(filterStart);
	while (rest.length > 0) {
		const clause = rest.match(/^\{([^{}]*)\}/);
		if (!clause) return { kind: 'error', message: 'Malformed aggregate filter braces.' };
		if (!clause[1].trim()) return { kind: 'error', message: 'Aggregate filters cannot be empty.' };
		const terms = clause[1].split(',').map((term) => term.trim());
		const negative = terms.map((term) => term.startsWith('!'));
		if (negative.some(Boolean) && !negative.every(Boolean)) {
			return { kind: 'error', message: 'Positive and negative sigils cannot be mixed in one filter clause. Use {!gr,!ls} to exclude both, or separate clauses like {ls}{!gr} to combine polarities.' };
		}
		const sigils = terms.map((term) => normalizeMembership(term.replace(/^!/, '').trim()));
		if (sigils.some((sigil) => !validMembership(sigil))) return { kind: 'error', message: 'Invalid aggregate filter membership.' };
		filters.push({ negated: negative[0], sigils: Array.from(new Set(sigils)) });
		rest = rest.slice(clause[0].length);
	}
	return { kind: 'success', node: { fn: fn as AggregateFunction, scope, group, groupSource, filters } };
}

function normalizeMembership(value: string): string {
	return /\s/u.test(value) ? normalizeLabel(value) : normalizeSigil(value);
}

function validMembership(value: string): boolean {
	return value.length > 0 && !/[=:{},!|`]/u.test(value);
}
