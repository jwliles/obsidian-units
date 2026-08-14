import Decimal from 'decimal.js';

// Keep evaluation out of binary floating point and make every operation use a
// documented, deterministic precision and rounding policy.
export const ExactDecimal = Decimal.clone({
	precision: 40,
	rounding: Decimal.ROUND_HALF_EVEN,
});

export type DecimalValue = InstanceType<typeof ExactDecimal>;

export function decimalFrom(value: string | number | DecimalValue): DecimalValue {
	return value instanceof ExactDecimal ? value : new ExactDecimal(value);
}
