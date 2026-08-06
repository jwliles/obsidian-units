import { App, Editor, MarkdownPostProcessorContext, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, editorLivePreviewField } from 'obsidian';
import { Prec, Range, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { DocumentEvaluationIndex, EvaluatedValue } from './src/calculations/types';
import { parseAggregate } from './src/calculations/aggregate';
import { evaluateDocument } from './src/document/evaluation-index';

type UnitDisplayForm = 'abbr' | 'name';

interface DensityEntry {
	name: string;
	value: number;
	unit: string;
}

interface ObsidianUnitsSettings {
	precision: number;
	renderInLivePreviewByDefault: boolean;
	expressionMarker: string;
	previousExpressionMarker: string;
	unitDisplayOverrides: Record<string, UnitDisplayForm>;
	densities: DensityEntry[];
}

export const DEFAULT_SETTINGS: ObsidianUnitsSettings = {
	precision: 4,
	renderInLivePreviewByDefault: true,
	expressionMarker: '=',
	previousExpressionMarker: '=',
	unitDisplayOverrides: {},
	densities: [],
};

const DENSITY_UNIT_OPTIONS = ['g/ml', 'kg/m^3', 'lb/ft^3', 'oz/fl oz'];

type EditorWithCodeMirror = Editor & { cm?: EditorView };
interface LivePreviewRenderingState {
	enabled: boolean;
	generation: number;
}

const setLivePreviewRenderingEffect = StateEffect.define<boolean>();
const refreshLivePreviewRenderingEffect = StateEffect.define<null>();

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
	{ canonical: 'dm', dimension: 'length', kind: 'linear', toBase: 0.1 },
	{ canonical: 'm', dimension: 'length', kind: 'linear', toBase: 1 },
	{ canonical: 'dam', dimension: 'length', kind: 'linear', toBase: 10 },
	{ canonical: 'hm', dimension: 'length', kind: 'linear', toBase: 100 },
	{ canonical: 'km', dimension: 'length', kind: 'linear', toBase: 1000 },
	{ canonical: 'um', dimension: 'length', kind: 'linear', toBase: 0.000001 },
	{ canonical: 'nm', dimension: 'length', kind: 'linear', toBase: 0.000000001 },
	{ canonical: 'ang', dimension: 'length', kind: 'linear', toBase: 0.0000000001 },
	{ canonical: 'in', dimension: 'length', kind: 'linear', toBase: 0.0254 },
	{ canonical: 'ft', dimension: 'length', kind: 'linear', toBase: 0.3048 },
	{ canonical: 'yd', dimension: 'length', kind: 'linear', toBase: 0.9144 },
	{ canonical: 'mi', dimension: 'length', kind: 'linear', toBase: 1609.344 },
	{ canonical: 'nmi', dimension: 'length', kind: 'linear', toBase: 1852 },
	{ canonical: 'rod', dimension: 'length', kind: 'linear', toBase: 5.0292 },
	{ canonical: 'fur', dimension: 'length', kind: 'linear', toBase: 201.168 },
	{ canonical: 'ly', dimension: 'length', kind: 'linear', toBase: 9460730472580800 },
	{ canonical: 'pc', dimension: 'length', kind: 'linear', toBase: 30856775814671900 },

	// Area, base square meter.
	{ canonical: 'um^2', dimension: 'area', kind: 'linear', toBase: 1e-12 },
	{ canonical: 'mm^2', dimension: 'area', kind: 'linear', toBase: 0.000001 },
	{ canonical: 'cm^2', dimension: 'area', kind: 'linear', toBase: 0.0001 },
	{ canonical: 'dm^2', dimension: 'area', kind: 'linear', toBase: 0.01 },
	{ canonical: 'm^2', dimension: 'area', kind: 'linear', toBase: 1 },
	{ canonical: 'dam^2', dimension: 'area', kind: 'linear', toBase: 100 },
	{ canonical: 'hm^2', dimension: 'area', kind: 'linear', toBase: 10000 },
	{ canonical: 'km^2', dimension: 'area', kind: 'linear', toBase: 1000000 },
	{ canonical: 'in^2', dimension: 'area', kind: 'linear', toBase: 0.00064516 },
	{ canonical: 'ft^2', dimension: 'area', kind: 'linear', toBase: 0.09290304 },
	{ canonical: 'yd^2', dimension: 'area', kind: 'linear', toBase: 0.83612736 },
	{ canonical: 'mi^2', dimension: 'area', kind: 'linear', toBase: 2589988.110336 },
	{ canonical: 'acre', dimension: 'area', kind: 'linear', toBase: 4046.8564224 },
	{ canonical: 'ha', dimension: 'area', kind: 'linear', toBase: 10000 },

	// Mass, base gram.
	{ canonical: 'mcg', dimension: 'mass', kind: 'linear', toBase: 0.000001 },
	{ canonical: 'mg', dimension: 'mass', kind: 'linear', toBase: 0.001 },
	{ canonical: 'g', dimension: 'mass', kind: 'linear', toBase: 1 },
	{ canonical: 'kg', dimension: 'mass', kind: 'linear', toBase: 1000 },
	{ canonical: 'ct', dimension: 'mass', kind: 'linear', toBase: 0.2 },
	{ canonical: 'oz', dimension: 'mass', kind: 'linear', toBase: 28.349523125 },
	{ canonical: 'lb', dimension: 'mass', kind: 'linear', toBase: 453.59237 },
	{ canonical: 'st', dimension: 'mass', kind: 'linear', toBase: 6350.29318 },
	{ canonical: 'ton', dimension: 'mass', kind: 'linear', toBase: 907184.74 },
	{ canonical: 'tonne', dimension: 'mass', kind: 'linear', toBase: 1000000 },

	// Volume, base liter.
	{ canonical: 'ml', dimension: 'volume', kind: 'linear', toBase: 0.001 },
	{ canonical: 'cl', dimension: 'volume', kind: 'linear', toBase: 0.01 },
	{ canonical: 'dl', dimension: 'volume', kind: 'linear', toBase: 0.1 },
	{ canonical: 'l', dimension: 'volume', kind: 'linear', toBase: 1 },
	{ canonical: 'tsp', dimension: 'volume', kind: 'linear', toBase: 0.00492892159375 },
	{ canonical: 'tbsp', dimension: 'volume', kind: 'linear', toBase: 0.01478676478125 },
	{ canonical: 'fl oz', dimension: 'volume', kind: 'linear', toBase: 0.0295735295625 },
	{ canonical: 'cup', dimension: 'volume', kind: 'linear', toBase: 0.2365882365 },
	{ canonical: 'pt', dimension: 'volume', kind: 'linear', toBase: 0.473176473 },
	{ canonical: 'qt', dimension: 'volume', kind: 'linear', toBase: 0.946352946 },
	{ canonical: 'gal', dimension: 'volume', kind: 'linear', toBase: 3.785411784 },
	{ canonical: 'in^3', dimension: 'volume', kind: 'linear', toBase: 0.016387064 },
	{ canonical: 'ft^3', dimension: 'volume', kind: 'linear', toBase: 28.316846592 },
	{ canonical: 'yd^3', dimension: 'volume', kind: 'linear', toBase: 764.554857984 },
	{ canonical: 'm^3', dimension: 'volume', kind: 'linear', toBase: 1000 },

	// Speed, base meter per second.
	{ canonical: 'cm/s', dimension: 'speed', kind: 'linear', toBase: 0.01 },
	{ canonical: 'm/s', dimension: 'speed', kind: 'linear', toBase: 1 },
	{ canonical: 'm/min', dimension: 'speed', kind: 'linear', toBase: 1 / 60 },
	{ canonical: 'm/h', dimension: 'speed', kind: 'linear', toBase: 1 / 3600 },
	{ canonical: 'km/h', dimension: 'speed', kind: 'linear', toBase: 0.2777777777777778 },
	{ canonical: 'km/s', dimension: 'speed', kind: 'linear', toBase: 1000 },
	{ canonical: 'mph', dimension: 'speed', kind: 'linear', toBase: 0.44704 },
	{ canonical: 'knot', dimension: 'speed', kind: 'linear', toBase: 0.5144444444444445 },
	{ canonical: 'ft/s', dimension: 'speed', kind: 'linear', toBase: 0.3048 },
	{ canonical: 'ft/min', dimension: 'speed', kind: 'linear', toBase: 0.00508 },
	{ canonical: 'ft/h', dimension: 'speed', kind: 'linear', toBase: 0.00008466666666666667 },

	// Acceleration, base meter per second squared.
	{ canonical: 'cm/s^2', dimension: 'acceleration', kind: 'linear', toBase: 0.01 },
	{ canonical: 'm/s^2', dimension: 'acceleration', kind: 'linear', toBase: 1 },
	{ canonical: 'km/h/s', dimension: 'acceleration', kind: 'linear', toBase: 0.2777777777777778 },
	{ canonical: 'in/s^2', dimension: 'acceleration', kind: 'linear', toBase: 0.0254 },
	{ canonical: 'ft/s^2', dimension: 'acceleration', kind: 'linear', toBase: 0.3048 },
	{ canonical: 'mph/s', dimension: 'acceleration', kind: 'linear', toBase: 0.44704 },

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

	// Time, base second.
	{ canonical: 'ns', dimension: 'time', kind: 'linear', toBase: 1e-9 },
	{ canonical: 'us', dimension: 'time', kind: 'linear', toBase: 0.000001 },
	{ canonical: 'ms', dimension: 'time', kind: 'linear', toBase: 0.001 },
	{ canonical: 's', dimension: 'time', kind: 'linear', toBase: 1 },
	{ canonical: 'min', dimension: 'time', kind: 'linear', toBase: 60 },
	{ canonical: 'h', dimension: 'time', kind: 'linear', toBase: 3600 },
	{ canonical: 'd', dimension: 'time', kind: 'linear', toBase: 86400 },
	{ canonical: 'wk', dimension: 'time', kind: 'linear', toBase: 604800 },
	{ canonical: 'yr', dimension: 'time', kind: 'linear', toBase: 31556926 },

	// Pressure, base pascal.
	{ canonical: 'pa', dimension: 'pressure', kind: 'linear', toBase: 1 },
	{ canonical: 'kpa', dimension: 'pressure', kind: 'linear', toBase: 1000 },
	{ canonical: 'mpa', dimension: 'pressure', kind: 'linear', toBase: 1000000 },
	{ canonical: 'bar', dimension: 'pressure', kind: 'linear', toBase: 100000 },
	{ canonical: 'mbar', dimension: 'pressure', kind: 'linear', toBase: 100 },
	{ canonical: 'atm', dimension: 'pressure', kind: 'linear', toBase: 101325 },
	{ canonical: 'psi', dimension: 'pressure', kind: 'linear', toBase: 6894.757293168 },
	{ canonical: 'torr', dimension: 'pressure', kind: 'linear', toBase: 133.32236842105263 },
	{ canonical: 'mmhg', dimension: 'pressure', kind: 'linear', toBase: 133.322387415 },

	// Energy, base joule.
	{ canonical: 'ev', dimension: 'energy', kind: 'linear', toBase: 1.602176634e-19 },
	{ canonical: 'millijoule', dimension: 'energy', kind: 'linear', toBase: 0.001 },
	{ canonical: 'j', dimension: 'energy', kind: 'linear', toBase: 1 },
	{ canonical: 'kj', dimension: 'energy', kind: 'linear', toBase: 1000 },
	{ canonical: 'mj', dimension: 'energy', kind: 'linear', toBase: 1000000 },
	{ canonical: 'gj', dimension: 'energy', kind: 'linear', toBase: 1000000000 },
	{ canonical: 'wh', dimension: 'energy', kind: 'linear', toBase: 3600 },
	{ canonical: 'kwh', dimension: 'energy', kind: 'linear', toBase: 3600000 },
	{ canonical: 'cal', dimension: 'energy', kind: 'linear', toBase: 4.184 },
	{ canonical: 'kcal', dimension: 'energy', kind: 'linear', toBase: 4184 },
	{ canonical: 'btu', dimension: 'energy', kind: 'linear', toBase: 1055.05585262 },
	{ canonical: 'ft*lbf', dimension: 'energy', kind: 'linear', toBase: 1.3558179483314004 },

	// Power, base watt.
	{ canonical: 'milliwatt', dimension: 'power', kind: 'linear', toBase: 0.001 },
	{ canonical: 'w', dimension: 'power', kind: 'linear', toBase: 1 },
	{ canonical: 'kw', dimension: 'power', kind: 'linear', toBase: 1000 },
	{ canonical: 'mw', dimension: 'power', kind: 'linear', toBase: 1000000 },
	{ canonical: 'gw', dimension: 'power', kind: 'linear', toBase: 1000000000 },
	{ canonical: 'hp', dimension: 'power', kind: 'linear', toBase: 745.6998715822702 },
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
	"'": 'ft',
	'"': 'in',
	'centimeters per second squared': 'cm/s^2',
	'centimeters per second': 'cm/s',
	'centimetres per second squared': 'cm/s^2',
	'centimetres per second': 'cm/s',
	'cm2': 'cm^2',
	'cu ft': 'ft^3',
	'cu in': 'in^3',
	'cu yd': 'yd^3',
	'cubic feet': 'ft^3',
	'cubic foot': 'ft^3',
	'cubic inch': 'in^3',
	'cubic inches': 'in^3',
	'cubic meter': 'm^3',
	'cubic meters': 'm^3',
	'cubic yard': 'yd^3',
	'cubic yards': 'yd^3',
	'dam2': 'dam^2',
	'degrees celsius': 'C',
	'degrees fahrenheit': 'F',
	'degrees rankine': 'R',
	'dm2': 'dm^2',
	'electron volt': 'ev',
	'electron volts': 'ev',
	'exabyte (eb)': 'eb',
	'feet per hour': 'ft/h',
	'feet per minute': 'ft/min',
	'feet per second squared': 'ft/s^2',
	'feet per second': 'ft/s',
	'fluid ounce': 'fl oz',
	'fluid ounces': 'fl oz',
	'foot pound': 'ft*lbf',
	'foot pounds': 'ft*lbf',
	'foot-pound': 'ft*lbf',
	'foot-pounds': 'ft*lbf',
	'ft2': 'ft^2',
	'ft3': 'ft^3',
	'gigabyte (gb)': 'gb',
	'hm2': 'hm^2',
	'in2': 'in^2',
	'in3': 'in^3',
	'inches per second squared': 'in/s^2',
	'kilobyte (kb)': 'kb',
	'kilometers per hour per second': 'km/h/s',
	'kilometers per hour': 'km/h',
	'kilometers per second': 'km/s',
	'kilometres per hour': 'km/h',
	'kilometres per second': 'km/s',
	'kilowatt hour': 'kwh',
	'kilowatt hours': 'kwh',
	'km2': 'km^2',
	'kmh': 'km/h',
	'light year': 'ly',
	'light years': 'ly',
	'm2': 'm^2',
	'm3': 'm^3',
	'megabyte (mb)': 'mb',
	'meters per hour': 'm/h',
	'meters per minute': 'm/min',
	'meters per second squared': 'm/s^2',
	'meters per second': 'm/s',
	'metres per hour': 'm/h',
	'metres per minute': 'm/min',
	'metres per second squared': 'm/s^2',
	'metres per second': 'm/s',
	'mi2': 'mi^2',
	'miles per hour per second': 'mph/s',
	'miles per hour': 'mph',
	'mm hg': 'mmhg',
	'mm2': 'mm^2',
	'mps': 'm/s',
	'nautical mile': 'nmi',
	'nautical miles': 'nmi',
	'petabyte (pb)': 'pb',
	'sq cm': 'cm^2',
	'sq dam': 'dam^2',
	'sq dm': 'dm^2',
	'sq ft': 'ft^2',
	'sq hm': 'hm^2',
	'sq in': 'in^2',
	'sq km': 'km^2',
	'sq m': 'm^2',
	'sq mi': 'mi^2',
	'sq mm': 'mm^2',
	'sq um': 'um^2',
	'sq yd': 'yd^2',
	'square centimeter': 'cm^2',
	'square centimeters': 'cm^2',
	'square decameter': 'dam^2',
	'square decameters': 'dam^2',
	'square decimeter': 'dm^2',
	'square decimeters': 'dm^2',
	'square feet': 'ft^2',
	'square foot': 'ft^2',
	'square hectometer': 'hm^2',
	'square hectometers': 'hm^2',
	'square inch': 'in^2',
	'square inches': 'in^2',
	'square kilometer': 'km^2',
	'square kilometers': 'km^2',
	'square meter': 'm^2',
	'square meters': 'm^2',
	'square micrometer': 'um^2',
	'square micrometers': 'um^2',
	'square micron': 'um^2',
	'square microns': 'um^2',
	'square mile': 'mi^2',
	'square miles': 'mi^2',
	'square millimeter': 'mm^2',
	'square millimeters': 'mm^2',
	'square yard': 'yd^2',
	'square yards': 'yd^2',
	'terabyte (tb)': 'tb',
	'um2': 'um^2',
	'watt hour': 'wh',
	'watt hours': 'wh',
	'yd2': 'yd^2',
	'yd3': 'yd^3',
	acres: 'acre',
	angstrom: 'ang',
	angstroms: 'ang',
	atmosphere: 'atm',
	atmospheres: 'atm',
	b: 'bit',
	bars: 'bar',
	bit: 'bit',
	bits: 'bit',
	btu: 'btu',
	btus: 'btu',
	byte: 'byte',
	bytes: 'byte',
	calorie: 'cal',
	calories: 'cal',
	carat: 'ct',
	carats: 'ct',
	celsius: 'C',
	centiliter: 'cl',
	centiliters: 'cl',
	centilitre: 'cl',
	centilitres: 'cl',
	centimeter: 'cm',
	centimeters: 'cm',
	cups: 'cup',
	day: 'd',
	days: 'd',
	decameter: 'dam',
	decameters: 'dam',
	deciliter: 'dl',
	deciliters: 'dl',
	decilitre: 'dl',
	decilitres: 'dl',
	decimeter: 'dm',
	decimeters: 'dm',
	dekameter: 'dam',
	dekameters: 'dam',
	ev: 'ev',
	exabyte: 'eb',
	exabytes: 'eb',
	exbibyte: 'eib',
	exbibytes: 'eib',
	fahrenheit: 'F',
	feet: 'ft',
	foot: 'ft',
	furlong: 'fur',
	furlongs: 'fur',
	gallon: 'gal',
	gallons: 'gal',
	gibibyte: 'gib',
	gibibytes: 'gib',
	gigabyte: 'gb',
	gigabytes: 'gb',
	gigajoule: 'gj',
	gigajoules: 'gj',
	gigawatt: 'gw',
	gigawatts: 'gw',
	gram: 'g',
	grams: 'g',
	hectare: 'ha',
	hectares: 'ha',
	hectometer: 'hm',
	hectometers: 'hm',
	horsepower: 'hp',
	hour: 'h',
	hours: 'h',
	hr: 'h',
	hrs: 'h',
	inch: 'in',
	inches: 'in',
	joule: 'j',
	joules: 'j',
	kelvin: 'K',
	kgs: 'kg',
	kibibyte: 'kib',
	kibibytes: 'kib',
	kilobyte: 'kb',
	kilobytes: 'kb',
	kilocalorie: 'kcal',
	kilocalories: 'kcal',
	kilogram: 'kg',
	kilograms: 'kg',
	kilojoule: 'kj',
	kilojoules: 'kj',
	kilometer: 'km',
	kilometers: 'km',
	kilometre: 'km',
	kilometres: 'km',
	kilopascal: 'kpa',
	kilopascals: 'kpa',
	kilowatt: 'kw',
	kilowatts: 'kw',
	kn: 'knot',
	knots: 'knot',
	kph: 'km/h',
	kt: 'knot',
	lbs: 'lb',
	liter: 'l',
	liters: 'l',
	litre: 'l',
	litres: 'l',
	mebibyte: 'mib',
	mebibytes: 'mib',
	megabyte: 'mb',
	megabytes: 'mb',
	megajoule: 'mj',
	megajoules: 'mj',
	megapascal: 'mpa',
	megapascals: 'mpa',
	megawatt: 'mw',
	megawatts: 'mw',
	meter: 'm',
	meters: 'm',
	metre: 'm',
	metres: 'm',
	mgs: 'mg',
	microgram: 'mcg',
	micrograms: 'mcg',
	micrometer: 'um',
	micrometers: 'um',
	micrometre: 'um',
	micrometres: 'um',
	micron: 'um',
	microns: 'um',
	microsecond: 'us',
	microseconds: 'us',
	mile: 'mi',
	miles: 'mi',
	millibar: 'mbar',
	millibars: 'mbar',
	milligram: 'mg',
	milligrams: 'mg',
	millijoule: 'millijoule',
	millijoules: 'millijoule',
	milliliter: 'ml',
	milliliters: 'ml',
	millilitre: 'ml',
	millilitres: 'ml',
	millimeter: 'mm',
	millimeters: 'mm',
	millisecond: 'ms',
	milliseconds: 'ms',
	milliwatt: 'milliwatt',
	milliwatts: 'milliwatt',
	minute: 'min',
	minutes: 'min',
	mmhg: 'mmhg',
	nanometer: 'nm',
	nanometers: 'nm',
	nanometre: 'nm',
	nanometres: 'nm',
	nanosecond: 'ns',
	nanoseconds: 'ns',
	ounce: 'oz',
	ounces: 'oz',
	ozs: 'oz',
	pa: 'pa',
	parsec: 'pc',
	parsecs: 'pc',
	pascal: 'pa',
	pascals: 'pa',
	pebibyte: 'pib',
	pebibytes: 'pib',
	petabyte: 'pb',
	petabytes: 'pb',
	pint: 'pt',
	pints: 'pt',
	pound: 'lb',
	pounds: 'lb',
	psi: 'psi',
	quart: 'qt',
	quarts: 'qt',
	ra: 'R',
	rankine: 'R',
	rod: 'rod',
	rods: 'rod',
	sec: 's',
	second: 's',
	seconds: 's',
	secs: 's',
	sqcm: 'cm^2',
	sqdam: 'dam^2',
	sqdm: 'dm^2',
	sqft: 'ft^2',
	sqhm: 'hm^2',
	sqin: 'in^2',
	sqkm: 'km^2',
	sqm: 'm^2',
	sqmi: 'mi^2',
	sqmm: 'mm^2',
	squm: 'um^2',
	sqyd: 'yd^2',
	stone: 'st',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
	tebibyte: 'tib',
	tebibytes: 'tib',
	terabyte: 'tb',
	terabytes: 'tb',
	tonnes: 'tonne',
	tons: 'ton',
	torr: 'torr',
	ug: 'mcg',
	watt: 'w',
	watts: 'w',
	week: 'wk',
	weeks: 'wk',
	yard: 'yd',
	yards: 'yd',
	year: 'yr',
	years: 'yr',
};

