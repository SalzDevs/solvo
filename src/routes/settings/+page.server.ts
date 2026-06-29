import { fail } from '@sveltejs/kit';
import { getSettings, importData, updateSettings, type ExportBundle } from '$lib/server/subscriptions';
import { isKnownTheme } from '$lib/themes';
import { CURRENCIES, type Currency, type Settings } from '$lib/types';
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
		// Preserve the current theme when saving currency settings; the theme
		// has its own dedicated action that sets the cookie.
		const current = getSettings();
		const next: Settings = { displayCurrency, fxEurToUsd, theme: current.theme };
		updateSettings(next);
		return { success: true };
	},

	saveTheme: async ({ request, cookies }) => {
		const form = await request.formData();
		const theme = (form.get('theme') ?? '').toString();
		if (!isKnownTheme(theme)) {
			return fail(400, { error: 'Unknown theme.' });
		}
		const current = getSettings();
		updateSettings({ ...current, theme });
		// Mirror the theme in a cookie so the inline script in app.html can
		// apply it before first paint on the next navigation/load.
		cookies.set('solvo-theme', theme, {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: false
		});
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
