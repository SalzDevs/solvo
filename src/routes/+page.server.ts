import { byCategory, totals } from '$lib/cost';
import { getSettings, listSubscriptions } from '$lib/server/subscriptions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const subscriptions = listSubscriptions();
	const settings = getSettings();
	const active = subscriptions.filter((s) => s.status === 'active');

	const upcoming = active
		.filter((s) => s.nextRenewal)
		.sort((a, b) => (a.nextRenewal! < b.nextRenewal! ? -1 : 1))
		.slice(0, 5);

	return {
		settings,
		totals: totals(subscriptions, settings.displayCurrency, settings.fxEurToUsd),
		categories: byCategory(subscriptions, settings.displayCurrency, settings.fxEurToUsd),
		counts: {
			active: active.length,
			total: subscriptions.length
		},
		upcoming
	};
};
