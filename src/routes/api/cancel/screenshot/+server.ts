import { error } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'node:fs';
import { getRunScreenshotPath } from '$lib/server/cancellation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const runId = url.searchParams.get('runId');
	if (!runId) throw error(400, 'runId is required.');
	const filePath = getRunScreenshotPath(runId);
	if (!filePath || !existsSync(filePath)) throw error(404, 'No screenshot.');
	const bytes = readFileSync(filePath);
	return new Response(new Uint8Array(bytes), {
		headers: { 'content-type': 'image/png', 'cache-control': 'no-store' }
	});
};
