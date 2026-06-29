import { getSettings } from '$lib/server/subscriptions';
import type { LayoutServerLoad } from './$types';

/**
 * Layout-level settings load. Lives here (not in the page server loads) so
 * the layout can read the current theme and keep `<html data-theme="...">`
 * in sync across client-side navigations and after the settings form
 * invalidates.
 */
export const load: LayoutServerLoad = async () => {
	return { settings: getSettings() };
};
