import { fail } from '@sveltejs/kit';
import { REGISTRY } from '$lib/registry';
import { today } from '$lib/renewals';
import {
	cancelSubscription,
	createSubscription,
	deleteSubscription,
	getSettings,
	getSubscription,
	listSubscriptions,
	reactivateSubscription,
	syncRenewals,
	updateSubscription
} from '$lib/server/subscriptions';
import {
	BILLING_CYCLES,
	CURRENCIES,
	type BillingCycle,
	type Currency,
	type SubscriptionInput,
	type SubscriptionStatus
} from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	syncRenewals();
	return {
		subscriptions: listSubscriptions(),
		settings: getSettings(),
		registry: REGISTRY
	};
};

function str(form: FormData, key: string): string {
	return (form.get(key) ?? '').toString().trim();
}

function optional(form: FormData, key: string): string | null {
	const value = str(form, key);
	return value === '' ? null : value;
}

type ParseResult =
	| { ok: true; value: SubscriptionInput }
	| { ok: false; error: string };

function parseInput(form: FormData): ParseResult {
	const name = str(form, 'name');
	if (!name) return { ok: false, error: 'Name is required.' };

	const amountMajor = Number(str(form, 'amount'));
	if (!Number.isFinite(amountMajor) || amountMajor < 0) {
		return { ok: false, error: 'Enter a valid price.' };
	}

	const currency = str(form, 'currency') as Currency;
	if (!CURRENCIES.includes(currency)) return { ok: false, error: 'Invalid currency.' };

	const cycle = str(form, 'cycle') as BillingCycle;
	if (!BILLING_CYCLES.includes(cycle)) return { ok: false, error: 'Invalid billing cycle.' };

	const cycleCount = Math.max(1, Math.floor(Number(str(form, 'cycleCount')) || 1));

	const status = (str(form, 'status') || 'active') as SubscriptionStatus;

	return {
		ok: true,
		value: {
			name,
			category: optional(form, 'category'),
			amount: Math.round(amountMajor * 100),
			currency,
			cycle,
			cycleCount,
			startDate: optional(form, 'startDate'),
			nextRenewal: optional(form, 'nextRenewal'),
			status,
			cancelUrl: optional(form, 'cancelUrl'),
			cancelNotes: optional(form, 'cancelNotes'),
			notes: optional(form, 'notes'),
			// Trial fields are preserved across edits via hidden inputs on the
			// form (see +page.svelte), so we just round-trip them here. New
			// subs default to "not a trial"; the trial is set later via the
			// dedicated ?/startTrial action.
			isTrial: str(form, 'isTrial') === '1',
			trialEndsOn: optional(form, 'trialEndsOn')
		}
	};
}

function id(form: FormData): number | null {
	const value = Number(str(form, 'id'));
	return Number.isInteger(value) && value > 0 ? value : null;
}

function cancelConfirmationPhrase(name: string): string {
	return `${name} canceled`;
}

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const parsed = parseInput(form);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		createSubscription(parsed.value);
		return { success: true };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const subId = id(form);
		if (!subId) return fail(400, { error: 'Missing subscription id.' });
		const parsed = parseInput(form);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		updateSubscription(subId, parsed.value);
		return { success: true };
	},

	cancel: async ({ request }) => {
		const form = await request.formData();
		const subId = id(form);
		if (!subId) return fail(400, { error: 'Missing subscription id.' });

		const subscription = getSubscription(subId);
		if (!subscription) return fail(404, { error: 'Subscription not found.' });

		const confirmation = str(form, 'confirmation');
		const expected = cancelConfirmationPhrase(subscription.name);
		if (confirmation.toLowerCase() !== expected.toLowerCase()) {
			return fail(400, {
				error: `Type "${expected}" to confirm you cancelled with the provider.`
			});
		}

		cancelSubscription(subId);
		return { success: true };
	},

	reactivate: async ({ request }) => {
		const form = await request.formData();
		const subId = id(form);
		if (!subId) return fail(400, { error: 'Missing subscription id.' });
		reactivateSubscription(subId);
		return { success: true };
	},

	remove: async ({ request }) => {
		const form = await request.formData();
		const subId = id(form);
		if (!subId) return fail(400, { error: 'Missing subscription id.' });
		deleteSubscription(subId);
		return { success: true };
	},

	startTrial: async ({ request }) => {
		const form = await request.formData();
		const subId = id(form);
		if (!subId) return fail(400, { error: 'Missing subscription id.' });

		const subscription = getSubscription(subId);
		if (!subscription) return fail(404, { error: 'Subscription not found.' });
		if (subscription.status !== 'active') {
			return fail(400, { error: 'Only active subscriptions can start a trial.' });
		}
		if (subscription.isTrial) {
			return fail(400, { error: 'This subscription is already in a trial.' });
		}

		const trialEndsOn = str(form, 'trialEndsOn');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(trialEndsOn)) {
			return fail(400, { error: 'Pick a valid trial end date.' });
		}
		if (trialEndsOn <= today()) {
			return fail(400, { error: 'Trial end date must be in the future.' });
		}

		updateSubscription(subId, {
			...subscription,
			isTrial: true,
			trialEndsOn
		});
		return { success: true, trialEndsOn };
	},

	cancelTrial: async ({ request }) => {
		// Lightweight cancel used by the in-trial "Cancel trial" button. Unlike
		// the regular cancel action it skips the phrase confirmation: the user
		// already confirmed intent by clicking the dedicated trial button.
		const form = await request.formData();
		const subId = id(form);
		if (!subId) return fail(400, { error: 'Missing subscription id.' });
		const sub = getSubscription(subId);
		if (!sub) return fail(404, { error: 'Subscription not found.' });
		cancelSubscription(subId);
		return { success: true };
	}
};
