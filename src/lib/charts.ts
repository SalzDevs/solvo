import { convert } from './cost';
import { addCycle, today } from './renewals';
import type { Currency, Subscription } from './types';

export interface MonthBucket {
	/** `YYYY-MM` */
	key: string;
	/** Short month name, e.g. "Jul". */
	label: string;
	year: number;
	/** Projected spend in minor units of the display currency. */
	total: number;
}

function monthKey(iso: string): string {
	return iso.slice(0, 7);
}

/**
 * Project spending across the next `months` months by walking each active
 * subscription's real charge dates (renewal date stepped by its billing cycle)
 * and bucketing the converted amount into the month it lands in. Annual charges
 * therefore show up as a spike on the single month they occur.
 */
export function monthlyProjection(
	subs: Subscription[],
	displayCurrency: Currency,
	fxEurToUsd: number,
	months = 12,
	from: string = today()
): MonthBucket[] {
	const [fromYear, fromMonth] = from.split('-').map(Number);

	const buckets: MonthBucket[] = [];
	const indexByKey = new Map<string, number>();
	for (let i = 0; i < months; i++) {
		const monthsFromStart = fromMonth - 1 + i;
		const year = fromYear + Math.floor(monthsFromStart / 12);
		const monthIndex = ((monthsFromStart % 12) + 12) % 12;
		const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
		const label = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-US', {
			month: 'short'
		});
		indexByKey.set(key, buckets.length);
		buckets.push({ key, label, year, total: 0 });
	}

	const lastKey = buckets[buckets.length - 1].key;

	for (const sub of subs) {
		if (sub.status !== 'active') continue;
		const amount = convert(sub.amount, sub.currency, displayCurrency, fxEurToUsd);
		let date = sub.nextRenewal ?? from;

		let guard = 0;
		while (monthKey(date) <= lastKey && guard < 2000) {
			const idx = indexByKey.get(monthKey(date));
			if (idx !== undefined) buckets[idx].total += amount;
			date = addCycle(date, sub.cycle, sub.cycleCount);
			guard++;
		}
	}

	return buckets;
}

/** Sum of all projected buckets (minor units of display currency). */
export function projectionTotal(buckets: MonthBucket[]): number {
	return buckets.reduce((sum, b) => sum + b.total, 0);
}
