import { fail } from '@sveltejs/kit';
import { getSettings, importData, updateSettings, type ExportBundle } from '$lib/server/subscriptions';
import { CURRENCIES, type Currency } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { settings: getSettings() };
};

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const displayCurrency = (form.get('displayCurrency') ?? '').toString() as Currency;
		if (!CURRENCIES.includes(displayCurrency)) {
			return fail(400, { error: 'Invalid display currency.' });
		}
		const fxEurToUsd = Number(form.get('fxEurToUsd'));
		if (!Number.isFinite(fxEurToUsd) || fxEurToUsd <= 0) {
			return fail(400, { error: 'Exchange rate must be a positive number.' });
		}
		updateSettings({ displayCurrency, fxEurToUsd });
		return { success: true };
	},

	import: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose a backup file to import.' });
		}
		let bundle: ExportBundle;
		try {
			bundle = JSON.parse(await file.text());
		} catch {
			return fail(400, { error: 'That file is not valid JSON.' });
		}
		if (!bundle || !Array.isArray(bundle.subscriptions)) {
			return fail(400, { error: 'That file is not a Solvo backup.' });
		}
		importData(bundle);
		return { success: true, imported: bundle.subscriptions.length };
	}
};
