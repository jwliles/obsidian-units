export interface ValueProvenance {
	declarationIds: string[];
	sourceOffsets: number[];
	localAccumulationIds: string[];
}

export type EvaluatedValue =
	| { kind: 'number'; value: number; decimalPlaces: number; provenance?: ValueProvenance }
	| { kind: 'quantity'; value: number; unit: string; dimension: string; provenance?: ValueProvenance };

export interface EvaluationDiagnostic {
	code: string;
	message: string;
	offset: number;
}

export type EvaluationOutcome =
	| { kind: 'success'; value: EvaluatedValue; display: string; consumeTrailingS?: boolean }
	| { kind: 'error'; diagnostic: EvaluationDiagnostic }
	| { kind: 'not-applicable' };

export interface Declaration {
	label: string;
	normalizedLabel: string;
	groups: string[];
	expressionSource: string;
	sourceOffset: number;
}

export interface GroupMember {
	declarationId: string;
	label: string;
	normalizedLabel: string;
	value: EvaluatedValue;
	groups: string[];
	localAccumulationIds: string[];
	sourceOffset: number;
}

export interface LocalAccumulation {
	id: string;
	group: string;
	ordinal: number;
	status: 'active' | 'completed';
	members: GroupMember[];
	openedAt: number;
	closedAt?: number;
	closedByDeclarationId?: string;
}

export interface EvaluationContext {
	variables: Map<string, EvaluatedValue>;
	variableLabels: Map<string, string>;
	groups: Map<string, GroupMember[]>;
	local: LocalEvaluationContext;
}

export interface LocalEvaluationContext {
	active: Map<string, LocalAccumulation>;
	completed: Map<string, LocalAccumulation[]>;
	nextOrdinal: Map<string, number>;
}

export interface InlineSource {
	from: number;
	to: number;
	content: string;
	declaration?: Declaration;
	declarationDiagnostic?: EvaluationDiagnostic;
}

export interface DocumentEvaluationIndex {
	outcomeAt(sourceOffset: number): EvaluationOutcome | undefined;
	declarationAt(sourceOffset: number): Declaration | undefined;
	entries(): ReadonlyArray<{ source: InlineSource; outcome: EvaluationOutcome }>;
}
