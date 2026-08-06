import { normalizeLabel, normalizeSigil } from './normalize';
import { Declaration, EvaluationDiagnostic } from './types';

const MAX_SIGIL_LENGTH = 64;

export type DeclarationParseOutcome =
	| { kind: 'none' }
	| { kind: 'success'; declaration: Declaration }
	| { kind: 'error'; diagnostic: EvaluationDiagnostic };

export function parseDeclaration(prefix: string, expressionSource: string, sourceOffset: number): DeclarationParseOutcome {
	const assignment = prefix.match(/(?:^|\n)([^\n]*?)\s+=\s*$/);
	if (!assignment) return { kind: 'none' };

	let raw = assignment[1].replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').trim();
	// Ledger dates and separators are presentation, not part of the declaration.
	const pipe = raw.lastIndexOf('|');
	if (pipe >= 0) raw = raw.slice(pipe + 1).trim();
	if (/`[^`\n]+`/.test(raw)) return error('multiple-declarations', 'Only one declaration is allowed per line.', sourceOffset);
	if (!raw) return error('invalid-declaration', 'A declaration requires a label.', sourceOffset);
	if (raw.includes('=')) return error('invalid-label', 'Variable labels cannot contain "=".', sourceOffset);

	const parts = raw.split(':');
	const label = parts.shift()!.trim();
	if (!label) return error('invalid-label', 'A declaration requires a non-empty label.', sourceOffset);
	if (label.includes(':')) return error('invalid-label', 'Literal colons are not supported in variable labels.', sourceOffset);

	const groups: string[] = [];
	for (const rawSigil of parts) {
		if (rawSigil !== rawSigil.trim()) {
			return error('invalid-label', 'Literal colons are not supported in variable labels; group sigils must attach directly to the label.', sourceOffset);
		}
		const sigil = normalizeSigil(rawSigil.trim());
		if (!sigil) return error('invalid-sigil', 'Group sigils cannot be empty.', sourceOffset);
		if (/\s|[=:{},!|`]/u.test(sigil) || Array.from(sigil).length > MAX_SIGIL_LENGTH) {
			return error('invalid-sigil', `Invalid group sigil "${rawSigil}".`, sourceOffset);
		}
		if (!groups.includes(sigil)) groups.push(sigil);
	}

	return {
		kind: 'success',
		declaration: { label, normalizedLabel: normalizeLabel(label), groups, localGroups: [...groups], expressionSource, sourceOffset },
	};
}

function error(code: string, message: string, offset: number): DeclarationParseOutcome {
	return { kind: 'error', diagnostic: { code, message, offset } };
}
