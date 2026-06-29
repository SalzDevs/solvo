import { daysUntil } from './renewals';
import type { Subscription } from './types';

export type TrialTone = 'overdue' | 'today' | 'soon' | 'later';

export interface TrialReminder {
	subscription: Subscription;
	trialEndsOn: string;
	daysUntil: number;
	tone: TrialTone;
	label: string;
}

/**
 * Surface active trials as dashboard reminders. Sorted most-urgent first
 * (overdue / today / soonest end date at the top), with a tone and a
 * human-readable label so the dashboard card can style and render each
 * row without re-doing the date math.
 *
 * Pure: takes a `today` string so tests don't have to mock the clock.
 */
export function getActiveTrialReminders(
	subscriptions: readonly Subscription[],
	today: string = new Date().toISOString().slice(0, 10)
): TrialReminder[] {
	const reminders: TrialReminder[] = [];
	for (const s of subscriptions) {
		if (s.status !== 'active' || !s.isTrial || !s.trialEndsOn) continue;
		const days = daysUntil(s.trialEndsOn, today);
		let tone: TrialTone;
		let label: string;
		if (days < 0) {
			tone = 'overdue';
			const n = Math.abs(days);
			label = `Trial ended ${n} day${n === 1 ? '' : 's'} ago`;
		} else if (days === 0) {
			tone = 'today';
			label = 'Trial ends today';
		} else if (days === 1) {
			tone = 'soon';
			label = 'Trial ends tomorrow';
		} else if (days <= 7) {
			tone = 'soon';
			label = `Trial ends in ${days} days`;
		} else {
			tone = 'later';
			label = `Trial ends in ${days} days`;
		}
		reminders.push({ subscription: s, trialEndsOn: s.trialEndsOn, daysUntil: days, tone, label });
	}
	return reminders.sort((a, b) => a.daysUntil - b.daysUntil);
}
