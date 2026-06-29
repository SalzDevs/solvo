import { describe, expect, it } from 'bun:test';
import { getActiveTrialReminders } from './trials';
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

const TODAY = '2026-06-29';

describe('getActiveTrialReminders', () => {
	it('returns empty when there are no subscriptions', () => {
		expect(getActiveTrialReminders([], TODAY)).toEqual([]);
	});

	it('returns empty when no subs are on trial', () => {
		const subs = [sub({ id: 1 }), sub({ id: 2, status: 'paused' })];
		expect(getActiveTrialReminders(subs, TODAY)).toEqual([]);
	});

	it('includes only active subs with isTrial + a trial end date', () => {
		const subs = [
			sub({ id: 1, name: 'Active trial', isTrial: true, trialEndsOn: '2026-07-05' }),
			sub({ id: 2, name: 'Not on trial', isTrial: false, trialEndsOn: '2026-07-05' }),
			sub({ id: 3, name: 'Cancelled trial', status: 'cancelled', isTrial: true, trialEndsOn: '2026-07-05' }),
			sub({ id: 4, name: 'Trial no date', isTrial: true, trialEndsOn: null })
		];
		const reminders = getActiveTrialReminders(subs, TODAY);
		expect(reminders).toHaveLength(1);
		expect(reminders[0].subscription.name).toBe('Active trial');
	});

	it('sorts most-urgent first (smallest daysUntil)', () => {
		const subs = [
			sub({ id: 1, name: 'A', isTrial: true, trialEndsOn: '2026-07-29' }), // 30 days
			sub({ id: 2, name: 'B', isTrial: true, trialEndsOn: '2026-07-01' }), // 2 days
			sub({ id: 3, name: 'C', isTrial: true, trialEndsOn: '2026-07-15' }) // 16 days
		];
		const reminders = getActiveTrialReminders(subs, TODAY);
		expect(reminders.map((r) => r.subscription.name)).toEqual(['B', 'C', 'A']);
	});

	it('classifies tones correctly', () => {
		const subs = [
			sub({ id: 1, name: 'past', isTrial: true, trialEndsOn: '2026-06-25' }), // -4 → overdue
			sub({ id: 2, name: 'today', isTrial: true, trialEndsOn: '2026-06-29' }), // 0 → today
			sub({ id: 3, name: 'tomorrow', isTrial: true, trialEndsOn: '2026-06-30' }), // 1 → soon
			sub({ id: 4, name: 'soon3', isTrial: true, trialEndsOn: '2026-07-02' }), // 3 → soon
			sub({ id: 5, name: 'later', isTrial: true, trialEndsOn: '2026-08-15' }) // 47 → later
		];
		const reminders = getActiveTrialReminders(subs, TODAY);
		const byName = Object.fromEntries(reminders.map((r) => [r.subscription.name, r.tone]));
		expect(byName.past).toBe('overdue');
		expect(byName.today).toBe('today');
		expect(byName.tomorrow).toBe('soon');
		expect(byName.soon3).toBe('soon');
		expect(byName.later).toBe('later');
	});

	it('produces human-friendly labels for the common cases', () => {
		const subs = [
			sub({ id: 1, name: 'overdue1', isTrial: true, trialEndsOn: '2026-06-28' }), // -1
			sub({ id: 2, name: 'today', isTrial: true, trialEndsOn: '2026-06-29' }),
			sub({ id: 3, name: 'tomorrow', isTrial: true, trialEndsOn: '2026-06-30' }),
			sub({ id: 4, name: 'in5', isTrial: true, trialEndsOn: '2026-07-04' }),
			sub({ id: 5, name: 'in30', isTrial: true, trialEndsOn: '2026-07-29' })
		];
		const labels = Object.fromEntries(
			getActiveTrialReminders(subs, TODAY).map((r) => [r.subscription.name, r.label])
		);
		expect(labels.overdue1).toBe('Trial ended 1 day ago');
		expect(labels.today).toBe('Trial ends today');
		expect(labels.tomorrow).toBe('Trial ends tomorrow');
		expect(labels.in5).toBe('Trial ends in 5 days');
		expect(labels.in30).toBe('Trial ends in 30 days');
	});

	it('uses the current date when `today` is not provided', () => {
		// Sanity: no throw, returns the right shape with system clock.
		const reminders = getActiveTrialReminders([
			sub({ id: 1, isTrial: true, trialEndsOn: '2099-12-31' })
		]);
		expect(reminders).toHaveLength(1);
		expect(reminders[0].tone).toBe('later');
	});
});
