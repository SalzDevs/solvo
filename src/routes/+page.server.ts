import { monthlyProjection } from '$lib/charts';
import { byCategory, totals } from '$lib/cost';
import { getSettings, listSubscriptions, syncRenewals } from '$lib/server/subscriptions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	syncRenewals();
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
		projection: monthlyProjection(subscriptions, settings.displayCurrency, settings.fxEurToUsd, 12),
		counts: {
			active: active.length,
			total: subscriptions.length
		},
		upcoming
	};
};
