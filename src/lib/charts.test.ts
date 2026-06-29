import { describe, expect, it } from 'bun:test';
import { monthlyProjection, projectionTotal } from './charts';
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

const FROM = '2026-06-15';

describe('monthlyProjection', () => {
	it('builds a contiguous run of month buckets', () => {
		const buckets = monthlyProjection([], 'EUR', 1, 12, FROM);
		expect(buckets).toHaveLength(12);
		expect(buckets[0].key).toBe('2026-06');
		expect(buckets[0].label).toBe('Jun');
		expect(buckets[11].key).toBe('2027-05');
	});

	it('spreads a monthly subscription across every month', () => {
		const buckets = monthlyProjection(
			[sub({ amount: 1000, cycle: 'monthly', nextRenewal: '2026-06-20' })],
			'EUR',
			1,
			12,
			FROM
		);
		expect(buckets.every((b) => b.total === 1000)).toBe(true);
		expect(projectionTotal(buckets)).toBe(12000);
	});

	it('places a yearly charge in a single month', () => {
		const buckets = monthlyProjection(
			[sub({ amount: 12000, cycle: 'yearly', nextRenewal: '2026-09-01' })],
			'EUR',
			1,
			12,
			FROM
		);
		const sept = buckets.find((b) => b.key === '2026-09');
		expect(sept?.total).toBe(12000);
		expect(projectionTotal(buckets)).toBe(12000);
	});

	it('sums multiple subscriptions per month and converts currency', () => {
		const buckets = monthlyProjection(
			[
				sub({ id: 1, amount: 1000, cycle: 'monthly', currency: 'EUR', nextRenewal: '2026-07-01' }),
				sub({ id: 2, amount: 2000, cycle: 'yearly', currency: 'USD', nextRenewal: '2026-07-10' })
			],
			'EUR',
			2,
			12,
			FROM
		);
		const july = buckets.find((b) => b.key === '2026-07');
		// 1000 EUR + (2000 USD / 2) = 1000 + 1000
		expect(july?.total).toBe(2000);
	});

	it('ignores cancelled subscriptions', () => {
		const buckets = monthlyProjection(
			[sub({ status: 'cancelled', amount: 5000, nextRenewal: '2026-07-01' })],
			'EUR',
			1,
			12,
			FROM
		);
		expect(projectionTotal(buckets)).toBe(0);
	});
});
