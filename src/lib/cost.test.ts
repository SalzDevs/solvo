import { describe, expect, it } from 'bun:test';
import {
	byCategory,
	bySubscription,
	convert,
	cycleDays,
	formatMoney,
	normalize,
	topSpenders,
	totals
} from './cost';
import type { Subscription } from './types';

function sub(overrides: Partial<Subscription> = {}): Subscription {
	return {
		id: 1,
		name: 'Test',
		category: 'Misc',
		amount: 1000,
		currency: 'EUR',
		cycle: 'monthly',
		cycleCount: 1,
		startDate: null,
		nextRenewal: null,
		status: 'active',
		cancelUrl: null,
		cancelNotes: null,
		cancelledAt: null,
		notes: null,
		isTrial: false,
		trialEndsOn: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

describe('cycleDays', () => {
	it('uses average period lengths', () => {
		expect(cycleDays('daily', 1)).toBe(1);
		expect(cycleDays('weekly', 1)).toBe(7);
		expect(cycleDays('monthly', 1)).toBeCloseTo(30.436875, 5);
		expect(cycleDays('yearly', 1)).toBeCloseTo(365.2425, 4);
	});

	it('multiplies by cycle count', () => {
		expect(cycleDays('monthly', 3)).toBeCloseTo(91.310625, 5);
	});

	it('treats counts below 1 as 1', () => {
		expect(cycleDays('weekly', 0)).toBe(7);
	});
});

describe('convert', () => {
	it('returns the same amount for identical currencies', () => {
		expect(convert(1000, 'EUR', 'EUR', 1.08)).toBe(1000);
	});

	it('converts EUR to USD by multiplying', () => {
		expect(convert(1000, 'EUR', 'USD', 1.1)).toBeCloseTo(1100, 6);
	});

	it('converts USD to EUR by dividing', () => {
		expect(convert(1100, 'USD', 'EUR', 1.1)).toBeCloseTo(1000, 6);
	});
});

describe('normalize', () => {
	it('spreads a monthly price across day/month/year', () => {
		const n = normalize(sub({ amount: 3044, cycle: 'monthly' }), 'EUR', 1);
		expect(n.perDay).toBeCloseTo(100, 1);
		expect(n.perMonth).toBeCloseTo(3044, 0);
		expect(n.perYear).toBeCloseTo(3044 * 12, 0);
	});

	it('converts currency before normalizing', () => {
		const eur = normalize(sub({ amount: 1000, currency: 'EUR' }), 'USD', 2);
		const usd = normalize(sub({ amount: 2000, currency: 'USD' }), 'USD', 2);
		expect(eur.perMonth).toBeCloseTo(usd.perMonth, 6);
	});

	it('handles a multi-cycle (quarterly via count) subscription', () => {
		const quarterly = normalize(sub({ amount: 9000, cycle: 'monthly', cycleCount: 3 }), 'EUR', 1);
		const yearlyEquivalent = quarterly.perYear;
		expect(yearlyEquivalent).toBeCloseTo(9000 * 4, -1);
	});
});

describe('totals', () => {
	it('sums only active subscriptions', () => {
		const subs = [
			sub({ id: 1, amount: 1000, status: 'active' }),
			sub({ id: 2, amount: 2000, status: 'cancelled' }),
			sub({ id: 3, amount: 500, status: 'paused' })
		];
		const t = totals(subs, 'EUR', 1);
		expect(t.perMonth).toBeCloseTo(1000, 0);
	});

	it('returns zeros with no active subscriptions', () => {
		expect(totals([], 'EUR', 1)).toEqual({ perDay: 0, perMonth: 0, perYear: 0 });
	});
});

describe('byCategory', () => {
	it('groups active subscriptions and sorts by monthly spend', () => {
		const subs = [
			sub({ id: 1, category: 'Streaming', amount: 1000 }),
			sub({ id: 2, category: 'Streaming', amount: 500 }),
			sub({ id: 3, category: 'Music', amount: 2000 }),
			sub({ id: 4, category: 'Music', amount: 5000, status: 'cancelled' })
		];
		const result = byCategory(subs, 'EUR', 1);
		expect(result).toHaveLength(2);
		expect(result[0].category).toBe('Music');
		expect(result[0].count).toBe(1);
		expect(result[1].category).toBe('Streaming');
		expect(result[1].count).toBe(2);
	});

	it('labels missing categories as Uncategorized', () => {
		const result = byCategory([sub({ category: null })], 'EUR', 1);
		expect(result[0].category).toBe('Uncategorized');
	});
});

describe('bySubscription', () => {
	it('returns only active subscriptions in the requested category', () => {
		const subs = [
			sub({ id: 1, name: 'Spotify', category: 'Music', amount: 999 }),
			sub({ id: 2, name: 'Apple Music', category: 'Music', amount: 1099 }),
			sub({ id: 3, name: 'Netflix', category: 'Streaming', amount: 1599 }),
			sub({ id: 4, name: 'Tidal', category: 'Music', amount: 999, status: 'cancelled' })
		];
		const result = bySubscription(subs, 'Music', 'EUR', 1);
		expect(result).toHaveLength(2);
		expect(result.map((r) => r.name)).toEqual(['Apple Music', 'Spotify']);
	});

	it('uses the id as a unique key, keeping duplicate names separate', () => {
		const subs = [
			sub({ id: 7, name: 'GitHub', category: 'Software', amount: 400 }),
			sub({ id: 9, name: 'GitHub', category: 'Software', amount: 800 })
		];
		const result = bySubscription(subs, 'Software', 'EUR', 1);
		expect(result).toHaveLength(2);
		expect(result.map((r) => r.key)).toEqual(['9', '7']);
	});

	it('normalises missing category as Uncategorized to match byCategory', () => {
		const subs = [sub({ id: 1, name: 'Misc', category: null })];
		const result = bySubscription(subs, 'Uncategorized', 'EUR', 1);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Misc');
	});

	it('returns an empty array when no subscriptions match', () => {
		expect(bySubscription([], 'Anything', 'EUR', 1)).toEqual([]);
		expect(bySubscription([sub({ category: 'Music' })], 'Software', 'EUR', 1)).toEqual([]);
	});

	it('converts currency before summing per-month spend', () => {
		const subs = [
			sub({ id: 1, name: 'A', category: 'Tools', amount: 1000, currency: 'EUR' }),
			sub({ id: 2, name: 'B', category: 'Tools', amount: 2000, currency: 'USD' })
		];
		const result = bySubscription(subs, 'Tools', 'EUR', 2);
		// 1000 EUR + (2000 USD / 2) = 2000 EUR per month
		expect(result.reduce((sum, r) => sum + r.perMonth, 0)).toBeCloseTo(2000, 6);
	});
});

describe('topSpenders', () => {
	it('ranks active subscriptions by monthly cost descending', () => {
		const subs = [
			sub({ id: 1, name: 'Cheap', amount: 500 }),
			sub({ id: 2, name: 'Pricey', amount: 5000 }),
			sub({ id: 3, name: 'Mid', amount: 2000 })
		];
		const result = topSpenders(subs, 'EUR', 1);
		expect(result.map((r) => r.subscription.name)).toEqual(['Pricey', 'Mid', 'Cheap']);
	});

	it('excludes non-active subscriptions', () => {
		const subs = [
			sub({ id: 1, name: 'Active', amount: 100, status: 'active' }),
			sub({ id: 2, name: 'Cancelled', amount: 99999, status: 'cancelled' })
		];
		const result = topSpenders(subs, 'EUR', 1);
		expect(result.map((r) => r.subscription.name)).toEqual(['Active']);
	});

	it('respects the limit', () => {
		const subs = [sub({ id: 1 }), sub({ id: 2 }), sub({ id: 3 }), sub({ id: 4 })];
		expect(topSpenders(subs, 'EUR', 1, 2)).toHaveLength(2);
	});

	it('converts currency before ranking', () => {
		const subs = [
			sub({ id: 1, name: 'EurSub', amount: 1000, currency: 'EUR' }),
			sub({ id: 2, name: 'UsdSub', amount: 500, currency: 'USD' })
		];
		// 10 EUR/mo vs 5 USD/mo ≈ 4.63 EUR/mo at rate 1.08 -> EurSub wins.
		const result = topSpenders(subs, 'EUR', 1.08);
		expect(result[0].subscription.name).toBe('EurSub');
	});
});

describe('formatMoney', () => {
	it('renders minor units as currency', () => {
		expect(formatMoney(1299, 'USD')).toContain('12.99');
		expect(formatMoney(1299, 'EUR')).toContain('12.99');
	});
});
