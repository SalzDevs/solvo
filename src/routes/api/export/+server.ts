import { exportData } from '$lib/server/subscriptions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const bundle = exportData();
	const date = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(bundle, null, 2), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': `attachment; filename="solvo-backup-${date}.json"`
		}
	});
};
