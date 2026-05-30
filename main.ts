import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Range } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import initObsidianUnitsCore, { evaluate_inline as evaluateInlineWithRust } from './obsidian_units_core.js';

interface ObsidianUnitsSettings {
	precision: number;
}

const DEFAULT_SETTINGS: ObsidianUnitsSettings = {
	precision: 4,
};

type UnitKind = 'linear' | 'affine';

interface BaseUnit {
	canonical: string;
	dimension: string;
	kind: UnitKind;
}

interface LinearUnit extends BaseUnit {
	kind: 'linear';
	toBase: number;
}

interface AffineUnit extends BaseUnit {
	kind: 'affine';
	toBase(value: number): number;
	fromBase(value: number): number;
}

type Unit = LinearUnit | AffineUnit;

interface Conversion {
	input: number;
	source: Unit;
	target: Unit;
	output: number;
}

type InlineRenderMode = 'result' | 'value' | 'unit';

interface InlineConversion {
	conversion: Conversion;
	mode: InlineRenderMode;
}

interface InlineEvaluation {
	text: string;
	consumeTrailingS: boolean;
}

type VariableMap = Map<string, number>;

interface UnitDisplay {
	abbr: string;
	singular: string;
	plural: string;
}

const LINEAR_UNITS: LinearUnit[] = [
	// Length, base meter.
	{ canonical: 'mm', dimension: 'length', kind: 'linear', toBase: 0.001 },
	{ canonical: 'cm', dimension: 'length', kind: 'linear', toBase: 0.01 },
	{ canonical: 'm', dimension: 'length', kind: 'linear', toBase: 1 },
	{ canonical: 'km', dimension: 'length', kind: 'linear', toBase: 1000 },
	{ canonical: 'in', dimension: 'length', kind: 'linear', toBase: 0.0254 },
	{ canonical: 'ft', dimension: 'length', kind: 'linear', toBase: 0.3048 },
	{ canonical: 'yd', dimension: 'length', kind: 'linear', toBase: 0.9144 },
	{ canonical: 'mi', dimension: 'length', kind: 'linear', toBase: 1609.344 },
	{ canonical: 'nmi', dimension: 'length', kind: 'linear', toBase: 1852 },

	// Area, base square meter.
	{ canonical: 'mm^2', dimension: 'area', kind: 'linear', toBase: 0.000001 },
	{ canonical: 'cm^2', dimension: 'area', kind: 'linear', toBase: 0.0001 },
	{ canonical: 'm^2', dimension: 'area', kind: 'linear', toBase: 1 },
	{ canonical: 'km^2', dimension: 'area', kind: 'linear', toBase: 1000000 },
	{ canonical: 'in^2', dimension: 'area', kind: 'linear', toBase: 0.00064516 },
	{ canonical: 'ft^2', dimension: 'area', kind: 'linear', toBase: 0.09290304 },
	{ canonical: 'yd^2', dimension: 'area', kind: 'linear', toBase: 0.83612736 },
	{ canonical: 'acre', dimension: 'area', kind: 'linear', toBase: 4046.8564224 },
	{ canonical: 'ha', dimension: 'area', kind: 'linear', toBase: 10000 },

	// Mass, base gram.
	{ canonical: 'mg', dimension: 'mass', kind: 'linear', toBase: 0.001 },
	{ canonical: 'g', dimension: 'mass', kind: 'linear', toBase: 1 },
	{ canonical: 'kg', dimension: 'mass', kind: 'linear', toBase: 1000 },
	{ canonical: 'oz', dimension: 'mass', kind: 'linear', toBase: 28.349523125 },
	{ canonical: 'lb', dimension: 'mass', kind: 'linear', toBase: 453.59237 },
	{ canonical: 'st', dimension: 'mass', kind: 'linear', toBase: 6350.29318 },
	{ canonical: 'ton', dimension: 'mass', kind: 'linear', toBase: 907184.74 },
	{ canonical: 'tonne', dimension: 'mass', kind: 'linear', toBase: 1000000 },

	// Volume, base liter.
	{ canonical: 'ml', dimension: 'volume', kind: 'linear', toBase: 0.001 },
	{ canonical: 'l', dimension: 'volume', kind: 'linear', toBase: 1 },
	{ canonical: 'tsp', dimension: 'volume', kind: 'linear', toBase: 0.00492892159375 },
	{ canonical: 'tbsp', dimension: 'volume', kind: 'linear', toBase: 0.01478676478125 },
	{ canonical: 'fl oz', dimension: 'volume', kind: 'linear', toBase: 0.0295735295625 },
	{ canonical: 'cup', dimension: 'volume', kind: 'linear', toBase: 0.2365882365 },
	{ canonical: 'pt', dimension: 'volume', kind: 'linear', toBase: 0.473176473 },
	{ canonical: 'qt', dimension: 'volume', kind: 'linear', toBase: 0.946352946 },
	{ canonical: 'gal', dimension: 'volume', kind: 'linear', toBase: 3.785411784 },
	{ canonical: 'm^3', dimension: 'volume', kind: 'linear', toBase: 1000 },

	// Speed, base meter per second.
	{ canonical: 'm/s', dimension: 'speed', kind: 'linear', toBase: 1 },
	{ canonical: 'km/h', dimension: 'speed', kind: 'linear', toBase: 0.2777777777777778 },
	{ canonical: 'mph', dimension: 'speed', kind: 'linear', toBase: 0.44704 },
	{ canonical: 'knot', dimension: 'speed', kind: 'linear', toBase: 0.5144444444444445 },
	{ canonical: 'ft/s', dimension: 'speed', kind: 'linear', toBase: 0.3048 },

	// Data, base byte.
	{ canonical: 'bit', dimension: 'data', kind: 'linear', toBase: 0.125 },
	{ canonical: 'byte', dimension: 'data', kind: 'linear', toBase: 1 },
	{ canonical: 'kb', dimension: 'data', kind: 'linear', toBase: 1024 },
	{ canonical: 'mb', dimension: 'data', kind: 'linear', toBase: 1048576 },
	{ canonical: 'gb', dimension: 'data', kind: 'linear', toBase: 1073741824 },
	{ canonical: 'tb', dimension: 'data', kind: 'linear', toBase: 1099511627776 },
	{ canonical: 'pb', dimension: 'data', kind: 'linear', toBase: 1125899906842624 },
	{ canonical: 'eb', dimension: 'data', kind: 'linear', toBase: 1152921504606847000 },
	{ canonical: 'kib', dimension: 'data', kind: 'linear', toBase: 1024 },
	{ canonical: 'mib', dimension: 'data', kind: 'linear', toBase: 1048576 },
	{ canonical: 'gib', dimension: 'data', kind: 'linear', toBase: 1073741824 },
	{ canonical: 'tib', dimension: 'data', kind: 'linear', toBase: 1099511627776 },
	{ canonical: 'pib', dimension: 'data', kind: 'linear', toBase: 1125899906842624 },
	{ canonical: 'eib', dimension: 'data', kind: 'linear', toBase: 1152921504606847000 },
];

