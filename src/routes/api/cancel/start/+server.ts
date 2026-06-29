import { json } from '@sveltejs/kit';
import { CancellationError, startRun } from '$lib/server/cancellation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
	const body = (await request.json().catch(() => ({}))) as { subscriptionId?: number };
	if (typeof body.subscriptionId !== 'number') {
		return json({ error: 'subscriptionId is required.' }, { status: 400 });
	}
	try {
		const { runId } = startRun(body.subscriptionId, url.origin);
		return json({ runId });
	} catch (err) {
		if (err instanceof CancellationError) {
			return json({ error: err.message }, { status: 400 });
		}
		throw err;
	}
};
