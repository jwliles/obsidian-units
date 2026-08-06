import { AggregateExpression, parseAggregate } from '../calculations/aggregate';
import { evaluateArithmetic } from '../calculations/arithmetic';
import { parseDeclaration } from '../calculations/declarations';
import { DocumentEvaluationIndex, EvaluatedValue, EvaluationContext, EvaluationOutcome, GroupMember, InlineSource } from '../calculations/types';

export interface CompatibilityEvaluation {
	kind: 'success';
	value: EvaluatedValue;
	display: string;
	consumeTrailingS?: boolean;
}

export interface CompatibilityDiagnostic {
	kind: 'error';
	code: string;
	message: string;
}

export interface DocumentEngineOptions {
	formatNumber(value: number): string;
	evaluateCompatibility?(source: string, variables: Map<string, EvaluatedValue>): CompatibilityEvaluation | CompatibilityDiagnostic | null;
}

export function evaluateDocument(sourceText: string, options: DocumentEngineOptions): DocumentEvaluationIndex {
	const context: EvaluationContext = { variables: new Map(), groups: new Map() };
	const records: Array<{ source: InlineSource; outcome: EvaluationOutcome }> = [];
	const byOffset = new Map<number, EvaluationOutcome>();
	const declarations = new Map<number, InlineSource['declaration']>();
	const pattern = /`([^`\n]+)`/g;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(sourceText)) !== null) {
		const from = match.index;
		const inline: InlineSource = { from, to: from + match[0].length, content: match[1] };
		if (!/^\s*=/.test(match[1])) {
			add(inline, { kind: 'not-applicable' });
			continue;
		}

		const expressionSource = match[1].replace(/^\s*=\s*/, '').trim();
		const parsedDeclaration = parseDeclaration(sourceText.slice(0, from), expressionSource, from);
		if (parsedDeclaration.kind === 'error') {
			inline.declarationDiagnostic = parsedDeclaration.diagnostic;
			add(inline, { kind: 'error', diagnostic: parsedDeclaration.diagnostic });
			continue;
		}
		if (parsedDeclaration.kind === 'success') {
			inline.declaration = parsedDeclaration.declaration;
			declarations.set(from, inline.declaration);
		}

		const aggregate = parseAggregate(expressionSource);
		let outcome: EvaluationOutcome;
		if (aggregate.kind === 'error') {
			outcome = diagnostic('aggregate-syntax', aggregate.message, from);
		} else if (aggregate.kind === 'success') {
			outcome = evaluateAggregate(aggregate.node, context, options, from);
			if (inline.declaration && inline.declaration.groups.length > 0 && outcome.kind === 'success') {
				outcome = diagnostic('aggregate-group-membership', 'Aggregate results cannot be attached to groups.', from);
			}
		} else {
			if (inline.declaration && !context.variables.has(inline.declaration.normalizedLabel) && referencesLabel(expressionSource, inline.declaration.normalizedLabel)) {
				outcome = diagnostic('circular-reference', `Declaration "${inline.declaration.label}" cannot reference itself before it has a value.`, from);
				add(inline, outcome);
				continue;
			}
			const compatibility = options.evaluateCompatibility?.(expressionSource, context.variables);
			if (compatibility?.kind === 'success') {
				outcome = { kind: 'success', value: compatibility.value, display: compatibility.display, consumeTrailingS: compatibility.consumeTrailingS };
			} else if (compatibility?.kind === 'error') {
				outcome = diagnostic(compatibility.code, compatibility.message, from);
			} else {
				const arithmetic = evaluateArithmetic(expressionSource.replace(/\s*=\s*$/, ''), context.variables);
				outcome = arithmetic.kind === 'success'
					? { kind: 'success', value: { kind: 'number', value: arithmetic.value }, display: options.formatNumber(arithmetic.value) }
					: diagnostic(arithmetic.code, arithmetic.message, from);
			}
		}

		if (outcome.kind === 'success' && inline.declaration) declare(inline.declaration, outcome.value, context);
		add(inline, outcome);
	}

	return {
		outcomeAt: (offset) => byOffset.get(offset),
		declarationAt: (offset) => declarations.get(offset),
		entries: () => records,
	};

	function add(source: InlineSource, outcome: EvaluationOutcome) {
		records.push({ source, outcome });
		byOffset.set(source.from, outcome);
	}
}

function referencesLabel(expression: string, normalizedLabel: string): boolean {
	const escaped = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
	return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu')
		.test(expression.normalize('NFKC').toLocaleLowerCase());
}

function declare(declaration: NonNullable<InlineSource['declaration']>, value: EvaluatedValue, context: EvaluationContext) {
	context.variables.set(declaration.normalizedLabel, value);
	const member: GroupMember = { label: declaration.label, value, groups: declaration.groups, sourceOffset: declaration.sourceOffset };
	for (const group of declaration.groups) {
		const members = context.groups.get(group) ?? [];
		members.push(member);
		context.groups.set(group, members);
	}
}

function evaluateAggregate(
	node: AggregateExpression,
	context: EvaluationContext,
	options: DocumentEngineOptions,
	offset: number,
): EvaluationOutcome {
	let members = context.groups.get(node.group) ?? [];
	members = members.filter((member) => node.filters.every((filter) => {
		const matches = filter.sigils.some((sigil) => member.groups.includes(sigil));
		return filter.negated ? !matches : matches;
	}));
	const quantity = members.find((member) => member.value.kind === 'quantity');
	if (quantity) return diagnostic('quantity-aggregate', `Group "${node.group}" contains unit-bearing declaration "${quantity.label}".`, offset);
	const values = members.map((member) => member.value.value);
	let value: number;
	switch (node.fn) {
		case 'count': value = values.length; break;
		case 'sum': value = values.reduce((sum, item) => sum + item, 0); break;
		case 'avg':
			if (!values.length) return diagnostic('empty-aggregate', 'Cannot average an empty selection.', offset);
			value = values.reduce((sum, item) => sum + item, 0) / values.length; break;
		case 'min':
		case 'max':
			if (!values.length) return diagnostic('empty-aggregate', `Cannot take ${node.fn} of an empty selection.`, offset);
			value = node.fn === 'min' ? Math.min(...values) : Math.max(...values); break;
	}
	return { kind: 'success', value: { kind: 'number', value }, display: options.formatNumber(value) };
}

function diagnostic(code: string, message: string, offset: number): EvaluationOutcome {
	return { kind: 'error', diagnostic: { code, message, offset } };
}
