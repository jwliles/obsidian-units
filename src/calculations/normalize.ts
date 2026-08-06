export function normalizeLabel(value: string): string {
	return value
		.normalize('NFKC')
		.replace(/[`*_#>\[\]()]/g, ' ')
		.trim()
		.replace(/\s+/g, ' ')
		.toLocaleLowerCase();
}

export function normalizeSigil(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase();
}