const TEMPERATURE_UNITS: AffineUnit[] = [
	{
		canonical: 'C',
		dimension: 'temperature',
		kind: 'affine',
		toBase: (value) => value,
		fromBase: (value) => value,
	},
	{
		canonical: 'F',
		dimension: 'temperature',
		kind: 'affine',
		toBase: (value) => (value - 32) * 5 / 9,
		fromBase: (value) => value * 9 / 5 + 32,
	},
	{
		canonical: 'R',
		dimension: 'temperature',
		kind: 'affine',
		toBase: (value) => (value - 491.67) * 5 / 9,
		fromBase: (value) => (value + 273.15) * 9 / 5,
	},
	{
		canonical: 'K',
		dimension: 'temperature',
		kind: 'affine',
		toBase: (value) => value - 273.15,
		fromBase: (value) => value + 273.15,
	},
];

const UNIT_ALIASES: Record<string, string> = {
	millimeter: 'mm',
	millimeters: 'mm',
	centimeter: 'cm',
	centimeters: 'cm',
	meter: 'm',
	meters: 'm',
	metre: 'm',
	metres: 'm',
	kilometer: 'km',
	kilometers: 'km',
	kilometre: 'km',
	kilometres: 'km',
	inch: 'in',
	inches: 'in',
	'"': 'in',
	foot: 'ft',
	feet: 'ft',
	"'": 'ft',
	yard: 'yd',
	yards: 'yd',
	mile: 'mi',
	miles: 'mi',
	'nautical mile': 'nmi',
	'nautical miles': 'nmi',
	sqmm: 'mm^2',
	'sq mm': 'mm^2',
	'mm2': 'mm^2',
	'square millimeter': 'mm^2',
	'square millimeters': 'mm^2',
	sqcm: 'cm^2',
	'sq cm': 'cm^2',
	'cm2': 'cm^2',
	'square centimeter': 'cm^2',
	'square centimeters': 'cm^2',
	sqm: 'm^2',
	'sq m': 'm^2',
	'm2': 'm^2',
	'square meter': 'm^2',
	'square meters': 'm^2',
	sqkm: 'km^2',
	'sq km': 'km^2',
	'km2': 'km^2',
	'square kilometer': 'km^2',
	'square kilometers': 'km^2',
	sqin: 'in^2',
	'sq in': 'in^2',
	'in2': 'in^2',
	'square inch': 'in^2',
	'square inches': 'in^2',
	sqft: 'ft^2',
	'sq ft': 'ft^2',
	'ft2': 'ft^2',
	'square foot': 'ft^2',
	'square feet': 'ft^2',
	sqyd: 'yd^2',
	'sq yd': 'yd^2',
	'yd2': 'yd^2',
	'square yard': 'yd^2',
	'square yards': 'yd^2',
	acres: 'acre',
	hectare: 'ha',
	hectares: 'ha',
	milligram: 'mg',
	milligrams: 'mg',
	mgs: 'mg',
	gram: 'g',
	grams: 'g',
	kilogram: 'kg',
	kilograms: 'kg',
	kgs: 'kg',
	ounce: 'oz',
	ounces: 'oz',
	ozs: 'oz',
	pound: 'lb',
	pounds: 'lb',
	lbs: 'lb',
	stone: 'st',
	tons: 'ton',
	tonnes: 'tonne',
	milliliter: 'ml',
	milliliters: 'ml',
	millilitre: 'ml',
	millilitres: 'ml',
	liter: 'l',
	liters: 'l',
	litre: 'l',
	litres: 'l',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	'fluid ounce': 'fl oz',
	'fluid ounces': 'fl oz',
	cups: 'cup',
	pint: 'pt',
	pints: 'pt',
	quart: 'qt',
	quarts: 'qt',
	gallon: 'gal',
	gallons: 'gal',
	'm3': 'm^3',
	'cubic meter': 'm^3',
	'cubic meters': 'm^3',
	kph: 'km/h',
	'kmh': 'km/h',
	'kilometers per hour': 'km/h',
	'kilometres per hour': 'km/h',
	'meters per second': 'm/s',
	'metres per second': 'm/s',
	'mps': 'm/s',
	'miles per hour': 'mph',
	knots: 'knot',
	'feet per second': 'ft/s',
	bit: 'bit',
	bits: 'bit',
	byte: 'byte',
	bytes: 'byte',
	b: 'byte',
	'kilobyte (kb)': 'kb',
	kilobyte: 'kb',
	kilobytes: 'kb',
	'megabyte (mb)': 'mb',
	megabyte: 'mb',
	megabytes: 'mb',
	'gigabyte (gb)': 'gb',
	gigabyte: 'gb',
	gigabytes: 'gb',
	'terabyte (tb)': 'tb',
	terabyte: 'tb',
	terabytes: 'tb',
	'petabyte (pb)': 'pb',
	petabyte: 'pb',
	petabytes: 'pb',
	'exabyte (eb)': 'eb',
	exabyte: 'eb',
	exabytes: 'eb',
	kibibyte: 'kib',
	kibibytes: 'kib',
	mebibyte: 'mib',
	mebibytes: 'mib',
	gibibyte: 'gib',
	gibibytes: 'gib',
	tebibyte: 'tib',
	tebibytes: 'tib',
	pebibyte: 'pib',
	pebibytes: 'pib',
	exbibyte: 'eib',
	exbibytes: 'eib',
	celsius: 'C',
	'degrees celsius': 'C',
	fahrenheit: 'F',
	'degrees fahrenheit': 'F',
	rankine: 'R',
	'degrees rankine': 'R',
	ra: 'R',
	kelvin: 'K',
};

