import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
	DEFAULT_SETTINGS,
	diagnoseConversion,
	evaluateCompatibilityExpression,
	evaluateInlineExpressionFallback,
	formatNumber,
	getRenderSource,
	isValidExpressionMarker,
	parseConversion,
	planMarkerUpdate,
} from "../main";
import { evaluateDocument } from "../src/document/evaluation-index";
import { TFile } from "obsidian";

const settings = { ...DEFAULT_SETTINGS, densities: [] };
const evaluate = (source: string, explicit = true) =>
	evaluateInlineExpressionFallback(source, settings, new Map(), explicit);

// Representative conversion categories and command-style parsing without an inline marker.
for (const source of [
	"5 ft to cm",
	"2 cups to ml",
	"180 lb to kg",
	"72 F to C",
	"55 mph to km/h",
	"10 MiB to MB",
]) {
	assert.ok(
		parseConversion(source, settings),
		`Expected conversion: ${source}`,
	);
	assert.ok(
		evaluate(source, false),
		`Command intent should evaluate: ${source}`,
	);
}

// Inline modes, arithmetic compatibility, and plural consumption.
assert.match(evaluate("33 meters to feet | result")!.text, /feet/);
assert.match(evaluate("33 meters to feet | value")!.text, /^108\.2677$/);
assert.equal(evaluate("33 meters to feet | unit")!.text, "feet");
assert.equal(evaluate("10 / 2 =")!.text, "5");
assert.equal(evaluate("2(3 + 4)")!.text, "14");
assert.equal(evaluate("33 ounces to gram")!.consumeTrailingS, true);

// Decimal precision may round normally, but it must not disguise a non-zero
// result as zero. Extend only far enough to expose the first significant digit.
const lowPrecisionSettings = { ...settings, precision: 2 };
assert.equal(
	evaluateInlineExpressionFallback(
		"2e-3",
		lowPrecisionSettings,
		new Map(),
		true,
	)!.text,
	"0.002",
);
assert.equal(
	evaluateInlineExpressionFallback(
		"1.5e-3",
		lowPrecisionSettings,
		new Map(),
		true,
	)!.text,
	"0.002",
);
assert.equal(
	evaluateInlineExpressionFallback(
		"1 / 1000",
		lowPrecisionSettings,
		new Map(),
		true,
	)!.text,
	"0.001",
);
assert.equal(formatNumber("0.0000000000015", 2), "1.5 × 10⁻¹²");
assert.equal(formatNumber("-0.0000000000015", 2), "-1.5 × 10⁻¹²");
assert.equal(formatNumber("0", 2), "0");
assert.equal(formatNumber("-0", 10), "0");
assert.equal(formatNumber("0.4", 0), "0.4");
assert.equal(formatNumber("1.4", 0), "1");
assert.equal(formatNumber("1.25", 1), "1.2");
assert.equal(formatNumber("1.35", 1), "1.4");
assert.equal(formatNumber("0.0000000001", 0), "0.0000000001");
assert.equal(formatNumber("0.00000000001", 10), "1 × 10⁻¹¹");
assert.equal(
	evaluateInlineExpressionFallback(
		"1 ang to ly | value",
		lowPrecisionSettings,
		new Map(),
		true,
	)!.text,
	"1.06 × 10⁻²⁶",
);
assert.equal(
	evaluateInlineExpressionFallback(
		"18 km/h to m/s | value",
		lowPrecisionSettings,
		new Map(),
		true,
	)!.text,
	"5",
);

// Density conversion in both directions.
const densitySettings = {
	...settings,
	densities: [{ name: "maple syrup", value: 1.37, unit: "g/ml" }],
};
assert.equal(
	evaluateInlineExpressionFallback(
		"1 tsp of maple syrup to g | value",
		densitySettings,
		new Map(),
		true,
	)!.text,
	"6.7526",
);
assert.equal(
	evaluateInlineExpressionFallback(
		"100 g of maple syrup to ml | value",
		densitySettings,
		new Map(),
		true,
	)!.text,
	"72.9927",
);

// Specific conversion diagnostics flow through the shared document outcome.
assert.match(diagnoseConversion("5 mystery to cm", settings)!, /Unknown unit/);
assert.match(diagnoseConversion("1 tsp to g", settings)!, /without a material/);
assert.match(
	diagnoseConversion("1 tsp of unobtainium to g", settings)!,
	/Unknown material/,
);
assert.match(diagnoseConversion("1 m to kg", settings)!, /incompatible units/);

const diagnosticIndex = evaluateDocument("`=5 mystery to cm`", {
	formatNumber: String,
	evaluateCompatibility: (source, values) =>
		evaluateCompatibilityExpression(source, values, settings),
});
const diagnostic = diagnosticIndex.entries()[0].outcome;
assert.equal(diagnostic.kind, "error");
if (diagnostic.kind === "error") {
	assert.equal(diagnostic.diagnostic.code, "conversion-error");
	assert.match(diagnostic.diagnostic.message, /Unknown unit/);
}

