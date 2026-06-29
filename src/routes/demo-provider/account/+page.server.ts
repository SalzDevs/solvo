import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	if (cookies.get('demo_session') !== '1') throw redirect(303, '/demo-provider/login');
};
