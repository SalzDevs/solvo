import { beforeEach, describe, expect, it } from 'bun:test';
import { addCycle } from '../renewals';
import type { Subscription, SubscriptionInput } from '../types';

// `db.ts` computes its DB_PATH (and therefore whether it's a throwaway
// in-memory database) at import time, so this has to run before the dynamic
// imports below — a static `import` would be hoisted above it and the module
// would already be bound to the real `solvo.db` on disk by the time we got
// here.
process.env.SOLVO_DB = ':memory:';

const { getDb } = await import('./db');
const {
	cancelSubscription,
	createSubscription,
	deleteSubscription,
	exportData,
	getSettings,
	getSubscription,
	importData,
	listSubscriptions,
	reactivateSubscription,
	syncRenewals,
	updateSettings,
	updateSubscription
} = await import('./subscriptions');

/** ISO date `offsetDays` from today (UTC), e.g. -2 = two days ago. */
function dateOffset(offsetDays: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

function input(overrides: Partial<SubscriptionInput> = {}): SubscriptionInput {
	return {
		name: 'Netflix',
		category: 'Streaming',
		amount: 1349,
		currency: 'EUR',
		cycle: 'monthly',
		cycleCount: 1,
		startDate: '2026-01-01',
		nextRenewal: '2026-07-01',
		status: 'active',
		cancelUrl: 'https://www.netflix.com/cancelplan',
		cancelNotes: null,
		notes: null,
		isTrial: false,
		trialEndsOn: null,
		...overrides
	};
}

/** A full `Subscription` row, as `exportData`/`importData` deal in. */
function subscription(overrides: Partial<Subscription> = {}): Subscription {
	return {
		id: 0,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		cancelledAt: null,
		...input(),
		...overrides
	};
}

beforeEach(() => {
	// Every test starts from a clean slate. This is a throwaway in-memory
	// database (see SOLVO_DB above), so wiping the table is safe and keeps
	// tests independent of each other and of run order.
	getDb().exec('DELETE FROM subscriptions');
});

describe('createSubscription / getSubscription / listSubscriptions', () => {
	it('persists a subscription and returns it with an assigned id', () => {
		const created = createSubscription(input());
		expect(created.id).toBeGreaterThan(0);
		expect(created.name).toBe('Netflix');
		expect(getSubscription(created.id)?.name).toBe('Netflix');
	});

	it('lists active subscriptions before cancelled ones, then alphabetically', () => {
		createSubscription(input({ name: 'Zebra', status: 'cancelled' }));
		createSubscription(input({ name: 'Apple' }));
		createSubscription(input({ name: 'Banana' }));

		expect(listSubscriptions().map((s) => s.name)).toEqual(['Apple', 'Banana', 'Zebra']);
	});

	it('drops an unsafe cancel URL rather than persisting it', () => {
		const created = createSubscription(input({ cancelUrl: 'javascript:alert(1)' }));
		expect(created.cancelUrl).toBeNull();
	});
});

describe('updateSubscription', () => {
	it('updates fields in place and returns the new row', () => {
		const created = createSubscription(input());
		const updated = updateSubscription(
			created.id,
			input({ name: 'Netflix Premium', amount: 1799 })
		);
		expect(updated?.name).toBe('Netflix Premium');
		expect(updated?.amount).toBe(1799);
	});

	it('returns null for a non-existent id instead of throwing', () => {
		expect(updateSubscription(999_999, input())).toBeNull();
	});

	it('sanitizes an unsafe cancel URL on update too', () => {
		const created = createSubscription(input());
		const updated = updateSubscription(created.id, input({ cancelUrl: 'data:text/html,evil' }));
		expect(updated?.cancelUrl).toBeNull();
	});
});

describe('deleteSubscription', () => {
	it('removes the row', () => {
		const created = createSubscription(input());
		deleteSubscription(created.id);
		expect(getSubscription(created.id)).toBeNull();
	});
});

describe('cancelSubscription / reactivateSubscription', () => {
	it('marks a subscription cancelled and stamps cancelledAt', () => {
		const created = createSubscription(input());
		const cancelled = cancelSubscription(created.id);
		expect(cancelled?.status).toBe('cancelled');
		expect(cancelled?.cancelledAt).not.toBeNull();
	});

	it('reactivating clears cancelledAt and restores active status', () => {
		const created = createSubscription(input());
		cancelSubscription(created.id);
		const reactivated = reactivateSubscription(created.id);
		expect(reactivated?.status).toBe('active');
		expect(reactivated?.cancelledAt).toBeNull();
	});
});

describe('syncRenewals', () => {
	it('rolls an overdue active subscription forward to a future date', () => {
		const created = createSubscription(input({ nextRenewal: dateOffset(-5) }));
		syncRenewals();
		const renewed = getSubscription(created.id);
		expect(renewed?.nextRenewal).not.toBeNull();
		expect(renewed!.nextRenewal! >= dateOffset(0)).toBe(true);
	});

	it('leaves a future renewal date untouched', () => {
		const future = dateOffset(10);
		const created = createSubscription(input({ nextRenewal: future }));
		syncRenewals();
		expect(getSubscription(created.id)?.nextRenewal).toBe(future);
	});

	it('converts an expired trial to a paid subscription one cycle after it ended', () => {
		const trialEndsOn = dateOffset(-1);
		const created = createSubscription(
			input({ isTrial: true, trialEndsOn, nextRenewal: trialEndsOn })
		);

		syncRenewals();

		const converted = getSubscription(created.id);
		expect(converted?.isTrial).toBe(false);
		expect(converted?.trialEndsOn).toBeNull();
		// One cycle (monthly, per the fixture) after the trial end date.
		expect(converted?.nextRenewal).toBe(addCycle(trialEndsOn, 'monthly', 1));
	});

	it('is a no-op when nothing is overdue', () => {
		const future = dateOffset(3);
		createSubscription(input({ nextRenewal: future }));
		expect(() => syncRenewals()).not.toThrow();
	});
});

describe('settings', () => {
	it('round-trips display currency, fx rate, and theme', () => {
		updateSettings({ displayCurrency: 'USD', fxEurToUsd: 1.2, theme: 'ocean' });
		expect(getSettings()).toEqual({ displayCurrency: 'USD', fxEurToUsd: 1.2, theme: 'ocean' });
	});
});

describe('exportData / importData', () => {
	it('round-trips subscriptions and settings through export -> import', () => {
		createSubscription(input({ name: 'Spotify' }));
		updateSettings({ displayCurrency: 'USD', fxEurToUsd: 1.1, theme: 'forest' });

		const bundle = exportData();
		expect(bundle.subscriptions).toHaveLength(1);

		getDb().exec('DELETE FROM subscriptions');
		importData(bundle);

		expect(listSubscriptions().map((s) => s.name)).toEqual(['Spotify']);
		expect(getSettings().theme).toBe('forest');
	});

	it('replaces existing data rather than appending to it', () => {
		createSubscription(input({ name: 'Old one' }));

		importData({
			version: 1,
			exportedAt: '2026-01-01T00:00:00.000Z',
			settings: getSettings(),
			subscriptions: [subscription({ name: 'New one' })]
		});

		expect(listSubscriptions().map((s) => s.name)).toEqual(['New one']);
	});

	it('sanitizes unsafe cancel URLs coming from an imported backup file', () => {
		importData({
			version: 1,
			exportedAt: '2026-01-01T00:00:00.000Z',
			settings: getSettings(),
			subscriptions: [subscription({ cancelUrl: 'javascript:alert(document.cookie)' })]
		});

		expect(listSubscriptions()[0].cancelUrl).toBeNull();
	});
});
