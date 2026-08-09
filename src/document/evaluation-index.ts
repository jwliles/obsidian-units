import { AggregateExpressionNode, ScalarExpressionNode, StructuralNode } from '../calculations/ast';
import { evaluateArithmetic } from '../calculations/arithmetic';
import { parseDeclaration } from '../calculations/declarations';
import { parseExpression } from '../calculations/expression-parser';
import { DocumentEvaluationIndex, EvaluatedDeclaration, EvaluatedValue, EvaluationContext, EvaluationDiagnostic, EvaluationOutcome, InlineSource } from '../calculations/types';
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

const RESERVED_NAMES = new Set(['top', 'bottom']);
type ErrorOutcome = Extract<EvaluationOutcome, { kind: 'error' }>;

export function evaluateDocument(sourceText: string, options: DocumentEngineOptions): DocumentEvaluationIndex {
	const context: EvaluationContext = {
		variables: new Map(),
		variableLabels: new Map(),
		groups: new Map(),
		local: { active: new Map(), completed: new Map(), nextOrdinal: new Map() },
		regional: { nextOrdinal: 1 },
	};
	const records: Array<{ source: InlineSource; outcome: EvaluationOutcome }> = [];
	const structures: Array<{ source: InlineSource; node: StructuralNode }> = [];
	const documentDiagnostics: Array<EvaluationDiagnostic & { severity: 'warning' | 'error' }> = [];
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
					add(inline, diagnostic('incorrect-marker', `Incorrect Quantities marker "${incorrectMarker}". This vault uses "${marker}".`, from));
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

		const structural = !inline.declaration ? parseStructural(expressionSource) : undefined;
		if (structural) {
			const structuralError = applyStructural(structural, context, from);
			if (structuralError) {
				documentDiagnostics.push({ ...structuralError.diagnostic, severity: 'error' });
				add(inline, structuralError);
			} else {
				structures.push({ source: inline, node: structural });
				add(inline, { kind: 'not-applicable' });
			}
			continue;
		}

		const parsedExpression = parseExpression(expressionSource);
		let outcome: EvaluationOutcome;
		let containsAggregate = false;
		let localGroupsToClose: string[] = [];
		if (parsedExpression.kind === 'error') {
			outcome = diagnostic(parsedExpression.code, parsedExpression.message, from);
		} else if (parsedExpression.node.kind === 'aggregate') {
			containsAggregate = true;
			outcome = evaluateAggregate(parsedExpression.node, context, options, from);
			localGroupsToClose = parsedExpression.node.scope === 'local' ? [parsedExpression.node.group] : [];
			if (inline.declaration && aggregateConflictsWithDeclaration(parsedExpression.node, inline.declaration) && outcome.kind === 'success') {
				outcome = diagnostic('aggregate-group-membership', 'An aggregate result cannot join the group it is currently aggregating.', from);
			}
		} else {
			containsAggregate = parsedExpression.node.aggregates.length > 0;
			if (inline.declaration && !context.variables.has(inline.declaration.normalizedLabel) && referencesLabel(expressionSource, inline.declaration.normalizedLabel)) {
				outcome = diagnostic('circular-reference', `Declaration "${inline.declaration.label}" cannot reference itself before it has a value.`, from);
				add(inline, outcome);
				unboundDeclarations.set(inline.declaration.normalizedLabel, inline.declaration.label);
				continue;
			}
			const reserved = reservedIdentifier(expressionSource);
			if (reserved) {
				outcome = diagnostic('reserved-identifier', `"${reserved}" is reserved for regional structure.`, from);
			} else {
				const scalar = evaluateScalar(parsedExpression.node, context, options, from);
				const unbound = scalar.outcome.kind === 'error' && scalar.outcome.diagnostic.code === 'unknown-variable'
					? Array.from(unboundDeclarations.entries()).find(([name]) => referencesLabel(expressionSource, name))
					: undefined;
				outcome = unbound
					? diagnostic('unbound-variable', `Variable "${unbound[1]}" is declared but has no calculated value.`, from)
					: scalar.outcome;
				localGroupsToClose = scalar.localGroups;
			}
		}

		if (inline.declaration && parsedExpression.kind === 'success') {
			const conflicts = parsedExpression.node.kind === 'scalar'
				? parsedExpression.node.aggregates.some((item) => aggregateConflictsWithDeclaration(item.node, inline.declaration!))
				: false;
			if (conflicts && outcome.kind === 'success') {
				outcome = diagnostic('aggregate-group-membership', 'An aggregate result cannot join a group it is currently aggregating.', from);
			}
		}

		if (outcome.kind === 'success') {
			for (const group of Array.from(new Set(localGroupsToClose))) {
				completeLocalAccumulation(group, context, from, inline.declaration ? `declaration@${inline.declaration.sourceOffset}` : undefined);
			}
		}

		if (inline.declaration) {
			if (outcome.kind === 'success') {
				const member = declare(inline.declaration, outcome.value, context, containsAggregate);
				updateLocalAccumulations(member, context);
				if (context.regional.active) context.regional.active.members.push(member);
				unboundDeclarations.delete(inline.declaration.normalizedLabel);
			} else {
				unboundDeclarations.set(inline.declaration.normalizedLabel, inline.declaration.label);
			}
		}
		add(inline, outcome);
	}

	completeAllLocalAccumulations(context, sourceText.length);
	if (context.regional.active) {
		documentDiagnostics.push({
			code: 'unclosed-region',
			message: 'Region opened here remains active at end of file.',
			offset: context.regional.active.openedAt,
			severity: 'warning',
		});
	}

	return {
		outcomeAt: (offset) => byOffset.get(offset),
		declarationAt: (offset) => declarations.get(offset),
		entries: () => records,
		structures: () => structures,
		diagnostics: () => documentDiagnostics,
	};

	function add(source: InlineSource, outcome: EvaluationOutcome) {
		records.push({ source, outcome });
		byOffset.set(source.from, outcome);
	}
}