const UNIT_DISPLAYS: Record<string, UnitDisplay> = {
	'cm/s': { abbr: 'cm/s', singular: 'centimeter per second', plural: 'centimeters per second' },
	'cm/s^2': { abbr: 'cm/s^2', singular: 'centimeter per second squared', plural: 'centimeters per second squared' },
	'cm^2': { abbr: 'cm^2', singular: 'square centimeter', plural: 'square centimeters' },
	'dam^2': { abbr: 'dam^2', singular: 'square decameter', plural: 'square decameters' },
	'dm^2': { abbr: 'dm^2', singular: 'square decimeter', plural: 'square decimeters' },
	'fl oz': { abbr: 'fl oz', singular: 'fluid ounce', plural: 'fluid ounces' },
	'ft*lbf': { abbr: 'ft lbf', singular: 'foot-pound', plural: 'foot-pounds' },
	'ft/h': { abbr: 'ft/h', singular: 'foot per hour', plural: 'feet per hour' },
	'ft/min': { abbr: 'ft/min', singular: 'foot per minute', plural: 'feet per minute' },
	'ft/s': { abbr: 'ft/s', singular: 'foot per second', plural: 'feet per second' },
	'ft/s^2': { abbr: 'ft/s^2', singular: 'foot per second squared', plural: 'feet per second squared' },
	'ft^2': { abbr: 'ft^2', singular: 'square foot', plural: 'square feet' },
	'ft^3': { abbr: 'ft^3', singular: 'cubic foot', plural: 'cubic feet' },
	'hm^2': { abbr: 'hm^2', singular: 'square hectometer', plural: 'square hectometers' },
	'in/s^2': { abbr: 'in/s^2', singular: 'inch per second squared', plural: 'inches per second squared' },
	'in^2': { abbr: 'in^2', singular: 'square inch', plural: 'square inches' },
	'in^3': { abbr: 'in^3', singular: 'cubic inch', plural: 'cubic inches' },
	'km/h': { abbr: 'km/h', singular: 'kilometer per hour', plural: 'kilometers per hour' },
	'km/h/s': { abbr: 'km/h/s', singular: 'kilometer per hour per second', plural: 'kilometers per hour per second' },
	'km/s': { abbr: 'km/s', singular: 'kilometer per second', plural: 'kilometers per second' },
	'km^2': { abbr: 'km^2', singular: 'square kilometer', plural: 'square kilometers' },
	'm/h': { abbr: 'm/h', singular: 'meter per hour', plural: 'meters per hour' },
	'm/min': { abbr: 'm/min', singular: 'meter per minute', plural: 'meters per minute' },
	'm/s': { abbr: 'm/s', singular: 'meter per second', plural: 'meters per second' },
	'm/s^2': { abbr: 'm/s^2', singular: 'meter per second squared', plural: 'meters per second squared' },
	'm^2': { abbr: 'm^2', singular: 'square meter', plural: 'square meters' },
	'm^3': { abbr: 'm^3', singular: 'cubic meter', plural: 'cubic meters' },
	'mi^2': { abbr: 'mi^2', singular: 'square mile', plural: 'square miles' },
	'mm^2': { abbr: 'mm^2', singular: 'square millimeter', plural: 'square millimeters' },
	'mph/s': { abbr: 'mph/s', singular: 'mile per hour per second', plural: 'miles per hour per second' },
	'um^2': { abbr: 'um^2', singular: 'square micrometer', plural: 'square micrometers' },
	'yd^2': { abbr: 'yd^2', singular: 'square yard', plural: 'square yards' },
	'yd^3': { abbr: 'yd^3', singular: 'cubic yard', plural: 'cubic yards' },
	acre: { abbr: 'ac', singular: 'acre', plural: 'acres' },
	ang: { abbr: 'angstrom', singular: 'angstrom', plural: 'angstroms' },
	atm: { abbr: 'atm', singular: 'atmosphere', plural: 'atmospheres' },
	bar: { abbr: 'bar', singular: 'bar', plural: 'bar' },
	bit: { abbr: 'bit', singular: 'bit', plural: 'bits' },
	btu: { abbr: 'BTU', singular: 'British thermal unit', plural: 'British thermal units' },
	byte: { abbr: 'B', singular: 'byte', plural: 'bytes' },
	c: { abbr: '°C', singular: 'degree Celsius', plural: 'degrees Celsius' },
	cal: { abbr: 'cal', singular: 'calorie', plural: 'calories' },
	cl: { abbr: 'cl', singular: 'centiliter', plural: 'centiliters' },
	cm: { abbr: 'cm', singular: 'centimeter', plural: 'centimeters' },
	ct: { abbr: 'ct', singular: 'carat', plural: 'carats' },
	cup: { abbr: 'cup', singular: 'cup', plural: 'cups' },
	d: { abbr: 'd', singular: 'day', plural: 'days' },
	dam: { abbr: 'dam', singular: 'decameter', plural: 'decameters' },
	dl: { abbr: 'dl', singular: 'deciliter', plural: 'deciliters' },
	dm: { abbr: 'dm', singular: 'decimeter', plural: 'decimeters' },
	eb: { abbr: 'EB', singular: 'exabyte', plural: 'exabytes' },
	eib: { abbr: 'EiB', singular: 'exbibyte', plural: 'exbibytes' },
	ev: { abbr: 'eV', singular: 'electron volt', plural: 'electron volts' },
	f: { abbr: '°F', singular: 'degree Fahrenheit', plural: 'degrees Fahrenheit' },
	ft: { abbr: 'ft', singular: 'foot', plural: 'feet' },
	fur: { abbr: 'fur', singular: 'furlong', plural: 'furlongs' },
	g: { abbr: 'g', singular: 'gram', plural: 'grams' },
	gal: { abbr: 'gal', singular: 'gallon', plural: 'gallons' },
	gb: { abbr: 'GB', singular: 'gigabyte', plural: 'gigabytes' },
	gib: { abbr: 'GiB', singular: 'gibibyte', plural: 'gibibytes' },
	gj: { abbr: 'GJ', singular: 'gigajoule', plural: 'gigajoules' },
	gw: { abbr: 'GW', singular: 'gigawatt', plural: 'gigawatts' },
	h: { abbr: 'h', singular: 'hour', plural: 'hours' },
	ha: { abbr: 'ha', singular: 'hectare', plural: 'hectares' },
	hm: { abbr: 'hm', singular: 'hectometer', plural: 'hectometers' },
	hp: { abbr: 'hp', singular: 'horsepower', plural: 'horsepower' },
	in: { abbr: 'in', singular: 'inch', plural: 'inches' },
	j: { abbr: 'J', singular: 'joule', plural: 'joules' },
	k: { abbr: 'K', singular: 'kelvin', plural: 'kelvin' },
	kb: { abbr: 'KB', singular: 'kilobyte', plural: 'kilobytes' },
	kcal: { abbr: 'kcal', singular: 'kilocalorie', plural: 'kilocalories' },
	kg: { abbr: 'kg', singular: 'kilogram', plural: 'kilograms' },
	kib: { abbr: 'KiB', singular: 'kibibyte', plural: 'kibibytes' },
	kj: { abbr: 'kJ', singular: 'kilojoule', plural: 'kilojoules' },
	km: { abbr: 'km', singular: 'kilometer', plural: 'kilometers' },
	knot: { abbr: 'kt', singular: 'knot', plural: 'knots' },
	kpa: { abbr: 'kPa', singular: 'kilopascal', plural: 'kilopascals' },
	kw: { abbr: 'kW', singular: 'kilowatt', plural: 'kilowatts' },
	kwh: { abbr: 'kWh', singular: 'kilowatt hour', plural: 'kilowatt hours' },
	l: { abbr: 'L', singular: 'liter', plural: 'liters' },
	lb: { abbr: 'lb', singular: 'pound', plural: 'pounds' },
	ly: { abbr: 'ly', singular: 'light year', plural: 'light years' },
	m: { abbr: 'm', singular: 'meter', plural: 'meters' },
	mb: { abbr: 'MB', singular: 'megabyte', plural: 'megabytes' },
	mbar: { abbr: 'mbar', singular: 'millibar', plural: 'millibars' },
	mcg: { abbr: 'mcg', singular: 'microgram', plural: 'micrograms' },
	mg: { abbr: 'mg', singular: 'milligram', plural: 'milligrams' },
	mi: { abbr: 'mi', singular: 'mile', plural: 'miles' },
	mib: { abbr: 'MiB', singular: 'mebibyte', plural: 'mebibytes' },
	millijoule: { abbr: 'mJ', singular: 'millijoule', plural: 'millijoules' },
	milliwatt: { abbr: 'mW', singular: 'milliwatt', plural: 'milliwatts' },
	min: { abbr: 'min', singular: 'minute', plural: 'minutes' },
	mj: { abbr: 'MJ', singular: 'megajoule', plural: 'megajoules' },
	ml: { abbr: 'ml', singular: 'milliliter', plural: 'milliliters' },
	mm: { abbr: 'mm', singular: 'millimeter', plural: 'millimeters' },
	mmhg: { abbr: 'mmHg', singular: 'millimeter of mercury', plural: 'millimeters of mercury' },
	mpa: { abbr: 'MPa', singular: 'megapascal', plural: 'megapascals' },
	mph: { abbr: 'mph', singular: 'mile per hour', plural: 'miles per hour' },
	ms: { abbr: 'ms', singular: 'millisecond', plural: 'milliseconds' },
	mw: { abbr: 'MW', singular: 'megawatt', plural: 'megawatts' },
	nm: { abbr: 'nm', singular: 'nanometer', plural: 'nanometers' },
	nmi: { abbr: 'nmi', singular: 'nautical mile', plural: 'nautical miles' },
	ns: { abbr: 'ns', singular: 'nanosecond', plural: 'nanoseconds' },
	oz: { abbr: 'oz', singular: 'ounce', plural: 'ounces' },
	pa: { abbr: 'Pa', singular: 'pascal', plural: 'pascals' },
	pb: { abbr: 'PB', singular: 'petabyte', plural: 'petabytes' },
	pc: { abbr: 'pc', singular: 'parsec', plural: 'parsecs' },
	pib: { abbr: 'PiB', singular: 'pebibyte', plural: 'pebibytes' },
	psi: { abbr: 'psi', singular: 'pound per square inch', plural: 'pounds per square inch' },
	pt: { abbr: 'pt', singular: 'pint', plural: 'pints' },
	qt: { abbr: 'qt', singular: 'quart', plural: 'quarts' },
	r: { abbr: '°R', singular: 'degree Rankine', plural: 'degrees Rankine' },
	rod: { abbr: 'rod', singular: 'rod', plural: 'rods' },
	s: { abbr: 's', singular: 'second', plural: 'seconds' },
	st: { abbr: 'st', singular: 'stone', plural: 'stone' },
	tb: { abbr: 'TB', singular: 'terabyte', plural: 'terabytes' },
	tbsp: { abbr: 'tbsp', singular: 'tablespoon', plural: 'tablespoons' },
	tib: { abbr: 'TiB', singular: 'tebibyte', plural: 'tebibytes' },
	ton: { abbr: 'ton', singular: 'ton', plural: 'tons' },
	tonne: { abbr: 't', singular: 'tonne', plural: 'tonnes' },
	torr: { abbr: 'Torr', singular: 'torr', plural: 'torr' },
	tsp: { abbr: 'tsp', singular: 'teaspoon', plural: 'teaspoons' },
	um: { abbr: 'um', singular: 'micrometer', plural: 'micrometers' },
	us: { abbr: 'us', singular: 'microsecond', plural: 'microseconds' },
	w: { abbr: 'W', singular: 'watt', plural: 'watts' },
	wh: { abbr: 'Wh', singular: 'watt hour', plural: 'watt hours' },
	wk: { abbr: 'wk', singular: 'week', plural: 'weeks' },
	yd: { abbr: 'yd', singular: 'yard', plural: 'yards' },
	yr: { abbr: 'yr', singular: 'year', plural: 'years' },
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

interface UnitSearchEntry {
	canonical: string;
	label: string;
	dimension: string;
	searchTokens: string[];
}

const UNIT_SEARCH_INDEX: UnitSearchEntry[] = (() => {
	const aliasesByCanonical = new Map<string, string[]>();
	for (const [alias, canonical] of Object.entries(UNIT_ALIASES)) {
		const list = aliasesByCanonical.get(canonical) ?? [];
		list.push(alias);
		aliasesByCanonical.set(canonical, list);
	}

	return [...LINEAR_UNITS, ...TEMPERATURE_UNITS].map((unit) => {
		const display = UNIT_DISPLAYS[unit.canonical.toLowerCase()];
		const tokens = new Set<string>();
		tokens.add(unit.canonical.toLowerCase());
		if (display) {
			tokens.add(display.abbr.toLowerCase());
			tokens.add(display.singular.toLowerCase());
			tokens.add(display.plural.toLowerCase());
		}
		for (const alias of aliasesByCanonical.get(unit.canonical) ?? []) {
			tokens.add(alias.toLowerCase());
		}

		return {
			canonical: unit.canonical,
			label: display ? `${display.plural} (${display.abbr})` : unit.canonical,
			dimension: unit.dimension,
			searchTokens: Array.from(tokens),
		};
	});
})();

function searchUnits(query: string, limit = 10): UnitSearchEntry[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) {
		return [];
	}
	const results: UnitSearchEntry[] = [];
	for (const entry of UNIT_SEARCH_INDEX) {
		if (entry.searchTokens.some((token) => token.includes(trimmed))) {
			results.push(entry);
			if (results.length >= limit) {
				break;
			}
		}
	}
	return results;
}