assert.equal(isValidExpressionMarker("~"), true);
assert.equal(isValidExpressionMarker("u:"), true);
assert.equal(isValidExpressionMarker(""), false);
assert.equal(isValidExpressionMarker("not valid"), false);
const markerUpdate = planMarkerUpdate(
	[
		"CAC:ex = `=200`",
		"`=sum:ex`",
		"`=top`",
		"`=bottom`",
		"`=30 ft to m`",
		"`=2 + 2`",
		"`=this.file.name`",
	].join("\n"),
	"=",
	"~",
	settings,
);
assert.equal(markerUpdate.changed, 5);
assert.equal(markerUpdate.ambiguous, 2);
assert.match(markerUpdate.text, /CAC:ex = `~200`/);
assert.match(markerUpdate.text, /`~sum:ex`/);
assert.match(markerUpdate.text, /`~top`/);
assert.match(markerUpdate.text, /`~bottom`/);
assert.match(markerUpdate.text, /`~30 ft to m`/);
assert.match(markerUpdate.text, /`=2 \+ 2`/);

// A transcluded heading evaluates against the complete embedded note, then
// narrows rendered entries to the embedded source range.
export const compatibilityTestsComplete = testEmbeddedSourceResolution();

async function testEmbeddedSourceResolution() {
	const embeddedFile = Object.assign(new TFile(), { path: "source.md" });
	const embeddedText = readFileSync("tests/embed-source.md", "utf8");
	const reportStart = embeddedText.indexOf("## Report");
	const reportEnd = embeddedText.indexOf("## Later");
	const renderSource = await getRenderSource(
		{
			matches: () => true,
			closest: () => null,
			getAttribute: () => "embed-source#Report",
		} as unknown as HTMLElement,
		{
			sourcePath: "host.md",
		} as any,
		{
			app: {
				vault: { cachedRead: async () => embeddedText },
				metadataCache: {
					getFirstLinkpathDest: () => embeddedFile,
					getFileCache: () => ({
						subpaths: {
							"#Report": {
								start: { offset: reportStart },
								end: { offset: reportEnd },
							},
						},
					}),
				},
			},
		} as any,
	);
	assert.deepEqual(renderSource, {
		text: embeddedText,
		from: reportStart,
		to: reportEnd,
	});
	const hostFile = Object.assign(new TFile(), { path: "tests/embed-host.md" });
	const hostText = readFileSync("tests/embed-host.md", "utf8");
	const hostEmbedLine = hostText
		.split("\n")
		.findIndex((line) => line.includes("![[embed-source#Report]]"));
	const detachedRenderSource = await getRenderSource(
		{
			matches: () => false,
			closest: () => null,
			getAttribute: () => null,
		} as unknown as HTMLElement,
		{
			sourcePath: "tests/embed-host.md",
			getSectionInfo: () => ({
				text: "![[embed-source#Report]]",
				lineStart: hostEmbedLine,
				lineEnd: hostEmbedLine,
			}),
		} as any,
		{
			app: {
				vault: {
					getAbstractFileByPath: () => hostFile,
					cachedRead: async (file: TFile) =>
						file.path === hostFile.path ? hostText : embeddedText,
				},
				metadataCache: {
					getFirstLinkpathDest: () => embeddedFile,
					getFileCache: () => ({
						subpaths: {
							"#Report": {
								start: { offset: reportStart },
								end: { offset: reportEnd },
							},
						},
					}),
				},
			},
		} as any,
	);
	assert.deepEqual(detachedRenderSource, {
		text: embeddedText,
		from: reportStart,
		to: reportEnd,
	});
	const embeddedIndex = evaluateDocument(renderSource!.text, {
		marker: "=",
		formatNumber: (value, minimum) => formatNumber(value, 4, minimum),
		evaluateCompatibility: (expression, values) =>
			evaluateCompatibilityExpression(expression, values, settings),
	});
	const reportEntries = embeddedIndex
		.entries()
		.filter(
			(entry) =>
				entry.source.from >= renderSource!.from &&
				entry.source.from < renderSource!.to,
		);
	const embeddedResult = reportEntries.find(
		(entry) => entry.source.content === "=Seed+1",
	)?.outcome;
	const regionalResult = reportEntries.find(
		(entry) => entry.source.content === "=sum:>",
	)?.outcome;
	assert.equal(embeddedResult?.kind, "success");
	assert.equal(regionalResult?.kind, "success");
	if (embeddedResult?.kind === "success")
		assert.equal(embeddedResult.display, "11");
	if (regionalResult?.kind === "success")
		assert.equal(regionalResult.display, "2");
	assert.ok(!reportEntries.some((entry) => entry.source.content === "=20"));
	assert.match(
		readFileSync("tests/embed-host.md", "utf8"),
		/!\[\[embed-source#Report\]\]/,
	);
}

console.log("All compatibility and diagnostic tests passed.");
