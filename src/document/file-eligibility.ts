export interface FileEligibilitySettings {
	fileEligibilityDefault: "all" | "none";
	fileEligibilityExceptions: string[];
	fileEligibilityOverrides: Record<string, boolean>;
}

/** Resolves default, exceptions, explicit file state, then frontmatter. */
export function isFileEligible(
	path: string,
	settings: FileEligibilitySettings,
	frontmatterOverride?: unknown,
): boolean {
	const normalizedPath = normalizePath(path);
	let eligible = settings.fileEligibilityDefault === "all";
	if (
		settings.fileEligibilityExceptions.some((pattern) =>
			matchesPath(normalizedPath, pattern),
		)
	)
		eligible = !eligible;
	const explicit = explicitPathOverride(
		normalizedPath,
		settings.fileEligibilityOverrides,
	);
	if (typeof explicit === "boolean") eligible = explicit;
	return typeof frontmatterOverride === "boolean"
		? frontmatterOverride
		: eligible;
}

function explicitPathOverride(
	path: string,
	overrides: Record<string, boolean>,
): boolean | undefined {
	if (typeof overrides[path] === "boolean") return overrides[path];
	const folderMatches = Object.entries(overrides)
		.filter(
			([pattern]) => pattern.endsWith("/**") && matchesPath(path, pattern),
		)
		.sort(([left], [right]) => right.length - left.length);
	return folderMatches[0]?.[1];
}

export function normalizedFilePath(path: string): string {
	return normalizePath(path);
}

/** Keeps exact paths and path-rooted globs attached across file/folder renames. */
export function remapFileEligibilityPaths(
	settings: FileEligibilitySettings,
	oldPath: string,
	newPath: string,
): boolean {
	const oldKey = normalizePath(oldPath);
	const newKey = normalizePath(newPath);
	let changed = false;
	settings.fileEligibilityExceptions = settings.fileEligibilityExceptions.map(
		(pattern) => {
			const normalized = normalizePath(pattern);
			if (normalized !== oldKey && !normalized.startsWith(`${oldKey}/`))
				return pattern;
			changed = true;
			return `${newKey}${normalized.slice(oldKey.length)}`;
		},
	);
	for (const [path, enabled] of Object.entries(
		settings.fileEligibilityOverrides,
	)) {
		if (path !== oldKey && !path.startsWith(`${oldKey}/`)) continue;
		delete settings.fileEligibilityOverrides[path];
		settings.fileEligibilityOverrides[`${newKey}${path.slice(oldKey.length)}`] =
			enabled;
		changed = true;
	}
	return changed;
}

export function quantitiesFrontmatterOverride(
	source: string,
): boolean | undefined {
	const body = source.match(
		/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/u,
	)?.[1];
	if (body === undefined) return undefined;
	const value = body.match(
		/^quantities\s*:\s*(true|false)\s*(?:#.*)?$/imu,
	)?.[1];
	return value === undefined ? undefined : value.toLowerCase() === "true";
}

function matchesPath(path: string, sourcePattern: string): boolean {
	const pattern = normalizePath(sourcePattern.trim());
	if (!pattern) return false;
	if (!/[?*]/u.test(pattern)) return path === pattern;
	return globToRegExp(pattern).test(path);
}

function normalizePath(path: string): string {
	return path
		.replace(/\\/gu, "/")
		.replace(/^\.\//u, "")
		.replace(/^\/+|\/+$/gu, "");
}

function globToRegExp(pattern: string): RegExp {
	let source = "^";
	for (let index = 0; index < pattern.length; index++) {
		const character = pattern[index];
		if (character === "*") {
			if (pattern[index + 1] === "*") {
				index++;
				if (pattern[index + 1] === "/") {
					index++;
					source += "(?:.*/)?";
				} else source += ".*";
			} else source += "[^/]*";
		} else if (character === "?") source += "[^/]";
		else source += character.replace(/[\\^$.[\]{}()+|]/gu, "\\$&");
	}
	return new RegExp(`${source}$`, "u");
}
