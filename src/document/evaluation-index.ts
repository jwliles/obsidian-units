import { AggregateExpression, parseAggregate } from '../calculations/aggregate';
import { evaluateArithmetic } from '../calculations/arithmetic';
import { parseDeclaration } from '../calculations/declarations';
import { DocumentEvaluationIndex, EvaluatedValue, EvaluationContext, EvaluationOutcome, GroupMember, InlineSource } from '../calculations/types';
import { scanInlineCode } from './scanner';

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
	formatNumber(value: number, minimumDecimalPlaces?: number): string;
	evaluateCompatibility?(source: string, variables: Map<string, EvaluatedValue>): CompatibilityEvaluation | CompatibilityDiagnostic | null;
	marker?: string;
	incorrectMarkers?: string[];
}

export function evaluateDocument(sourceText: string, options: DocumentEngineOptions): DocumentEvaluationIndex {
	const context: EvaluationContext = { variables: new Map(), variableLabels: new Map(), groups: new Map() };
	const records: Array<{ source: InlineSource; outcome: EvaluationOutcome }> = [];
	const byOffset = new Map<number, EvaluationOutcome>();
	const declarations = new Map<number, InlineSource['declaration']>();
	const unboundDeclarations = new Map<string, string>();
	const marker = options.marker ?? '=';
	const incorrectMarkers = (options.incorrectMarkers ?? []).filter((candidate) => candidate && candidate !== marker);

	for (const span of scanInlineCode(sourceText)) {
		const from = span.from;
		const inline: InlineSource = { ...span };
		const trimmedContent = span.content.trimStart();
		if (!trimmedContent.startsWith(marker)) {
			const incorrectMarker = incorrectMarkers.find((candidate) => trimmedContent.startsWith(candidate));
			if (incorrectMarker) {
				const staleExpression = trimmedContent.slice(incorrectMarker.length).trim();
				const staleDeclaration = parseDeclaration(sourceText.slice(0, from), staleExpression, from);
				if (staleDeclaration.kind === 'success') {
					inline.declaration = staleDeclaration.declaration;
					declarations.set(from, inline.declaration);
					unboundDeclarations.set(inline.declaration.normalizedLabel, inline.declaration.label);
					add(inline, diagnostic('incorrect-marker', `Incorrect Units marker "${incorrectMarker}". This vault uses "${marker}".`, from));
					continue;
				}
			}
			add(inline, { kind: 'not-applicable' });
			continue;
		}

		const expressionSource = trimmedContent.slice(marker.length).trim();
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
				unboundDeclarations.set(inline.declaration.normalizedLabel, inline.declaration.label);
				continue;
			}
			const compatibility = options.evaluateCompatibility?.(expressionSource, context.variables);
			if (compatibility?.kind === 'success') {
				outcome = { kind: 'success', value: compatibility.value, display: compatibility.display, consumeTrailingS: compatibility.consumeTrailingS };
			} else if (compatibility?.kind === 'error') {
				outcome = diagnostic(compatibility.code, compatibility.message, from);
			} else {
				const arithmetic = evaluateArithmetic(expressionSource.replace(/\s*=\s*$/, ''), context.variables, context.variableLabels);
				if (arithmetic.kind === 'success') {
					outcome = {
						kind: 'success',
						value: { kind: 'number', value: arithmetic.value, decimalPlaces: arithmetic.decimalPlaces },
						display: options.formatNumber(arithmetic.value, arithmetic.decimalPlaces),
					};
				} else {
					const unbound = arithmetic.code === 'unknown-variable'
						? Array.from(unboundDeclarations.entries()).find(([name]) => referencesLabel(expressionSource, name))
						: undefined;
					outcome = unbound
						? diagnostic('unbound-variable', `Variable "${unbound[1]}" is declared but has no calculated value.`, from)
						: diagnostic(arithmetic.code, arithmetic.message, from);
				}
			}
		}

		if (inline.declaration) {
			if (outcome.kind === 'success') {
				declare(inline.declaration, outcome.value, context);
				unboundDeclarations.delete(inline.declaration.normalizedLabel);
			} else {
				unboundDeclarations.set(inline.declaration.normalizedLabel, inline.declaration.label);
			}
		}
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
	context.variableLabels.set(declaration.normalizedLabel, declaration.label);
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
	if (!context.groups.has(node.group)) {
		const variableLabel = context.variableLabels.get(node.group);
		const hint = variableLabel
			? ` "${variableLabel}" is a variable; aggregates operate on group sigils. Tag entries with a sigil or reference "${options.marker ?? '='}${variableLabel}".`
			: '';
		return diagnostic('unknown-group', `Unknown group "${node.groupSource}".${hint}`, offset);
	}
	let members = context.groups.get(node.group) ?? [];
	members = members.filter((member) => node.filters.every((filter) => {
		const matches = filter.sigils.some((sigil) => member.groups.includes(sigil));
		return filter.negated ? !matches : matches;
	}));
	const quantity = members.find((member) => member.value.kind === 'quantity');
	if (quantity) return diagnostic('quantity-aggregate', `Group "${node.group}" contains unit-bearing declaration "${quantity.label}".`, offset);
	const values = members.map((member) => member.value.value);
	const decimalPlaces = node.fn === 'count'
		? 0
		: members.reduce((maximum, member) => member.value.kind === 'number' ? Math.max(maximum, member.value.decimalPlaces) : maximum, 0);
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
	return { kind: 'success', value: { kind: 'number', value, decimalPlaces }, display: options.formatNumber(value, decimalPlaces) };
}

function diagnostic(code: string, message: string, offset: number): EvaluationOutcome {
	return { kind: 'error', diagnostic: { code, message, offset } };
}
