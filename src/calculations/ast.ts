import { AggregateFilter, AggregateFunction } from './aggregate';

export interface AggregateExpressionNode {
	kind: 'aggregate';
	function: AggregateFunction;
	scope: 'global' | 'local';
	group: string;
	groupSource: string;
	filters: AggregateFilter[];
}

/**
 * Scalar expressions remain opaque to the document language. The injected
 * compatibility evaluator and pure arithmetic evaluator interpret this node.
 */
export interface ScalarExpressionNode {
	kind: 'scalar';
	source: string;
}

export type ExpressionNode = AggregateExpressionNode | ScalarExpressionNode;

export type ExpressionParseOutcome =
	| { kind: 'success'; node: ExpressionNode }
	| { kind: 'error'; code: string; message: string };
