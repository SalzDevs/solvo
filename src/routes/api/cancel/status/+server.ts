import { json } from '@sveltejs/kit';
import { getRunStatus } from '$lib/server/cancellation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const runId = url.searchParams.get('runId');
	if (!runId) return json({ error: 'runId is required.' }, { status: 400 });
	const run = getRunStatus(runId);
	if (!run) return json({ error: 'Run not found.' }, { status: 404 });
	return json(run);
};