function parseStructural(source: string): StructuralNode | undefined {
	const normalized = source.normalize('NFKC').trim().toLocaleLowerCase();
	if (normalized === 'top') return { kind: 'region-top' };
	if (normalized === 'bottom') return { kind: 'region-bottom' };
	return undefined;
}

function applyStructural(node: StructuralNode, context: EvaluationContext, offset: number): ErrorOutcome | undefined {
	if (node.kind === 'region-top') {
		if (context.regional.active) return diagnostic('region-already-open', 'A region is already active; close it with "bottom" before opening another.', offset);
		const ordinal = context.regional.nextOrdinal++;
		context.regional.active = { id: `region:${ordinal}`, ordinal, status: 'active', members: [], openedAt: offset };
		return undefined;
	}
	if (!context.regional.active) return diagnostic('region-not-open', 'No region is active.', offset);
	context.regional.active.status = 'completed';
	context.regional.active.closedAt = offset;
	context.regional.latestCompleted = context.regional.active;
	context.regional.active = undefined;
	return undefined;
}

function evaluateScalar(node: ScalarExpressionNode, context: EvaluationContext, options: DocumentEngineOptions, offset: number): { outcome: EvaluationOutcome; localGroups: string[] } {
	let source = node.source;
	const variables = new Map(context.variables);
	const localGroups: string[] = [];
	for (let index = node.aggregates.length - 1; index >= 0; index--) {
		const occurrence = node.aggregates[index];
		const aggregate = evaluateAggregate({ kind: 'aggregate', function: occurrence.node.fn, scope: occurrence.node.scope, group: occurrence.node.group, groupSource: occurrence.node.groupSource, filters: occurrence.node.filters }, context, options, offset);
		if (aggregate.kind !== 'success') return { outcome: aggregate, localGroups: [] };
		const placeholder = `__quantitiesaggregate${index}`;
		variables.set(placeholder, aggregate.value);
		source = `${source.slice(0, occurrence.from)}${placeholder}${source.slice(occurrence.to)}`;
		if (occurrence.node.scope === 'local') localGroups.push(occurrence.node.group);
	}

	if (!node.aggregates.length) {
		const compatibility = options.evaluateCompatibility?.(source, variables);
		if (compatibility?.kind === 'success') return { outcome: { kind: 'success', value: compatibility.value, display: compatibility.display, consumeTrailingS: compatibility.consumeTrailingS }, localGroups };
		if (compatibility?.kind === 'error') return { outcome: diagnostic(compatibility.code, compatibility.message, offset), localGroups: [] };
	}
	const arithmetic = evaluateArithmetic(source.replace(/\s*=\s*$/, ''), variables, context.variableLabels);
	if (arithmetic.kind === 'error') return { outcome: diagnostic(arithmetic.code, arithmetic.message, offset), localGroups: [] };
	return {
		outcome: {
			kind: 'success',
			value: { kind: 'number', value: arithmetic.value, decimalPlaces: arithmetic.decimalPlaces },
			display: options.formatNumber(arithmetic.value, arithmetic.decimalPlaces),
		},
		localGroups,
	};
}

