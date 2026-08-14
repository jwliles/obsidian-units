export interface InlineCodeSpan {
	from: number;
	to: number;
	content: string;
}

/** Scans Markdown inline code while excluding fenced blocks and HTML comments. */
export function scanInlineCode(source: string): InlineCodeSpan[] {
	const spans: InlineCodeSpan[] = [];
	let offset = 0;
	let fence: string | null = null;
	let inComment = false;

	for (const lineWithBreak of source.match(/[^\n]*(?:\n|$)/g) ?? []) {
		if (!lineWithBreak) continue;
		const line = lineWithBreak.endsWith('\n') ? lineWithBreak.slice(0, -1) : lineWithBreak;
		const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
		if (!inComment && fenceMatch) {
			const candidate = fenceMatch[1][0];
			if (fence === candidate) fence = null;
			else if (fence === null) fence = candidate;
			offset += lineWithBreak.length;
			continue;
		}
		if (fence !== null) {
			offset += lineWithBreak.length;
			continue;
		}

		let index = 0;
		while (index < line.length) {
			if (inComment) {
				const end = line.indexOf('-->', index);
				if (end < 0) break;
				inComment = false;
				index = end + 3;
				continue;
			}
			const comment = line.indexOf('<!--', index);
			const tick = line.indexOf('`', index);
			if (comment >= 0 && (tick < 0 || comment < tick)) {
				inComment = true;
				index = comment + 4;
				continue;
			}
			if (tick < 0) break;
			if (line[tick + 1] === '`' || (tick > 0 && line[tick - 1] === '`')) {
				index = tick + 1;
				continue;
			}
			const end = line.indexOf('`', tick + 1);
			if (end < 0) break;
			spans.push({ from: offset + tick, to: offset + end + 1, content: line.slice(tick + 1, end) });
			index = end + 1;
		}
		offset += lineWithBreak.length;
	}
	return spans;
}
