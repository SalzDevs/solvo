import { describe, expect, test } from 'bun:test';
import { nextSortState, sortSubscriptions } from './subscriptions-sort';
import type { Subscription } from './types';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
	return {
		id: 1,
		name: 'Netflix',
		category: 'Streaming',
		amount: 1349,
		currency: 'EUR',
		cycle: 'monthly',
		cycleCount: 1,
		startDate: '2025-01-01',
		nextRenewal: '2025-02-01',
		status: 'active',
		cancelUrl: null,
		cancelNotes: null,
		cancelledAt: null,
		notes: null,
		isTrial: false,
		trialEndsOn: null,
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

describe('sortSubscriptions — name', () => {
	test('sorts case-insensitively ascending and descending', () => {
		const subs = [makeSub({ id: 1, name: 'spotify' }), makeSub({ id: 2, name: 'Netflix' })];
		expect(sortSubscriptions(subs, { key: 'name', direction: 'asc' }, 'EUR', 1.08).map((s) => s.id)).toEqual([
			2,
			1
		]);
		expect(sortSubscriptions(subs, { key: 'name', direction: 'desc' }, 'EUR', 1.08).map((s) => s.id)).toEqual([
			1,
			2
		]);
	});

	test('is stable for equal names', () => {
		const subs = [makeSub({ id: 1, name: 'Same' }), makeSub({ id: 2, name: 'Same' })];
		expect(sortSubscriptions(subs, { key: 'name', direction: 'asc' }, 'EUR', 1.08).map((s) => s.id)).toEqual([
			1,
			2
		]);
	});
});

describe('sortSubscriptions — monthly', () => {
	test('orders by normalized monthly cost, converting currency', () => {
		const subs = [
			makeSub({ id: 1, amount: 1000, currency: 'EUR', cycle: 'monthly' }),
			makeSub({ id: 2, amount: 500, currency: 'USD', cycle: 'monthly' })
		];
		// 1: 10 EUR/mo. 2: 5 USD/mo ≈ 4.63 EUR/mo at rate 1.08 -> 1 is more expensive.
		expect(sortSubscriptions(subs, { key: 'monthly', direction: 'desc' }, 'EUR', 1.08).map((s) => s.id)).toEqual(
			[1, 2]
		);
		expect(sortSubscriptions(subs, { key: 'monthly', direction: 'asc' }, 'EUR', 1.08).map((s) => s.id)).toEqual(
			[2, 1]
		);
	});

	test('treats non-active subscriptions as zero cost', () => {
		const subs = [
			makeSub({ id: 1, status: 'cancelled', amount: 99999 }),
			makeSub({ id: 2, status: 'active', amount: 100 })
		];
		expect(sortSubscriptions(subs, { key: 'monthly', direction: 'desc' }, 'EUR', 1.08).map((s) => s.id)).toEqual(
			[2, 1]
		);
	});
});

describe('sortSubscriptions — nextRenewal', () => {
	test('orders by date and pushes missing dates to the end either direction', () => {
		const subs = [
			makeSub({ id: 1, nextRenewal: '2025-06-01' }),
			makeSub({ id: 2, nextRenewal: null }),
			makeSub({ id: 3, nextRenewal: '2025-03-01' })
		];
		expect(
			sortSubscriptions(subs, { key: 'nextRenewal', direction: 'asc' }, 'EUR', 1.08).map((s) => s.id)
		).toEqual([3, 1, 2]);
		expect(
			sortSubscriptions(subs, { key: 'nextRenewal', direction: 'desc' }, 'EUR', 1.08).map((s) => s.id)
		).toEqual([1, 3, 2]);
	});
});

describe('nextSortState', () => {
	test('starts ascending when sorting by a new key', () => {
		expect(nextSortState(null, 'name')).toEqual({ key: 'name', direction: 'asc' });
		expect(nextSortState({ key: 'monthly', direction: 'desc' }, 'name')).toEqual({
			key: 'name',
			direction: 'asc'
		});
	});

	test('toggles direction when clicking the same key again', () => {
		expect(nextSortState({ key: 'name', direction: 'asc' }, 'name')).toEqual({
			key: 'name',
			direction: 'desc'
		});
		expect(nextSortState({ key: 'name', direction: 'desc' }, 'name')).toEqual({
			key: 'name',
			direction: 'asc'
		});
	});
});