function reservedIdentifier(expression: string): string | undefined {
	const normalized = expression.normalize('NFKC').toLocaleLowerCase();
	for (const name of RESERVED_NAMES) {
		const match = normalized.match(new RegExp(`(^|[^\\p{L}\\p{N}_])(${name})(?!\\s+\\p{L})(?=$|[^\\p{L}\\p{N}_])`, 'u'));
		if (match) return match[2];
	}
	return undefined;
}

function aggregateConflictsWithDeclaration(node: AggregateExpressionNode | { scope: string; group: string }, declaration: NonNullable<InlineSource['declaration']>): boolean {
	return node.scope !== 'regional' && [declaration.normalizedLabel, ...declaration.groups].includes(node.group);
}

function referencesLabel(expression: string, normalizedLabel: string): boolean {
	const escaped = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
	return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu')
		.test(expression.normalize('NFKC').toLocaleLowerCase());
}

function declare(declaration: NonNullable<InlineSource['declaration']>, value: EvaluatedValue, context: EvaluationContext, containsAggregate: boolean): EvaluatedDeclaration {
	const declarationId = `declaration@${declaration.sourceOffset}`;
	const provenance = {
		declarationIds: Array.from(new Set([...(value.provenance?.declarationIds ?? []), declarationId])),
		sourceOffsets: Array.from(new Set([...(value.provenance?.sourceOffsets ?? []), declaration.sourceOffset])),
		localAccumulationIds: value.provenance?.localAccumulationIds ?? [],
	};
	const declaredValue: EvaluatedValue = { ...value, provenance };
	context.variables.set(declaration.normalizedLabel, declaredValue);
	context.variableLabels.set(declaration.normalizedLabel, declaration.label);
	const memberships = Array.from(new Set([declaration.normalizedLabel, ...declaration.groups]));
	const member: EvaluatedDeclaration = {
		declarationId,
		label: declaration.label,
		normalizedLabel: declaration.normalizedLabel,
		value: declaredValue,
		groups: memberships,
		localAccumulationIds: [],
		containsAggregate,
		sourceOffset: declaration.sourceOffset,
	};
	for (const group of memberships) {
		const members = context.groups.get(group) ?? [];
		members.push(member);
		context.groups.set(group, members);
	}
	return member;
}

function updateLocalAccumulations(member: EvaluatedDeclaration, context: EvaluationContext) {
	for (const group of member.groups) {
		let accumulation = context.local.active.get(group);
		if (!accumulation) {
			const ordinal = context.local.nextOrdinal.get(group) ?? 1;
			context.local.nextOrdinal.set(group, ordinal + 1);
			accumulation = { id: `local:${group}:${ordinal}`, group, ordinal, status: 'active', members: [], openedAt: member.sourceOffset };
			context.local.active.set(group, accumulation);
		}
		accumulation.members.push(member);
		member.localAccumulationIds.push(accumulation.id);
		const provenance = member.value.provenance;
		if (provenance && !provenance.localAccumulationIds.includes(accumulation.id)) provenance.localAccumulationIds.push(accumulation.id);
	}
}