const UNIT_DISPLAYS: Record<string, UnitDisplay> = {
	mm: { abbr: 'mm', singular: 'millimeter', plural: 'millimeters' },
	cm: { abbr: 'cm', singular: 'centimeter', plural: 'centimeters' },
	m: { abbr: 'm', singular: 'meter', plural: 'meters' },
	km: { abbr: 'km', singular: 'kilometer', plural: 'kilometers' },
	in: { abbr: 'in', singular: 'inch', plural: 'inches' },
	ft: { abbr: 'ft', singular: 'foot', plural: 'feet' },
	yd: { abbr: 'yd', singular: 'yard', plural: 'yards' },
	mi: { abbr: 'mi', singular: 'mile', plural: 'miles' },
	nmi: { abbr: 'nmi', singular: 'nautical mile', plural: 'nautical miles' },
	'mm^2': { abbr: 'mm^2', singular: 'square millimeter', plural: 'square millimeters' },
	'cm^2': { abbr: 'cm^2', singular: 'square centimeter', plural: 'square centimeters' },
	'm^2': { abbr: 'm^2', singular: 'square meter', plural: 'square meters' },
	'km^2': { abbr: 'km^2', singular: 'square kilometer', plural: 'square kilometers' },
	'in^2': { abbr: 'in^2', singular: 'square inch', plural: 'square inches' },
	'ft^2': { abbr: 'ft^2', singular: 'square foot', plural: 'square feet' },
	'yd^2': { abbr: 'yd^2', singular: 'square yard', plural: 'square yards' },
	acre: { abbr: 'ac', singular: 'acre', plural: 'acres' },
	ha: { abbr: 'ha', singular: 'hectare', plural: 'hectares' },
	mg: { abbr: 'mg', singular: 'milligram', plural: 'milligrams' },
	g: { abbr: 'g', singular: 'gram', plural: 'grams' },
	kg: { abbr: 'kg', singular: 'kilogram', plural: 'kilograms' },
	oz: { abbr: 'oz', singular: 'ounce', plural: 'ounces' },
	lb: { abbr: 'lb', singular: 'pound', plural: 'pounds' },
	st: { abbr: 'st', singular: 'stone', plural: 'stone' },
	ton: { abbr: 'ton', singular: 'ton', plural: 'tons' },
	tonne: { abbr: 't', singular: 'tonne', plural: 'tonnes' },
	ml: { abbr: 'ml', singular: 'milliliter', plural: 'milliliters' },
	l: { abbr: 'L', singular: 'liter', plural: 'liters' },
	tsp: { abbr: 'tsp', singular: 'teaspoon', plural: 'teaspoons' },
	tbsp: { abbr: 'tbsp', singular: 'tablespoon', plural: 'tablespoons' },
	'fl oz': { abbr: 'fl oz', singular: 'fluid ounce', plural: 'fluid ounces' },
	cup: { abbr: 'cup', singular: 'cup', plural: 'cups' },
	pt: { abbr: 'pt', singular: 'pint', plural: 'pints' },
	qt: { abbr: 'qt', singular: 'quart', plural: 'quarts' },
	gal: { abbr: 'gal', singular: 'gallon', plural: 'gallons' },
	'm^3': { abbr: 'm^3', singular: 'cubic meter', plural: 'cubic meters' },
	'm/s': { abbr: 'm/s', singular: 'meter per second', plural: 'meters per second' },
	'km/h': { abbr: 'km/h', singular: 'kilometer per hour', plural: 'kilometers per hour' },
	mph: { abbr: 'mph', singular: 'mile per hour', plural: 'miles per hour' },
	knot: { abbr: 'kt', singular: 'knot', plural: 'knots' },
	'ft/s': { abbr: 'ft/s', singular: 'foot per second', plural: 'feet per second' },
	bit: { abbr: 'bit', singular: 'bit', plural: 'bits' },
	byte: { abbr: 'B', singular: 'byte', plural: 'bytes' },
	kb: { abbr: 'KB', singular: 'kilobyte', plural: 'kilobytes' },
	mb: { abbr: 'MB', singular: 'megabyte', plural: 'megabytes' },
	gb: { abbr: 'GB', singular: 'gigabyte', plural: 'gigabytes' },
	tb: { abbr: 'TB', singular: 'terabyte', plural: 'terabytes' },
	pb: { abbr: 'PB', singular: 'petabyte', plural: 'petabytes' },
	eb: { abbr: 'EB', singular: 'exabyte', plural: 'exabytes' },
	kib: { abbr: 'KiB', singular: 'kibibyte', plural: 'kibibytes' },
	mib: { abbr: 'MiB', singular: 'mebibyte', plural: 'mebibytes' },
	gib: { abbr: 'GiB', singular: 'gibibyte', plural: 'gibibytes' },
	tib: { abbr: 'TiB', singular: 'tebibyte', plural: 'tebibytes' },
	pib: { abbr: 'PiB', singular: 'pebibyte', plural: 'pebibytes' },
	eib: { abbr: 'EiB', singular: 'exbibyte', plural: 'exbibytes' },
	c: { abbr: 'C', singular: 'degree Celsius', plural: 'degrees Celsius' },
	f: { abbr: 'F', singular: 'degree Fahrenheit', plural: 'degrees Fahrenheit' },
	r: { abbr: 'R', singular: 'degree Rankine', plural: 'degrees Rankine' },
	k: { abbr: 'K', singular: 'kelvin', plural: 'kelvin' },
};

