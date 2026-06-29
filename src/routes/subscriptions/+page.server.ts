import { fail } from '@sveltejs/kit';
import { REGISTRY } from '$lib/registry';
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
			notes: optional(form, 'notes')
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
	}
};