export default class ObsidianUnitsPlugin extends Plugin {
	settings: ObsidianUnitsSettings = DEFAULT_SETTINGS;
	private livePreviewRenderingField!: StateField<LivePreviewRenderingState>;
	private evaluationCache?: { source: string; settingsKey: string; index: DocumentEvaluationIndex };

	async onload() {
		await this.loadSettings();
		this.livePreviewRenderingField = createLivePreviewRenderingField(this);

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

		this.addCommand({
			id: 'toggle-active-live-preview-rendering',
			name: 'Toggle rendered calculations in active editor',
			callback: () => {
				this.toggleActiveLivePreviewRendering();
			},
		});

		this.addCommand({
			id: 'update-units-markers-in-current-file',
			name: 'Update Units markers in current file',
			editorCallback: (editor: Editor) => this.updateMarkersInCurrentFile(editor),
		});

		this.addSettingTab(new ObsidianUnitsSettingTab(this.app, this));
		this.registerEditorExtension([this.livePreviewRenderingField, Prec.highest(createObsidianUnitsLivePreviewExtension(this))]);
		this.registerMarkdownPostProcessor((element, ctx) => renderInlineCodeConversions(element, ctx, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (!isValidExpressionMarker(this.settings.expressionMarker)) this.settings.expressionMarker = DEFAULT_SETTINGS.expressionMarker;
		if (!isValidExpressionMarker(this.settings.previousExpressionMarker)) this.settings.previousExpressionMarker = this.settings.expressionMarker;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	evaluateInlineExpression(text: string, variables: VariableMap = new Map(), isExplicit = false): InlineEvaluation | null {
		return evaluateInlineExpressionFallback(text, this.settings, variables, isExplicit);
	}

	evaluateDocument(source: string): DocumentEvaluationIndex {
		const settingsKey = JSON.stringify([this.settings.precision, this.settings.expressionMarker, this.settings.previousExpressionMarker, this.settings.unitDisplayOverrides, this.settings.densities]);
		if (this.evaluationCache?.source === source && this.evaluationCache.settingsKey === settingsKey) {
			return this.evaluationCache.index;
		}
		const index = evaluateDocument(source, {
			formatNumber: (value, minimumDecimalPlaces = 0) => formatNumber(value, this.settings.precision, minimumDecimalPlaces),
			evaluateCompatibility: (expression, values) => evaluateCompatibilityExpression(expression, values, this.settings),
			marker: this.settings.expressionMarker,
			incorrectMarkers: [this.settings.previousExpressionMarker, DEFAULT_SETTINGS.expressionMarker],
		});
		this.evaluationCache = { source, settingsKey, index };
		return index;
	}

	private updateMarkersInCurrentFile(editor: Editor) {
		const from = this.settings.previousExpressionMarker;
		const to = this.settings.expressionMarker;
		if (from === to) {
			new Notice('The previous and current Units markers are the same.');
			return;
		}
		const update = planMarkerUpdate(editor.getValue(), from, to, this.settings);
		if (update.changed === 0) {
			new Notice(`No recognized Units expressions use the marker "${from}". ${update.ambiguous} ambiguous span(s) were left unchanged.`);
			return;
		}
		new MarkerUpdateConfirmModal(this.app, from, to, update, () => {
			editor.setValue(update.text);
			new Notice(`Updated ${update.changed} Units marker(s). ${update.ambiguous} ambiguous span(s) were left unchanged.`);
		}).open();
	}

	isLivePreviewRenderingEnabled(view: EditorView): boolean {
		return view.state.field(this.livePreviewRenderingField, false)?.enabled ?? this.settings.renderInLivePreviewByDefault;
	}

	livePreviewRenderingGeneration(view: EditorView): number {
		return view.state.field(this.livePreviewRenderingField, false)?.generation ?? 0;
	}

	livePreviewRenderingChanged(update: ViewUpdate): boolean {
		return update.startState.field(this.livePreviewRenderingField, false) !== update.state.field(this.livePreviewRenderingField, false);
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
		const conversion = parseConversion(range.text, this.settings);

		if (!conversion) {
			new Notice(diagnoseConversion(range.text, this.settings) ?? 'Could not find a unit conversion like "5 ft to cm".');
			return;
		}

		const replacement = formatConversion(conversion, this.settings.precision);
		editor.replaceRange(replacement, range.from, range.to);
		editor.setCursor({ line: range.from.line, ch: range.from.ch + replacement.length });
	}

	private insertResultOnly(editor: Editor) {
		const range = getExpressionRange(editor);
		const inlineCodePattern = /`([^`\n]+)`/g;
		const matches = Array.from(range.text.matchAll(inlineCodePattern));
		const rangeStartOffset = editor.posToOffset(range.from);
		const fullDoc = editor.getValue();
		const documentIndex = this.evaluateDocument(fullDoc);

		if (matches.length > 0) {
			let replacement = '';
			let cursor = 0;
			let evaluatedAny = false;
			let firstFailure: string | null = null;

			for (const match of matches) {
				const matchStart = match.index ?? 0;
				const matchEnd = matchStart + match[0].length;
				const prefixText = fullDoc.slice(0, rangeStartOffset + matchStart);
				const outcome = documentIndex.outcomeAt(rangeStartOffset + matchStart);
				const commandEvaluation = outcome?.kind === 'not-applicable'
					? this.evaluateInlineExpression(match[1], collectVariables(prefixText, this.settings), true)
					: null;

				replacement += range.text.slice(cursor, matchStart);
				if (outcome?.kind === 'success') {
					replacement += outcome.display;
					evaluatedAny = true;
				} else if (commandEvaluation) {
					replacement += commandEvaluation.text;
					evaluatedAny = true;
				} else {
					replacement += match[0];
					if (firstFailure === null) {
						firstFailure = outcome?.kind === 'error'
							? outcome.diagnostic.message
							: describeEvaluationFailure(match[1], this.settings);
					}
				}
				cursor = matchEnd;
			}
			replacement += range.text.slice(cursor);

			if (!evaluatedAny) {
				new Notice(firstFailure ?? 'No inline expression to evaluate on this line.');
				return;
			}

			editor.replaceRange(replacement, range.from, range.to);
			return;
		}

		const prefixText = fullDoc.slice(0, rangeStartOffset);
		const variables = collectVariables(prefixText, this.settings);
		const isExplicit = extractAssignmentName(prefixText) !== null;
		const trimmed = range.text.trim();
		const evaluation = this.evaluateInlineExpression(trimmed, variables, isExplicit);

		if (!evaluation) {
			new Notice(describeEvaluationFailure(trimmed, this.settings));
			return;
		}

		editor.replaceRange(evaluation.text, range.from, range.to);
	}

	private toggleActiveLivePreviewRendering() {
		const view = this.getActiveEditorView();
		if (!view) {
			new Notice('Open a Markdown editor to toggle rendered calculations.');
			return;
		}

		const enabled = this.isLivePreviewRenderingEnabled(view);
		view.dispatch({
			effects: setLivePreviewRenderingEffect.of(!enabled),
		});
		window.requestAnimationFrame(() => {
			view.dispatch({
				effects: refreshLivePreviewRenderingEffect.of(null),
			});
		});
	}

	private getActiveEditorView(): EditorView | null {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return null;
		}

		return (activeView.editor as EditorWithCodeMirror).cm ?? null;
	}

	refreshAllLivePreviews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) {
				return;
			}
			const editorView = (leaf.view.editor as EditorWithCodeMirror).cm;
			if (editorView) {
				editorView.dispatch({
					effects: refreshLivePreviewRenderingEffect.of(null),
				});
			}
		});
	}
}

function createLivePreviewRenderingField(plugin: ObsidianUnitsPlugin): StateField<LivePreviewRenderingState> {
	return StateField.define<LivePreviewRenderingState>({
		create: () => ({
			enabled: plugin.settings.renderInLivePreviewByDefault,
			generation: 0,
		}),
		update: (value, transaction) => {
			for (const effect of transaction.effects) {
				if (effect.is(setLivePreviewRenderingEffect)) {
					return {
						enabled: effect.value,
						generation: value.generation + 1,
					};
				}

				if (effect.is(refreshLivePreviewRenderingEffect)) {
					return {
						enabled: value.enabled,
						generation: value.generation + 1,
					};
				}
			}

			return value;
		},
	});
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

const CONVERSION_PATTERN = /^(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(.+?)(?:\s+of\s+(.+?))?\s*(?:->|\bto\b|\bas\b|\bin\b)\s*(.+)$/i;

export function parseConversion(text: string, settings: ObsidianUnitsSettings): Conversion | null {
	const cleaned = stripArithmeticEquals(stripExistingResult(stripInlineCodeMarkers(text.trim())));
	const match = cleaned.match(CONVERSION_PATTERN);
	if (!match) {
		return null;
	}

	const input = Number(match[1]);
	const source = findUnit(match[2]);
	const materialName = match[3];
	const target = findUnit(match[4]);

	if (!Number.isFinite(input) || !source || !target) {
		return null;
	}

	if (source.dimension === target.dimension) {
		return {
			input,
			source,
			target,
			output: convert(input, source, target),
		};
	}

	if (!isMassVolumePair(source.dimension, target.dimension) || !materialName) {
		return null;
	}

	const density = findDensity(materialName, settings);
	if (!density) {
		return null;
	}

	const output = convertWithDensity(input, source, target, density);
	if (!Number.isFinite(output)) {
		return null;
	}

	return { input, source, target, output };
}

export function diagnoseConversion(text: string, settings: ObsidianUnitsSettings): string | null {
	const cleaned = stripArithmeticEquals(stripExistingResult(stripInlineCodeMarkers(text.trim())));
	const match = cleaned.match(CONVERSION_PATTERN);
	if (!match) {
		return null;
	}

	const input = Number(match[1]);
	if (!Number.isFinite(input)) {
		return `"${match[1]}" is not a valid number.`;
	}

	const sourceRaw = match[2].trim();
	const materialRaw = match[3]?.trim();
	const targetRaw = match[4].trim();
	const source = findUnit(sourceRaw);
	const target = findUnit(targetRaw);

	if (!source && !target) {
		return `Unknown units: "${sourceRaw}" and "${targetRaw}".`;
	}
	if (!source) {
		return `Unknown unit: "${sourceRaw}".`;
	}
	if (!target) {
		return `Unknown unit: "${targetRaw}".`;
	}

	if (source.dimension === target.dimension) {
		return null;
	}

	if (isMassVolumePair(source.dimension, target.dimension)) {
		if (!materialRaw) {
			return `Cannot convert ${source.dimension} (${sourceRaw}) to ${target.dimension} (${targetRaw}) without a material. Try: ${source.dimension} (${sourceRaw}) of <material> to ${target.dimension} (${targetRaw}).`;
		}
		const density = findDensity(materialRaw, settings);
		if (!density) {
			return `Unknown material: "${materialRaw}". Add it in Settings → Obsidian Units → Material densities.`;
		}
		return null;
	}

	return `Cannot convert ${source.dimension} (${sourceRaw}) to ${target.dimension} (${targetRaw}); incompatible units.`;
}

function describeEvaluationFailure(expression: string | null, settings: ObsidianUnitsSettings): string {
	if (!expression) {
		return 'No inline expression to evaluate on this line.';
	}
	const diagnosis = diagnoseConversion(expression, settings);
	if (diagnosis) {
		return diagnosis;
	}
	return `Couldn't evaluate "${expression}".`;
}

function parseInlineConversion(text: string, settings: ObsidianUnitsSettings): InlineConversion | null {
	const { expression, mode } = parseInlineRenderMode(text);
	const conversion = parseConversion(expression, settings);

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

export function evaluateInlineExpressionFallback(text: string, settings: ObsidianUnitsSettings, variables: VariableMap = new Map(), isExplicit = false): InlineEvaluation | null {
	const inlineConversion = parseInlineConversion(text, settings);
	if (inlineConversion) {
		const renderedText = formatInlineConversion(inlineConversion, settings);
		return {
			text: renderedText,
			consumeTrailingS: renderedText.endsWith('s'),
		};
	}

	const numericLiteral = formatNumericLiteral(text, settings.precision);
	if (numericLiteral !== null) {
		return {
			text: numericLiteral,
			consumeTrailingS: false,
		};
	}

	const arithmeticExplicit = isExplicit || /^\s*=/.test(text);
	const arithmeticResult = parseArithmetic(text, variables, arithmeticExplicit);
	if (arithmeticResult === null) {
		return null;
	}

	return {
		text: formatNumber(arithmeticResult, settings.precision),
		consumeTrailingS: false,
	};
}

export function evaluateCompatibilityExpression(expression: string, values: Map<string, EvaluatedValue>, settings: ObsidianUnitsSettings) {
	const conversion = parseInlineConversion(expression, settings);
	if (conversion) {
		const display = formatInlineConversion(conversion, settings);
		return {
			kind: 'success' as const,
			value: { kind: 'quantity' as const, value: conversion.conversion.output, unit: conversion.conversion.target.canonical, dimension: conversion.conversion.target.dimension },
			display,
			consumeTrailingS: display.endsWith('s'),
		};
	}
	const numericDisplay = formatNumericLiteral(expression, settings.precision);
	if (numericDisplay !== null) {
		const numericValue = Number(stripArithmeticEquals(expression));
		return {
			kind: 'success' as const,
			value: { kind: 'number' as const, value: numericValue, decimalPlaces: decimalPlacesInLiteral(expression) },
			display: numericDisplay,
			consumeTrailingS: false,
		};
	}
	const message = diagnoseConversion(expression, settings);
	return message ? { kind: 'error' as const, code: 'conversion-error', message } : null;
}

function decimalPlacesInLiteral(expression: string): number {
	const match = stripArithmeticEquals(expression).match(/^[+-]?(?:\d+\.(\d*)|\.(\d+))(?:e[+-]?\d+)?$/i);
	return Math.min((match?.[1] ?? match?.[2] ?? '').length, 10);
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
		.replace(/\s*\/\s*/g, '/')
		.replace(/\s*\*\s*/g, '*');
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

function isMassVolumePair(a: string, b: string): boolean {
	return (a === 'mass' && b === 'volume') || (a === 'volume' && b === 'mass');
}

function normalizeMaterialName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findDensity(rawName: string, settings: ObsidianUnitsSettings): DensityEntry | null {
	const normalized = normalizeMaterialName(rawName);
	if (!normalized) {
		return null;
	}
	for (const entry of settings.densities) {
		if (normalizeMaterialName(entry.name) === normalized) {
			return entry;
		}
	}
	return null;
}

function densityToBase(density: DensityEntry): number {
	const slashIdx = density.unit.indexOf('/');
	if (slashIdx < 0) {
		return NaN;
	}
	const massUnit = findUnit(density.unit.slice(0, slashIdx));
	const volUnit = findUnit(density.unit.slice(slashIdx + 1));
	if (!massUnit || !volUnit) {
		return NaN;
	}
	if (massUnit.dimension !== 'mass' || volUnit.dimension !== 'volume') {
		return NaN;
	}
	if (massUnit.kind !== 'linear' || volUnit.kind !== 'linear') {
		return NaN;
	}
	return (density.value * massUnit.toBase) / volUnit.toBase;
}

function convertWithDensity(value: number, source: Unit, target: Unit, density: DensityEntry): number {
	if (source.kind !== 'linear' || target.kind !== 'linear') {
		return NaN;
	}
	const densityGramsPerLiter = densityToBase(density);
	if (!Number.isFinite(densityGramsPerLiter) || densityGramsPerLiter <= 0) {
		return NaN;
	}

	if (source.dimension === 'volume' && target.dimension === 'mass') {
		const volumeL = value * source.toBase;
		const massG = volumeL * densityGramsPerLiter;
		return massG / target.toBase;
	}
	if (source.dimension === 'mass' && target.dimension === 'volume') {
		const massG = value * source.toBase;
		const volumeL = massG / densityGramsPerLiter;
		return volumeL / target.toBase;
	}
	return NaN;
}

function formatConversion(conversion: Conversion, precision: number): string {
	return `${conversion.input} ${formatUnit(conversion.source, conversion.input)} = ${formatResult(conversion, precision)}`;
}

function formatInlineConversion(inlineConversion: InlineConversion, settings: ObsidianUnitsSettings): string {
	const { conversion, mode } = inlineConversion;

	switch (mode) {
		case 'value':
			return formatNumber(conversion.output, settings.precision);
		case 'unit':
			return pickUnitForm(conversion.target, conversion.output, settings);
		case 'result':
			return `${formatNumber(conversion.output, settings.precision)} ${pickUnitForm(conversion.target, conversion.output, settings)}`;
	}
}

function formatResult(conversion: Conversion, precision: number): string {
	return `${formatNumber(conversion.output, precision)} ${formatUnit(conversion.target, conversion.output)}`;
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

function formatUnitAbbr(unit: Unit): string {
	const display = UNIT_DISPLAYS[unit.canonical.toLowerCase()];
	return display ? display.abbr : unit.canonical;
}

const ABBR_PREFERRED = new Set([
	'mph', 'psi', 'btu',
	'kb', 'mb', 'gb', 'tb', 'pb', 'eb',
	'kib', 'mib', 'gib', 'tib', 'pib', 'eib',
]);

function resolveUnitDisplayForm(canonical: string, settings: ObsidianUnitsSettings): UnitDisplayForm {
	const override = settings.unitDisplayOverrides[canonical];
	if (override) {
		return override;
	}
	const lower = canonical.toLowerCase();
	if (/[\/^*]/.test(canonical) || ABBR_PREFERRED.has(lower)) {
		return 'abbr';
	}
	return 'name';
}

function pickUnitForm(unit: Unit, value: number, settings: ObsidianUnitsSettings): string {
	return resolveUnitDisplayForm(unit.canonical, settings) === 'abbr'
		? formatUnitAbbr(unit)
		: formatUnitName(unit, value);
}

function formatNumber(value: number, precision: number, minimumDecimalPlaces = 0): string {
	if (Object.is(value, -0)) {
		value = 0;
	}

	const formatted = value.toFixed(precision);
	let compact = formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
	const minimum = Math.min(Math.max(0, minimumDecimalPlaces), precision);
	if (minimum === 0) return compact;
	const point = compact.indexOf('.');
	if (point < 0) return `${compact}.${'0'.repeat(minimum)}`;
	const present = compact.length - point - 1;
	if (present < minimum) compact += '0'.repeat(minimum - present);
	return compact;
}

function formatNumericLiteral(text: string, precision: number): string | null {
	const expression = stripArithmeticEquals(stripInlineCodeMarkers(text.trim()));
	const match = expression.match(/^([+-]?(?:\d+(?:\.(\d*))?|\.(\d+))(?:e[+-]?\d+)?)$/i);
	if (!match) {
		return null;
	}

	const value = Number(match[1]);
	if (!Number.isFinite(value)) {
		return null;
	}

	const decimalPart = match[2] ?? match[3];
	if (decimalPart === undefined) {
		return formatNumber(value, precision);
	}

	const decimalPlaces = Math.min(decimalPart.length, precision);
	return value.toFixed(decimalPlaces);
}

function parseArithmetic(text: string, variables: VariableMap, isExplicit: boolean): number | null {
	if (!isExplicit) {
		return null;
	}
	const expression = resolveVariablesInExpression(stripArithmeticEquals(stripInlineCodeMarkers(text.trim())), variables);
	if (!looksLikeArithmetic(expression)) {
		return null;
	}

	const parser = new ArithmeticParser(expression);
	const value = parser.parse();
	return value !== null && Number.isFinite(value) ? value : null;
}

function stripArithmeticEquals(text: string): string {
	return text.replace(/^\s*=\s*/, '').replace(/\s*=\s*$/, '').trim();
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
		resolved = resolved.replace(regex, (_match, prefix) => `${prefix}(${formatNumberForExpression(value)})`);
	}

	return resolved;
}

function formatNumberForExpression(value: number): string {
	if (Object.is(value, -0)) {
		return '0';
	}

	const formatted = value.toFixed(12);
	return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ArithmeticParser {
	private index = 0;

	constructor(private readonly input: string) { }

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
			const livePreviewChanged = update.startState.field(editorLivePreviewField, false) !== update.state.field(editorLivePreviewField, false);
			if (update.docChanged || update.viewportChanged || update.selectionSet || livePreviewChanged || plugin.livePreviewRenderingChanged(update)) {
				this.decorations = buildInlineCodeDecorations(update.view, plugin);
			}
		}
	}, {
		decorations: (viewPlugin) => viewPlugin.decorations,
	});
}

function collectVariables(text: string, settings: ObsidianUnitsSettings): VariableMap {
	const variables: VariableMap = new Map();
	const inlineCodePattern = /`([^`\n]+)`/g;

	for (const line of text.split('\n')) {
		let match: RegExpExecArray | null;
		while ((match = inlineCodePattern.exec(line)) !== null) {
			const content = match[1].trimStart();
			if (!content.startsWith(settings.expressionMarker)) continue;
			const variableName = extractAssignmentName(line.slice(0, match.index));
			if (!variableName) {
				continue;
			}

			const expression = content.slice(settings.expressionMarker.length).trim();
			const inlineEvaluation = evaluateInlineExpressionFallback(expression, settings, variables, true);
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
	const match = prefix.match(/(?:^|\n)\s*(?:[-*]\s*)?(.+?)\s*=\s*$/);
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
	if (!view.state.field(editorLivePreviewField, false) || !plugin.isLivePreviewRenderingEnabled(view)) {
		return Decoration.none;
	}

	const decorations: Range<Decoration>[] = [];
	const generation = plugin.livePreviewRenderingGeneration(view);
	const selectionRanges = view.state.selection.ranges;
	const evaluationIndex = plugin.evaluateDocument(view.state.doc.toString());

	for (const range of view.visibleRanges) {
		const startLine = view.state.doc.lineAt(range.from);
		const endLine = view.state.doc.lineAt(range.to);

		for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber++) {
			const line = view.state.doc.line(lineNumber);
			const inlineCodePattern = /`([^`\n]+)`/g;
			let match: RegExpExecArray | null;

			while ((match = inlineCodePattern.exec(line.text)) !== null) {
				const from = line.from + match.index;
				const outcome = evaluationIndex.outcomeAt(from);

				const localTo = match.index + match[0].length;
				const baseFrom = from;
				const basePos = line.from + localTo;

				if (selectionRanges.some((s) => s.from <= basePos && s.to >= baseFrom)) {
					continue;
				}

				if (outcome?.kind === 'success') {
					const shouldConsumeTrailingS = outcome.consumeTrailingS === true && line.text.charAt(localTo) === 's';
					const pos = basePos + (shouldConsumeTrailingS ? 1 : 0);

					if (selectionRanges.some((s) => s.from <= pos && s.to >= baseFrom)) {
						continue;
					}

					decorations.push(Decoration.replace({
						widget: new ObsidianUnitsResultWidget(outcome.display, generation),
					}).range(baseFrom, pos));
					continue;
				}

				if (outcome?.kind === 'error') {
					decorations.push(Decoration.replace({
						widget: new ObsidianUnitsErrorWidget(outcome.diagnostic.message, generation),
					}).range(baseFrom, basePos));
				}
			}
		}
	}