function completeLocalAccumulation(group: string, context: EvaluationContext, offset: number, declarationId?: string) {
	const accumulation = context.local.active.get(group);
	if (!accumulation) return;
	accumulation.status = 'completed';
	accumulation.closedAt = offset;
	accumulation.closedByDeclarationId = declarationId;
	context.local.active.delete(group);
	const completed = context.local.completed.get(group) ?? [];
	completed.push(accumulation);
	context.local.completed.set(group, completed);
}

function completeAllLocalAccumulations(context: EvaluationContext, offset: number) {
	for (const group of Array.from(context.local.active.keys())) completeLocalAccumulation(group, context, offset);
}

function evaluateAggregate(node: AggregateExpressionNode, context: EvaluationContext, options: DocumentEngineOptions, offset: number): EvaluationOutcome {
	if (node.scope === 'regional') {
		const region = context.regional.active ?? context.regional.latestCompleted;
		if (!region) return diagnostic('unknown-region', 'No active or completed region is available.', offset);
		return aggregateMembers(node, region.members.filter((member) => !member.containsAggregate), options, offset);
	}
	if (node.scope === 'local') {
		const active = context.local.active.get(node.group);
		const completed = context.local.completed.get(node.group);
		const accumulation = active ?? completed?.[completed.length - 1];
		if (!accumulation) return diagnostic('unknown-local-group', `Unknown local group "${node.groupSource}".`, offset);
		return aggregateMembers(node, accumulation.members, options, offset);
	}
	if (!context.groups.has(node.group)) return diagnostic('unknown-group', `Unknown group "${node.groupSource}".`, offset);
	return aggregateMembers(node, context.groups.get(node.group) ?? [], options, offset);
}

function aggregateMembers(node: AggregateExpressionNode, initialMembers: EvaluatedDeclaration[], options: DocumentEngineOptions, offset: number): EvaluationOutcome {
	let members = Array.from(new Map(initialMembers.map((member) => [member.declarationId, member])).values());
	members = members.filter((member) => node.filters.every((filter) => {
		const matches = filter.sigils.some((sigil) => member.groups.includes(sigil));
		return filter.negated ? !matches : matches;
	}));
	const quantity = members.find((member) => member.value.kind === 'quantity');
	if (quantity) return diagnostic('quantity-aggregate', `Aggregate contains unit-bearing declaration "${quantity.label}".`, offset);
	const values = members.map((member) => member.value.value);
	const decimalPlaces = node.function === 'count' ? 0 : members.reduce((maximum, member) => member.value.kind === 'number' ? Math.max(maximum, member.value.decimalPlaces) : maximum, 0);
	let value: number;
	switch (node.function) {
		case 'count': value = values.length; break;
		case 'sum': value = values.reduce((sum, item) => sum + item, 0); break;
		case 'avg':
			if (!values.length) return diagnostic('empty-aggregate', 'Cannot average an empty selection.', offset);
			value = values.reduce((sum, item) => sum + item, 0) / values.length; break;
		case 'median': {
			if (!values.length) return diagnostic('empty-aggregate', 'Cannot take the median of an empty selection.', offset);
			const sorted = [...values].sort((a, b) => a - b);
			const middle = Math.floor(sorted.length / 2);
			value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
			break;
		}
		case 'min':
		case 'max':
			if (!values.length) return diagnostic('empty-aggregate', `Cannot take ${node.function} of an empty selection.`, offset);
			value = node.function === 'min' ? Math.min(...values) : Math.max(...values); break;
	}
	const provenance = {
		declarationIds: Array.from(new Set(members.flatMap((member) => member.value.provenance?.declarationIds ?? [member.declarationId]))),
		sourceOffsets: Array.from(new Set(members.flatMap((member) => member.value.provenance?.sourceOffsets ?? [member.sourceOffset]))),
		localAccumulationIds: Array.from(new Set(members.flatMap((member) => member.localAccumulationIds))).filter((id) => node.scope !== 'local' || id.startsWith(`local:${node.group}:`)),
	};
	return { kind: 'success', value: { kind: 'number', value, decimalPlaces, provenance }, display: options.formatNumber(value, decimalPlaces) };
}

function diagnostic(code: string, message: string, offset: number): ErrorOutcome {
	return { kind: 'error', diagnostic: { code, message, offset } };
}