const UNITS = new Map<string, Unit>();

for (const unit of [...LINEAR_UNITS, ...TEMPERATURE_UNITS]) {
	UNITS.set(unit.canonical.toLowerCase(), unit);
}

for (const [alias, canonical] of Object.entries(UNIT_ALIASES)) {
	const unit = UNITS.get(canonical.toLowerCase());
	if (unit) {
		UNITS.set(normalizeUnit(alias), unit);
	}
}

export default class ObsidianUnitsPlugin extends Plugin {
	settings: ObsidianUnitsSettings = DEFAULT_SETTINGS;
	private rustEngineReady = false;

	async onload() {
		await this.loadSettings();
		await this.initializeRustEngine();

		this.addRibbonIcon('calculator', 'Convert units on current line', () => {
			this.convertActiveEditor();
		});

		this.addCommand({
			id: 'convert-selection-or-line',
			name: 'Convert units in selection or current line',
			editorCallback: (editor: Editor) => {
				this.convertEditorExpression(editor);
			},
		});

		this.addCommand({
			id: 'insert-conversion-result',
			name: 'Insert unit conversion result only',
			editorCallback: (editor: Editor) => {
				this.insertResultOnly(editor);
			},
		});

		this.addSettingTab(new ObsidianUnitsSettingTab(this.app, this));
		this.registerEditorExtension(createObsidianUnitsLivePreviewExtension(this));
		this.registerMarkdownPostProcessor((element) => renderInlineCodeConversions(element, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	evaluateInlineExpression(text: string, variables: VariableMap = new Map()): InlineEvaluation | null {
		const { expression, mode } = parseInlineRenderMode(text);

		if (this.rustEngineReady) {
			try {
				const renderedText = evaluateInlineWithRust(expression, mode, this.settings.precision);
				return {
					text: renderedText,
					consumeTrailingS: renderedText.endsWith('s'),
				};
			} catch {
				// The Rust engine is currently narrower than the TS fallback while the port is in progress.
			}
		}

		return evaluateInlineExpressionFallback(text, this.settings.precision, variables);
	}

	private async initializeRustEngine() {
		try {
			const wasmPath = `${this.app.vault.configDir}/plugins/${this.manifest.id}/obsidian_units_core_bg.wasm`;
			const wasmBuffer = await this.app.vault.adapter.readBinary(wasmPath);
			await initObsidianUnitsCore(wasmBuffer);
			this.rustEngineReady = true;
		} catch (error) {
			this.rustEngineReady = false;
			console.warn('Obsidian Units Rust engine unavailable; using TypeScript fallback.', error);
		}
	}

	private convertActiveEditor() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('Open a note to convert units.');
			return;
		}

		this.convertEditorExpression(activeView.editor);
	}

	private convertEditorExpression(editor: Editor) {
		const range = getExpressionRange(editor);
		const conversion = parseConversion(range.text);

		if (!conversion) {
			new Notice('Could not find a unit conversion like "5 ft to cm".');
			return;
		}

		const replacement = formatConversion(conversion, this.settings.precision);
		editor.replaceRange(replacement, range.from, range.to);
		editor.setCursor({ line: range.from.line, ch: range.from.ch + replacement.length });
	}

	private insertResultOnly(editor: Editor) {
		const range = getExpressionRange(editor);
		const conversion = parseConversion(range.text);

		if (!conversion) {
			new Notice('Could not find a unit conversion like "5 ft to cm".');
			return;
		}

		editor.replaceSelection(formatResult(conversion, this.settings.precision));
	}
}

function getExpressionRange(editor: Editor) {
	const selection = editor.getSelection();
	if (selection.trim().length > 0) {
		return {
			text: selection,
			from: editor.getCursor('from'),
			to: editor.getCursor('to'),
		};
	}

	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	return {
		text: line,
		from: { line: cursor.line, ch: 0 },
		to: { line: cursor.line, ch: line.length },
	};
}

function parseConversion(text: string): Conversion | null {
	const cleaned = stripExistingResult(stripInlineCodeMarkers(text.trim()));
	const match = cleaned.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s+(.+?)\s*(?:->|\bto\b|\bas\b|\bin\b)\s*(.+)$/i);
	if (!match) {
		return null;
	}