	return Decoration.set(decorations, true);
}

async function renderInlineCodeConversions(element: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: ObsidianUnitsPlugin) {
	const codeElements = Array.from(element.querySelectorAll('code'))
		.filter((codeElement) => !codeElement.closest('pre'));
	const sectionInfo = ctx.getSectionInfo(element);
	const sourceText = await getSourceText(ctx, plugin);
	const sectionStartOffset = sourceText && sectionInfo
		? getLineStartOffset(sourceText, sectionInfo.lineStart)
		: null;
	const sectionEndOffset = sourceText && sectionInfo
		? getLineStartOffset(sourceText, sectionInfo.lineEnd + 1)
		: null;
	const evaluationIndex = sourceText ? plugin.evaluateDocument(sourceText) : null;
	const sectionEntries = evaluationIndex && sectionStartOffset !== null && sectionEndOffset !== null
		? evaluationIndex.entries().filter(({ source }) => source.from >= sectionStartOffset && source.from < sectionEndOffset)
		: [];
	let entryCursor = 0;

	for (const codeElement of codeElements) {
		const codeText = codeElement.textContent ?? '';
		const entryIndex = sectionEntries.findIndex((entry, index) => index >= entryCursor && entry.source.content === codeText);
		if (entryIndex < 0) continue;
		entryCursor = entryIndex + 1;
		const outcome = sectionEntries[entryIndex].outcome;
		if (!outcome || outcome.kind === 'not-applicable') {
			continue;
		}
		if (outcome.kind === 'error') {
			codeElement.replaceWith(createResultSpan(outcome.diagnostic.message, 'obsidian-units-error'));
			continue;
		}

		if (outcome.consumeTrailingS) {
			consumeNextTextPrefix(codeElement, 's');
		}

		const result = createResultSpan(outcome.display, 'obsidian-units-result');
		codeElement.replaceWith(result);
	}
}

