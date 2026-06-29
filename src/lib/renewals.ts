import type { BillingCycle } from './types';

/**
 * Renewal-date math. All functions are pure and operate on `YYYY-MM-DD` strings
 * interpreted at UTC midnight, so results are timezone-stable and easy to test.
 */

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function toUTCDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** Add whole months, clamping the day to the last valid day of the target month. */
function addMonths(date: Date, months: number): void {
	const day = date.getUTCDate();
	date.setUTCDate(1);
	date.setUTCMonth(date.getUTCMonth() + months);
	const lastDay = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
	).getUTCDate();
	date.setUTCDate(Math.min(day, lastDay));
}

/** Advance an ISO date by one billing period (cycle x cycleCount). */
export function addCycle(iso: string, cycle: BillingCycle, cycleCount: number): string {
	const date = toUTCDate(iso);
	const n = Math.max(1, cycleCount);
	switch (cycle) {
		case 'daily':
			date.setUTCDate(date.getUTCDate() + n);
			break;
		case 'weekly':
			date.setUTCDate(date.getUTCDate() + 7 * n);
			break;
		case 'monthly':
			addMonths(date, n);
			break;
		case 'quarterly':
			addMonths(date, 3 * n);
			break;
		case 'yearly':
			addMonths(date, 12 * n);
			break;
	}
	return format(date);
}

/**
 * Roll a renewal date forward by whole cycles until it is on or after `from`
 * (defaults to today). Returns the original date if it is already in the future.
 */
export function rollForward(
	iso: string,
	cycle: BillingCycle,
	cycleCount: number,
	from: string = today()
): string {
	let current = iso;
	// Guard against pathological inputs; 1000 cycles covers any realistic gap.
	for (let i = 0; i < 1000 && current < from; i++) {
		current = addCycle(current, cycle, cycleCount);
	}
	return current;
}

/** Whole days from `from` (today) until the given ISO date. Negative if past. */
export function daysUntil(iso: string, from: string = today()): number {
	const ms = toUTCDate(iso).getTime() - toUTCDate(from).getTime();
	return Math.round(ms / 86_400_000);
}

export type RenewalTone = 'overdue' | 'due' | 'soon' | 'later';

export interface RenewalStatus {
	days: number;
	label: string;
	tone: RenewalTone;
}

/** Human-friendly urgency for a renewal date. */
export function renewalStatus(iso: string, from: string = today()): RenewalStatus {
	const days = daysUntil(iso, from);
	if (days < 0) return { days, label: `${Math.abs(days)}d overdue`, tone: 'overdue' };
	if (days === 0) return { days, label: 'due today', tone: 'due' };
	if (days === 1) return { days, label: 'tomorrow', tone: 'soon' };
	if (days <= 7) return { days, label: `in ${days} days`, tone: 'soon' };
	if (days <= 30) return { days, label: `in ${days} days`, tone: 'later' };
	return { days, label: `in ${Math.round(days / 30.44)} months`, tone: 'later' };
}
