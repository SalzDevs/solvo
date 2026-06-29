import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		// A mock provider — any credentials "work". Sets a session cookie.
		cookies.set('demo_session', '1', { path: '/' });
		throw redirect(303, '/demo-provider/account');
	}
};
