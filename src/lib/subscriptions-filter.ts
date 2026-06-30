import type { Subscription } from './types';

/**
 * Status filter buckets. `active` excludes trials (trials have a future
 * charge but the user hasn't committed to it yet), `trial` shows only
 * active subscriptions whose `isTrial` is set, `cancelled` shows only
 * cancelled ones, `all` shows everything.
 */
export type FilterStatus = 'all' | 'active' | 'trial' | 'cancelled';

export const FILTER_STATUSES: readonly FilterStatus[] = [
	'all',
	'active',
	'trial',
	'cancelled'
] as const;

export interface FilterOptions {
	query: string;
	status: FilterStatus;
	categories: string[];
}

export const DEFAULT_FILTERS: FilterOptions = {
	query: '',
	status: 'all',
	categories: []
};

export function isFilterStatus(value: string | null | undefined): value is FilterStatus {
	return FILTER_STATUSES.includes(value as FilterStatus);
}

export function parseFilterStatus(value: string | null | undefined): FilterStatus {
	return isFilterStatus(value) ? value : 'all';
}

/** Parse the comma-separated `cat` URL param into a deduped, trimmed list. */
export function parseCategories(value: string | null | undefined): string[] {
	if (!value) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of value.split(',')) {
		const trimmed = raw.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
	}
	return out;
}

export function hasActiveFilters(filters: FilterOptions): boolean {
	return (
		filters.query.trim().length > 0 ||
		filters.status !== 'all' ||
		filters.categories.length > 0
	);
}

/**
 * Filter a list of subscriptions by query, status, and category.
 *
 * Query: case-insensitive substring match against name, notes, and category.
 * Status: see `FilterStatus` doc. Categories: multi-select OR (matches any).
 * Pure: no mutation, no side effects, no clock.
 */
export function filterSubscriptions(
	subs: Subscription[],
	{ query, status, categories }: FilterOptions
): Subscription[] {
	const q = query.trim().toLowerCase();
	const categorySet = categories.length > 0 ? new Set(categories) : null;

	return subs.filter((sub) => {
		// Status: each branch is a precise allow-list so trials don't bleed
		// into "active" and paused subs don't bleed into "active" either.
		if (status === 'active') {
			if (sub.status !== 'active' || sub.isTrial) return false;
		} else if (status === 'trial') {
			if (sub.status !== 'active' || !sub.isTrial) return false;
		} else if (status === 'cancelled') {
			if (sub.status !== 'cancelled') return false;
		}
		// 'all' passes everything (including paused).

		if (categorySet) {
			if (!sub.category || !categorySet.has(sub.category)) return false;
		}

		if (q) {
			const haystack =
				`${sub.name} ${sub.category ?? ''} ${sub.notes ?? ''}`.toLowerCase();
			if (!haystack.includes(q)) return false;
		}

		return true;
	});
}

/** Sorted, unique, non-empty categories present in the given list. */
export function uniqueCategories(subs: Subscription[]): string[] {
	const set = new Set<string>();
	for (const sub of subs) {
		if (sub.category) set.add(sub.category);
	}
	return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Count of subscriptions per category, for the filter chip badges. */
export function categoryCounts(subs: Subscription[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const sub of subs) {
		if (!sub.category) continue;
		counts.set(sub.category, (counts.get(sub.category) ?? 0) + 1);
	}
	return counts;
}