	const input = Number(match[1]);
	const source = findUnit(match[2]);
	const target = findUnit(match[3]);

	if (!Number.isFinite(input) || !source || !target || source.dimension !== target.dimension) {
		return null;
	}

	return {
		input,
		source,
		target,
		output: convert(input, source, target),
	};
}

function parseInlineConversion(text: string): InlineConversion | null {
	const { expression, mode } = parseInlineRenderMode(text);
	const conversion = parseConversion(expression);

	if (!conversion) {
		return null;
	}

	return { conversion, mode };
}

function parseInlineRenderMode(text: string): { expression: string; mode: InlineRenderMode } {
	const match = text.match(/^(.*?)\s*\|\s*(result|value|unit)\s*$/i);
	if (!match) {
		return { expression: text, mode: 'result' };
	}

	return {
		expression: match[1].trim(),
		mode: match[2].toLowerCase() as InlineRenderMode,
	};
}

function evaluateInlineExpressionFallback(text: string, precision: number, variables: VariableMap = new Map()): InlineEvaluation | null {
	const inlineConversion = parseInlineConversion(text);
	if (inlineConversion) {
		const renderedText = formatInlineConversion(inlineConversion, precision);
		return {
			text: renderedText,
			consumeTrailingS: renderedText.endsWith('s'),
		};
	}

	const arithmeticResult = parseArithmetic(text, variables);
	if (arithmeticResult === null) {
		return null;
	}

	return {
		text: formatNumber(arithmeticResult, precision),
		consumeTrailingS: false,
	};
}

