import { ExpressionParseOutcome } from './ast';
import { parseAggregate } from './aggregate';

export function parseExpression(source: string): ExpressionParseOutcome {
	const aggregate = parseAggregate(source);
	if (aggregate.kind === 'error') return { kind: 'error', code: 'aggregate-syntax', message: aggregate.message };
	if (aggregate.kind === 'success') {
		return {
			kind: 'success',
			node: {
				kind: 'aggregate',
				function: aggregate.node.fn,
				scope: aggregate.node.scope,
				group: aggregate.node.group,
				groupSource: aggregate.node.groupSource,
				filters: aggregate.node.filters,
			},
		};
	}
	return { kind: 'success', node: { kind: 'scalar', source } };
}
