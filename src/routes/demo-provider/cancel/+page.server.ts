import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	if (cookies.get('demo_session') !== '1') throw redirect(303, '/demo-provider/login');
	return { cancelled: cookies.get('demo_cancelled') === '1' };
};

export const actions: Actions = {
	default: async ({ cookies }) => {
		cookies.set('demo_cancelled', '1', { path: '/' });
		throw redirect(303, '/demo-provider/cancel');
	}
};
