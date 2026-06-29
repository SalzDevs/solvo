import type { BillingCycle, Currency, Subscription } from './types';

/**
 * Average number of days in one unit of each billing cycle. Using average
 * lengths (rather than 30/365) keeps per-day/month/year figures honest across
 * months of different lengths and leap years.
 */
const DAYS_PER_CYCLE: Record<BillingCycle, number> = {
	daily: 1,
	weekly: 7,
	monthly: 30.436875,
	quarterly: 91.310625,
	yearly: 365.2425
};

/** Total days covered by one billing of a subscription. */
export function cycleDays(cycle: BillingCycle, cycleCount: number): number {
	return DAYS_PER_CYCLE[cycle] * Math.max(1, cycleCount);
}

/** Convert a minor-unit amount between EUR and USD given the EUR->USD rate. */
export function convert(
	amountMinor: number,
	from: Currency,
	to: Currency,
	fxEurToUsd: number
): number {
	if (from === to) return amountMinor;
	if (from === 'EUR' && to === 'USD') return amountMinor * fxEurToUsd;
	// USD -> EUR
	return amountMinor / fxEurToUsd;
}

export interface NormalizedCost {
	/** All values are in minor units of the display currency. */
	perDay: number;
	perMonth: number;
	perYear: number;
}

/**
 * Normalize a single subscription's price to per-day/month/year amounts in the
 * chosen display currency. Returns minor units (cents), unrounded so totals can
 * be summed without compounding rounding error.
 */
export function normalize(
	sub: Pick<Subscription, 'amount' | 'currency' | 'cycle' | 'cycleCount'>,
	displayCurrency: Currency,
	fxEurToUsd: number
): NormalizedCost {
	const converted = convert(sub.amount, sub.currency, displayCurrency, fxEurToUsd);
	const perDay = converted / cycleDays(sub.cycle, sub.cycleCount);
	return {
		perDay,
		perMonth: perDay * DAYS_PER_CYCLE.monthly,
		perYear: perDay * DAYS_PER_CYCLE.yearly
	};
}

/** Sum normalized costs of many subscriptions (only `active` ones count). */
export function totals(
	subs: Subscription[],
	displayCurrency: Currency,
	fxEurToUsd: number
): NormalizedCost {
	return subs
		.filter((s) => s.status === 'active')
		.reduce<NormalizedCost>(
			(acc, s) => {
				const n = normalize(s, displayCurrency, fxEurToUsd);
				acc.perDay += n.perDay;
				acc.perMonth += n.perMonth;
				acc.perYear += n.perYear;
				return acc;
			},
			{ perDay: 0, perMonth: 0, perYear: 0 }
		);
}

export interface CategoryTotal {
	category: string;
	perMonth: number;
	count: number;
}

/** Per-category monthly spend, sorted descending. Active subscriptions only. */
export function byCategory(
	subs: Subscription[],
	displayCurrency: Currency,
	fxEurToUsd: number
): CategoryTotal[] {
	const map = new Map<string, CategoryTotal>();
	for (const s of subs) {
		if (s.status !== 'active') continue;
		const category = s.category?.trim() || 'Uncategorized';
		const n = normalize(s, displayCurrency, fxEurToUsd);
		const entry = map.get(category) ?? { category, perMonth: 0, count: 0 };
		entry.perMonth += n.perMonth;
		entry.count += 1;
		map.set(category, entry);
	}
	return [...map.values()].sort((a, b) => b.perMonth - a.perMonth);
}

const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: '€', USD: '$' };

/** Format minor units as a currency string, e.g. 1299 -> "€12.99". */
export function formatMoney(amountMinor: number, currency: Currency): string {
	const value = amountMinor / 100;
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency
	}).format(value);
}

export function currencySymbol(currency: Currency): string {
	return CURRENCY_SYMBOL[currency];
}