async function getSourceText(ctx: MarkdownPostProcessorContext, plugin: ObsidianUnitsPlugin): Promise<string | null> {
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!(file instanceof TFile)) {
		return null;
	}

	try {
		return await plugin.app.vault.cachedRead(file);
	} catch {
		return null;
	}
}

function getLineStartOffset(text: string, lineNumber: number): number {
	let offset = 0;

	for (let line = 0; line < lineNumber; line++) {
		const nextLine = text.indexOf('\n', offset);
		if (nextLine === -1) {
			return text.length;
		}

		offset = nextLine + 1;
	}

	return offset;
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

export function isValidExpressionMarker(marker: string): boolean {
	return marker.length > 0 && marker.length <= 16 && !/[\s`]/u.test(marker);
}

export interface MarkerUpdatePlan {
	text: string;
	changed: number;
	ambiguous: number;
}

export function planMarkerUpdate(source: string, from: string, to: string, settings: ObsidianUnitsSettings): MarkerUpdatePlan {
	if (!isValidExpressionMarker(from) || !isValidExpressionMarker(to) || from === to) {
		return { text: source, changed: 0, ambiguous: 0 };
	}
	let changed = 0;
	let ambiguous = 0;
	const text = source.replace(/`([^`\n]+)`/g, (whole, content: string, offset: number) => {
		const leadingWhitespace = content.slice(0, content.length - content.trimStart().length);
		const trimmed = content.trimStart();
		if (!trimmed.startsWith(from)) return whole;
		const expression = trimmed.slice(from.length).trim();
		const declaration = extractAssignmentName(source.slice(0, offset)) !== null;
		const aggregate = parseAggregate(expression).kind === 'success';
		const conversion = parseConversion(expression, settings) !== null;
		if (!declaration && !aggregate && !conversion) {
			ambiguous++;
			return whole;
		}
		changed++;
		return `\`${leadingWhitespace}${to}${trimmed.slice(from.length)}\``;
	});
	return { text, changed, ambiguous };
}

class MarkerUpdateConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly from: string,
		private readonly to: string,
		private readonly update: MarkerUpdatePlan,
		private readonly applyUpdate: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.createEl('h3', { text: 'Update Units markers?' });
		this.contentEl.createEl('p', {
			text: `${this.update.changed} recognized Units expression(s) will change from “${this.from}” to “${this.to}”. ${this.update.ambiguous} ambiguous span(s) will remain unchanged.`,
		});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => button.setButtonText('Update markers').setCta().onClick(() => {
				this.applyUpdate();
				this.close();
			}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class ObsidianUnitsResultWidget extends WidgetType {
	constructor(private readonly text: string, private readonly generation: number) {
		super();
	}

	toDOM(): HTMLElement {
		return createResultSpan(this.text, 'obsidian-units-result cm-obsidian-units-result');
	}

	eq(other: ObsidianUnitsResultWidget): boolean {
		return other.text === this.text && other.generation === this.generation;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

class ObsidianUnitsErrorWidget extends WidgetType {
	constructor(private readonly text: string, private readonly generation: number) {
		super();
	}

	toDOM(): HTMLElement {
		return createResultSpan(this.text, 'obsidian-units-error cm-obsidian-units-result');
	}

	eq(other: ObsidianUnitsErrorWidget): boolean {
		return other.text === this.text && other.generation === this.generation;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

function createResultSpan(text: string, className: string): HTMLSpanElement {
	const span = document.createElement('span');
	span.className = className;
	span.textContent = text;
	span.contentEditable = 'false';
	return span;
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
			.setDesc('Number of decimal places shown in rendered results.')
			.addSlider((slider) => slider
				.setLimits(0, 10, 1)
				.setValue(this.plugin.settings.precision)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.precision = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Expression marker')
			.setDesc('The exact marker that identifies Units expressions. Changing it disables the previous marker until the file is updated with the command palette.')
			.addText((text) => {
				text.setValue(this.plugin.settings.expressionMarker);
				text.inputEl.addEventListener('blur', async () => {
					const marker = text.getValue();
					if (!isValidExpressionMarker(marker)) {
						new Notice('The Units marker must be 1–16 characters and cannot contain whitespace or backticks.');
						text.setValue(this.plugin.settings.expressionMarker);
						return;
					}
					if (marker === this.plugin.settings.expressionMarker) return;
					this.plugin.settings.previousExpressionMarker = this.plugin.settings.expressionMarker;
					this.plugin.settings.expressionMarker = marker;
					await this.plugin.saveSettings();
					this.plugin.refreshAllLivePreviews();
				});
			});

		new Setting(containerEl)
			.setName('Render in Live Preview by default')
			.setDesc('New editor panes start with rendered inline results enabled. Use the toggle command to change only the active editor.')
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.renderInLivePreviewByDefault)
				.onChange(async (value) => {
					this.plugin.settings.renderInLivePreviewByDefault = value;
					await this.plugin.saveSettings();
				}));

		this.renderUnitDisplayOverrideSection(containerEl);
		this.renderDensitiesSection(containerEl);
	}

	private renderUnitDisplayOverrideSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Unit display overrides')
			.setDesc('Search for a unit and pick whether to render its abbreviation (cm) or full name (centimeters). Defaults work for most cases — compound units stay short, simple units expand.')
			.setHeading();

		const searchEl = containerEl.createEl('input', {
			type: 'search',
			cls: 'obsidian-units-override-search',
			attr: { placeholder: 'Search units (e.g. meter, cm, mph)…' },
		});
		const resultsEl = containerEl.createDiv({ cls: 'obsidian-units-override-results' });
		containerEl.createEl('h4', { text: 'Your overrides' });
		const overridesEl = containerEl.createDiv({ cls: 'obsidian-units-override-list' });

		const renderResults = () => {
			resultsEl.empty();
			const matches = searchUnits(searchEl.value, 10);
			if (matches.length === 0) {
				return;
			}
			for (const entry of matches) {
				this.renderOverrideRow(resultsEl, entry, renderOverrides);
			}
		};

		const renderOverrides = () => {
			overridesEl.empty();
			const entries = Object.entries(this.plugin.settings.unitDisplayOverrides);
			if (entries.length === 0) {
				overridesEl.createDiv({ text: 'No overrides yet.', cls: 'obsidian-units-override-empty' });
				return;
			}
			for (const [canonical, form] of entries) {
				this.renderOverrideListItem(overridesEl, canonical, form, () => {
					renderOverrides();
					renderResults();
				});
			}
		};

		searchEl.addEventListener('input', renderResults);
		renderOverrides();
	}

	private renderOverrideRow(parent: HTMLElement, entry: UnitSearchEntry, onChange: () => void): void {
		const row = parent.createDiv({ cls: 'obsidian-units-override-row' });
		row.createSpan({ text: entry.label, cls: 'obsidian-units-override-label' });

		const select = row.createEl('select', { cls: 'obsidian-units-override-select' });
		select.createEl('option', { text: 'Default', value: '' });
		select.createEl('option', { text: 'Abbreviation', value: 'abbr' });
		select.createEl('option', { text: 'Full name', value: 'name' });
		select.value = this.plugin.settings.unitDisplayOverrides[entry.canonical] ?? '';

		select.addEventListener('change', async () => {
			if (select.value === '') {
				delete this.plugin.settings.unitDisplayOverrides[entry.canonical];
			} else {
				this.plugin.settings.unitDisplayOverrides[entry.canonical] = select.value as UnitDisplayForm;
			}
			await this.plugin.saveSettings();
			this.plugin.refreshAllLivePreviews();
			onChange();
		});
	}

	private renderOverrideListItem(parent: HTMLElement, canonical: string, form: UnitDisplayForm, onChange: () => void): void {
		const display = UNIT_DISPLAYS[canonical.toLowerCase()];
		const name = display ? display.plural : canonical;
		const formLabel = form === 'abbr' ? 'abbreviation' : 'full name';

		const row = parent.createDiv({ cls: 'obsidian-units-override-row' });
		row.createSpan({ text: `${name} → ${formLabel}`, cls: 'obsidian-units-override-label' });
		const revertBtn = row.createEl('button', { text: 'Revert', cls: 'obsidian-units-override-revert' });
		revertBtn.addEventListener('click', async () => {
			delete this.plugin.settings.unitDisplayOverrides[canonical];
			await this.plugin.saveSettings();
			this.plugin.refreshAllLivePreviews();
			onChange();
		});
	}

	private renderDensitiesSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Material densities')
			.setDesc('Densities let the plugin convert between mass and volume for specific materials (e.g. `1 tsp of maple syrup to g`). Densities are user-defined — see the README for the data format.')
			.setHeading();

		const listEl = containerEl.createDiv({ cls: 'obsidian-units-density-list' });

		const renderList = () => {
			listEl.empty();
			if (this.plugin.settings.densities.length === 0) {
				listEl.createDiv({ text: 'No densities yet.', cls: 'obsidian-units-override-empty' });
				return;
			}
			this.plugin.settings.densities.forEach((entry, index) => {
				const row = listEl.createDiv({ cls: 'obsidian-units-override-row' });
				row.createSpan({
					text: `${entry.name} — ${entry.value} ${entry.unit}`,
					cls: 'obsidian-units-override-label',
				});
				const editBtn = row.createEl('button', { text: 'Edit' });
				editBtn.addEventListener('click', () => {
					new DensityModal(this.app, entry, async (updated) => {
						this.plugin.settings.densities[index] = updated;
						await this.plugin.saveSettings();
						this.plugin.refreshAllLivePreviews();
						renderList();
					}).open();
				});
				const deleteBtn = row.createEl('button', { text: 'Delete' });
				deleteBtn.addEventListener('click', async () => {
					this.plugin.settings.densities.splice(index, 1);
					await this.plugin.saveSettings();
					this.plugin.refreshAllLivePreviews();
					renderList();
				});
			});
		};

		const addBtn = containerEl.createEl('button', {
			text: 'Add density',
			cls: 'obsidian-units-density-add',
		});
		addBtn.addEventListener('click', () => {
			new DensityModal(this.app, null, async (entry) => {
				this.plugin.settings.densities.push(entry);
				await this.plugin.saveSettings();
				this.plugin.refreshAllLivePreviews();
				renderList();
			}).open();
		});

		renderList();
	}
}

class DensityModal extends Modal {
	private name: string;
	private value: number;
	private unit: string;

	constructor(
		app: App,
		existing: DensityEntry | null,
		private readonly onSubmit: (entry: DensityEntry) => void | Promise<void>,
	) {
		super(app);
		this.name = existing?.name ?? '';
		this.value = existing?.value ?? 1;
		this.unit = existing?.unit ?? DENSITY_UNIT_OPTIONS[0];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: this.name ? 'Edit density' : 'Add density' });

		new Setting(contentEl)
			.setName('Material name')
			.setDesc('How you will refer to this material in expressions, e.g. "maple syrup".')
			.addText((text) => text
				.setPlaceholder('maple syrup')
				.setValue(this.name)
				.onChange((value) => { this.name = value; }));

		new Setting(contentEl)
			.setName('Density value')
			.addText((text) => text
				.setValue(String(this.value))
				.onChange((value) => {
					const parsed = Number(value);
					if (Number.isFinite(parsed)) {
						this.value = parsed;
					}
				}));

		new Setting(contentEl)
			.setName('Density unit')
			.addDropdown((dropdown) => {
				for (const option of DENSITY_UNIT_OPTIONS) {
					dropdown.addOption(option, option);
				}
				dropdown.setValue(this.unit);
				dropdown.onChange((value) => { this.unit = value; });
			});

		new Setting(contentEl)
			.addButton((btn) => btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					const name = this.name.trim();
					if (!name) {
						new Notice('Material name is required.');
						return;
					}
					if (!Number.isFinite(this.value) || this.value <= 0) {
						new Notice('Density value must be a positive number.');
						return;
					}
					await this.onSubmit({ name, value: this.value, unit: this.unit });
					this.close();
				}))
			.addButton((btn) => btn
				.setButtonText('Cancel')
				.onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
