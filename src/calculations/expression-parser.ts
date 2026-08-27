import { ExpressionParseOutcome } from "./ast";
import { findAggregateOccurrences, parseAggregate } from "./aggregate";

export function parseExpression(source: string): ExpressionParseOutcome {
	const aggregate = parseAggregate(source);
	const embedded = findAggregateOccurrences(source);
	if (aggregate.kind === "error" && !embedded.length)
		return {
			kind: "error",
			code: aggregate.code ?? "aggregate-syntax",
			message: aggregate.message,
		};
	if (aggregate.kind === "success") {
		return {
			kind: "success",
			node: {
				kind: "aggregate",
				function: aggregate.node.fn,
				scope: aggregate.node.scope,
				group: aggregate.node.group,
				groupSource: aggregate.node.groupSource,
				filters: aggregate.node.filters,
				resultCollection: aggregate.node.resultCollection,
			},
		};
	}
	return {
		kind: "success",
		node: { kind: "scalar", source, aggregates: embedded },
	};
}