function stripInlineCodeMarkers(text: string): string {
	const match = text.match(/^`([^`]+)`$/);
	return match ? match[1].trim() : text;
}

function stripExistingResult(text: string): string {
	return text.replace(/\s+=\s+-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s+.+$/i, '');
}

function findUnit(rawUnit: string): Unit | null {
	const normalized = normalizeUnit(rawUnit);
	return UNITS.get(normalized) ?? null;
}

function normalizeUnit(unit: string): string {
	return unit
		.trim()
		.toLowerCase()
		.replace(/[°º]/g, '')
		.replace(/μ/g, 'u')
		.replace(/\bsquare\b/g, 'sq')
		.replace(/\s+/g, ' ')
		.replace(/\s*\^\s*/g, '^')
		.replace(/\s*\/\s*/g, '/');
}

function convert(value: number, source: Unit, target: Unit): number {
	if (source.kind === 'linear' && target.kind === 'linear') {
		return value * source.toBase / target.toBase;
	}

	if (source.kind === 'affine' && target.kind === 'affine') {
		return target.fromBase(source.toBase(value));
	}

	throw new Error('Cannot convert between incompatible unit kinds.');
}

function formatConversion(conversion: Conversion, precision: number): string {
	return `${conversion.input} ${formatUnit(conversion.source, conversion.input)} = ${formatResult(conversion, precision)}`;
}

function formatInlineConversion(inlineConversion: InlineConversion, precision: number): string {
	const { conversion, mode } = inlineConversion;

	switch (mode) {
		case 'value':
			return formatNumber(conversion.output, precision);
		case 'unit':
			return formatUnitName(conversion.target, conversion.output);
		case 'result':
			return formatResultForSentence(conversion, precision);
	}
}

function formatResult(conversion: Conversion, precision: number): string {
	return `${formatNumber(conversion.output, precision)} ${formatUnit(conversion.target, conversion.output)}`;
}

function formatResultForSentence(conversion: Conversion, precision: number): string {
	return `${formatNumber(conversion.output, precision)} ${formatUnitName(conversion.target, conversion.output)}`;
}

function formatUnit(unit: Unit, value: number): string {
	const display = UNIT_DISPLAYS[unit.canonical.toLowerCase()];
	if (!display) {
		return unit.canonical;
	}

	const fullName = Math.abs(value) === 1 ? display.singular : display.plural;
	return `${fullName} (${display.abbr})`;
}

function formatUnitName(unit: Unit, value: number): string {
	const display = UNIT_DISPLAYS[unit.canonical.toLowerCase()];
	if (!display) {
		return unit.canonical;
	}

	return Math.abs(value) === 1 ? display.singular : display.plural;
}

function formatNumber(value: number, precision: number): string {
	if (Object.is(value, -0)) {
		return '0';
	}

	const formatted = value.toFixed(precision);
	return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function parseArithmetic(text: string, variables: VariableMap = new Map()): number | null {
	const expression = resolveVariablesInExpression(stripArithmeticEquals(stripInlineCodeMarkers(text.trim())), variables);
	if (!looksLikeArithmetic(expression)) {
		return null;
	}

	const parser = new ArithmeticParser(expression);
	const value = parser.parse();
	return value !== null && Number.isFinite(value) ? value : null;
}

function stripArithmeticEquals(text: string): string {
	return text.replace(/\s*=\s*$/, '').trim();
}

function looksLikeArithmetic(text: string): boolean {
	return /^(?=.*\d)[\d+\-*/^().\s]+$/.test(text);
}

function resolveVariablesInExpression(expression: string, variables: VariableMap): string {
	let resolved = expression;
	const variableEntries = Array.from(variables.entries()).sort((a, b) => b[0].length - a[0].length);

	for (const [name, value] of variableEntries) {
		const pattern = name
			.split(/\s+/)
			.map(escapeRegExp)
			.join('\\s+');
		const regex = new RegExp(`(^|[^A-Za-z0-9_])(${pattern})(?=$|[^A-Za-z0-9_])`, 'gi');
		resolved = resolved.replace(regex, (_match, prefix) => `${prefix}(${formatNumber(value, 12)})`);
	}

	return resolved;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ArithmeticParser {
	private index = 0;

	constructor(private readonly input: string) {}

	parse(): number | null {
		const value = this.parseExpression();
		this.skipWhitespace();
		return value !== null && this.index === this.input.length ? value : null;
	}

	private parseExpression(): number | null {
		let value = this.parseTerm();
		if (value === null) {
			return null;
		}

		while (true) {
			this.skipWhitespace();
			const operator = this.peek();
			if (operator !== '+' && operator !== '-') {
				return value;
			}

			this.index++;
			const rhs = this.parseTerm();
			if (rhs === null) {
				return null;
			}

			value = operator === '+' ? value + rhs : value - rhs;
		}
	}

	private parseTerm(): number | null {
		let value = this.parsePower();
		if (value === null) {
			return null;
		}

		while (true) {
			this.skipWhitespace();
			const operator = this.peek();
			if (operator !== '*' && operator !== '/') {
				if (operator !== '(') {
					return value;
				}

				const rhs = this.parsePower();
				if (rhs === null) {
					return null;
				}

				value *= rhs;
				continue;
			}

			this.index++;
			const rhs = this.parsePower();
			if (rhs === null) {
				return null;
			}

			value = operator === '*' ? value * rhs : value / rhs;
		}
	}

	private parsePower(): number | null {
		const base = this.parseUnary();
		if (base === null) {
			return null;
		}

		this.skipWhitespace();
		if (this.peek() !== '^') {
			return base;
		}

		this.index++;
		const exponent = this.parsePower();
		return exponent === null ? null : Math.pow(base, exponent);
	}

	private parseUnary(): number | null {
		this.skipWhitespace();
		const operator = this.peek();
		if (operator !== '+' && operator !== '-') {
			return this.parsePrimary();
		}

		this.index++;
		const value = this.parseUnary();
		if (value === null) {
			return null;
		}

		return operator === '-' ? -value : value;
	}

	private parsePrimary(): number | null {
		this.skipWhitespace();
		if (this.peek() === '(') {
			this.index++;
			const value = this.parseExpression();
			this.skipWhitespace();
			if (value === null || this.peek() !== ')') {
				return null;
			}

			this.index++;
			return value;
		}

		return this.parseNumber();
	}

	private parseNumber(): number | null {
		this.skipWhitespace();
		const start = this.index;
		let sawDigit = false;

		while (/\d/.test(this.peek())) {
			sawDigit = true;
			this.index++;
		}

		if (this.peek() === '.') {
			this.index++;
			while (/\d/.test(this.peek())) {
				sawDigit = true;
				this.index++;
			}
		}

		if (!sawDigit) {
			this.index = start;
			return null;
		}

		const exponentStart = this.index;
		if (this.peek() === 'e' || this.peek() === 'E') {
			this.index++;
			if (this.peek() === '+' || this.peek() === '-') {
				this.index++;
			}

			let sawExponentDigit = false;
			while (/\d/.test(this.peek())) {
				sawExponentDigit = true;
				this.index++;
			}

			if (!sawExponentDigit) {
				this.index = exponentStart;
			}
		}

		const value = Number(this.input.slice(start, this.index));
		return Number.isFinite(value) ? value : null;
	}

	private skipWhitespace() {
		while (/\s/.test(this.peek())) {
			this.index++;
		}
	}

	private peek(): string {
		return this.input[this.index] ?? '';
	}
}

function createObsidianUnitsLivePreviewExtension(plugin: ObsidianUnitsPlugin) {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildInlineCodeDecorations(view, plugin);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = buildInlineCodeDecorations(update.view, plugin);
			}
		}
	}, {
		decorations: (viewPlugin) => viewPlugin.decorations,
	});
}

function collectVariables(text: string, precision: number): VariableMap {
	const variables: VariableMap = new Map();
	const rawAssignmentPattern = /^\s*(?:[-*]\s*)?(.+?)\s*(?:=|:|\s-\s)\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:\s|$)/i;
	const inlineCodePattern = /`([^`\n]+)`/g;

	for (const line of text.split('\n')) {
		const rawMatch = line.match(rawAssignmentPattern);
		if (rawMatch) {
			setVariable(variables, rawMatch[1], Number(rawMatch[2]));
		}

		let match: RegExpExecArray | null;
		while ((match = inlineCodePattern.exec(line)) !== null) {
			const variableName = extractAssignmentName(line.slice(0, match.index));
			if (!variableName) {
				continue;
			}

			const inlineEvaluation = evaluateInlineExpressionFallback(match[1], precision, variables);
			if (!inlineEvaluation) {
				continue;
			}

			const value = extractLeadingNumber(inlineEvaluation.text);
			if (value !== null) {
				setVariable(variables, variableName, value);
			}
		}
	}

	return variables;
}

function setVariable(variables: VariableMap, rawName: string, value: number) {
	const name = normalizeVariableName(rawName);
	if (name.length > 0 && Number.isFinite(value)) {
		variables.set(name, value);
	}
}

function extractAssignmentName(prefix: string): string | null {
	const match = prefix.match(/(?:^|\n)\s*(?:[-*]\s*)?(.+?)\s*(?:=|:|\s-\s)\s*$/);
	return match ? match[1] : null;
}

function extractLeadingNumber(text: string): number | null {
	const match = text.trim().match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
	if (!match) {
		return null;
	}

	const value = Number(match[0]);
	return Number.isFinite(value) ? value : null;
}

function normalizeVariableName(name: string): string {
	return name
		.replace(/[`*_#>\[\]()]/g, ' ')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();
}

function buildInlineCodeDecorations(view: EditorView, plugin: ObsidianUnitsPlugin): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	for (const range of view.visibleRanges) {
		const startLine = view.state.doc.lineAt(range.from);
		const endLine = view.state.doc.lineAt(range.to);

		for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber++) {
			const line = view.state.doc.line(lineNumber);
			const inlineCodePattern = /`([^`\n]+)`/g;
			let match: RegExpExecArray | null;

			while ((match = inlineCodePattern.exec(line.text)) !== null) {
				const from = line.from + match.index;
				const variables = collectVariables(view.state.doc.sliceString(0, from), plugin.settings.precision);
				const inlineEvaluation = plugin.evaluateInlineExpression(match[1], variables);
				if (!inlineEvaluation) {
					continue;
				}

				const localTo = match.index + match[0].length;
				const shouldConsumeTrailingS = inlineEvaluation.consumeTrailingS && line.text.charAt(localTo) === 's';
				const pos = line.from + localTo + (shouldConsumeTrailingS ? 1 : 0);
				if (selectionOverlapsRange(view, from, pos)) {
					continue;
				}

				decorations.push(Decoration.replace({
					widget: new ObsidianUnitsResultWidget(inlineEvaluation.text),
				}).range(from, pos));
			}
		}
	}

	return Decoration.set(decorations, true);
}

function selectionOverlapsRange(view: EditorView, from: number, to: number): boolean {
	return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

function renderInlineCodeConversions(element: HTMLElement, plugin: ObsidianUnitsPlugin) {
	for (const codeElement of Array.from(element.querySelectorAll('code'))) {
		if (codeElement.closest('pre')) {
			continue;
		}

		const inlineEvaluation = plugin.evaluateInlineExpression(
			codeElement.textContent ?? '',
			collectVariables(collectTextBeforeNode(element, codeElement), plugin.settings.precision),
		);
		if (!inlineEvaluation) {
			continue;
		}

		if (inlineEvaluation.consumeTrailingS) {
			consumeNextTextPrefix(codeElement, 's');
		}

		const result = createSpan({
			cls: 'obsidian-units-result',
			text: inlineEvaluation.text,
		});
		codeElement.replaceWith(result);
	}
}

function collectTextBeforeNode(root: Node, target: Node): string {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let text = '';
	let current = walker.nextNode();

	while (current) {
		if (current === target || current.parentNode === target) {
			break;
		}

		text += current.textContent ?? '';
		current = walker.nextNode();
	}

	return text;
}

function consumeNextTextPrefix(element: HTMLElement, prefix: string) {
	const nextNode = element.nextSibling;
	if (!nextNode || nextNode.nodeType !== Node.TEXT_NODE || !nextNode.textContent?.startsWith(prefix)) {
		return;
	}

	nextNode.textContent = nextNode.textContent.slice(prefix.length);
	if (nextNode.textContent.length === 0) {
		nextNode.parentNode?.removeChild(nextNode);
	}
}

class ObsidianUnitsResultWidget extends WidgetType {
	constructor(private readonly text: string) {
		super();
	}

	toDOM(): HTMLElement {
		return createSpan({
			cls: 'obsidian-units-result cm-obsidian-units-result',
			text: this.text,
		});
	}

	eq(other: ObsidianUnitsResultWidget): boolean {
		return other.text === this.text;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

class ObsidianUnitsSettingTab extends PluginSettingTab {
	plugin: ObsidianUnitsPlugin;

	constructor(app: App, plugin: ObsidianUnitsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Decimal precision')
			.setDesc('Maximum number of decimal places shown in conversion results.')
			.addSlider((slider) => slider
				.setLimits(0, 10, 1)
				.setValue(this.plugin.settings.precision)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.precision = value;
					await this.plugin.saveSettings();
				}));
	}
}
