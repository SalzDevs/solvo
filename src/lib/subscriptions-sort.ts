import { normalize } from './cost';
import type { Currency, Subscription } from './types';

export type SortKey = 'name' | 'monthly' | 'nextRenewal';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
	key: SortKey;
	direction: SortDirection;
}

/** Monthly cost used for sorting; non-active subscriptions sort as 0 so they
 *  naturally cluster together regardless of direction. */
function monthlyValue(sub: Subscription, displayCurrency: Currency, fxEurToUsd: number): number {
	if (sub.status !== 'active') return 0;
	return normalize(sub, displayCurrency, fxEurToUsd).perMonth;
}

/** Renewal dates sort with missing values last regardless of direction —
 *  "no renewal set" is never more or less urgent, it's just unknown. */
function renewalValue(sub: Subscription, direction: SortDirection): string {
	if (sub.nextRenewal) return sub.nextRenewal;
	return direction === 'asc' ? '\uffff' : '';
}

/**
 * Sort subscriptions by the given key/direction. Stable (ties keep their
 * original relative order) so repeated clicks don't visually shuffle rows
 * that are already equal. Pure — caller decides what "no sort" means.
 */
export function sortSubscriptions(
	subs: Subscription[],
	sort: SortState,
	displayCurrency: Currency,
	fxEurToUsd: number
): Subscription[] {
	const dir = sort.direction === 'asc' ? 1 : -1;
	return subs
		.map((s, index) => ({ s, index }))
		.sort((a, b) => {
			let cmp = 0;
			if (sort.key === 'name') {
				cmp = a.s.name.localeCompare(b.s.name, undefined, { sensitivity: 'base' });
			} else if (sort.key === 'monthly') {
				cmp =
					monthlyValue(a.s, displayCurrency, fxEurToUsd) -
					monthlyValue(b.s, displayCurrency, fxEurToUsd);
			} else if (sort.key === 'nextRenewal') {
				const av = renewalValue(a.s, sort.direction);
				const bv = renewalValue(b.s, sort.direction);
				cmp = av < bv ? -1 : av > bv ? 1 : 0;
			}
			if (cmp === 0) return a.index - b.index;
			return cmp * dir;
		})
		.map((x) => x.s);
}

/** Default direction the first click on a column applies. Name and renewal
 *  date read naturally A-Z / soonest-first; monthly cost reads naturally
 *  most-expensive-first, matching the dashboard's "Most expensive" framing. */
const DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
	name: 'asc',
	monthly: 'desc',
	nextRenewal: 'asc'
};

/** Click handler logic: same key toggles direction, a new key starts at its
 *  column-specific default direction. */
export function nextSortState(current: SortState | null, key: SortKey): SortState {
	if (current && current.key === key) {
		return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
	}
	return { key, direction: DEFAULT_DIRECTION[key] };
}
