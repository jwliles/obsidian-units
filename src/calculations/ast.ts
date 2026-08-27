import type {
	AggregateFilter,
	AggregateFunction,
	AggregateOccurrence,
	AggregateScope,
} from "./aggregate";

export interface AggregateExpressionNode {
	kind: "aggregate";
	function: AggregateFunction;
	scope: AggregateScope;
	group: string;
	groupSource: string;
	filters: AggregateFilter[];
	resultCollection: boolean;
}

/**
 * Scalar expressions remain opaque to the document language. The injected
 * compatibility evaluator and pure arithmetic evaluator interpret this node.
 */
export interface ScalarExpressionNode {
	kind: "scalar";
	source: string;
	aggregates: AggregateOccurrence[];
}

export type StructuralNode =
	| { kind: "region-top"; name?: string; nameSource?: string }
	| { kind: "region-bottom" };

export type ExpressionNode = AggregateExpressionNode | ScalarExpressionNode;

export type ExpressionParseOutcome =
	| { kind: "success"; node: ExpressionNode }
	| { kind: "error"; code: string; message: string };
