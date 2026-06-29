import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { findRecipeForName, getRecipe } from '$lib/cancellation/recipes';
import type { RunStatus, RunStepView, RunView, StepStatus } from '$lib/cancellation/types';
import { getDb } from './db';
import { cancelSubscription, getSubscription } from './subscriptions';

const RUNS_DIR = process.env.SOLVO_RUNS ?? path.resolve('.solvo/runs');
const PROFILES_DIR = path.resolve('.solvo/profiles');
const RUNNER = path.resolve('scripts/cancel-runner.mjs');
const HEADLESS = process.env.SOLVO_CANCEL_HEADLESS === '1';

function now(): string {
	return new Date().toISOString();
}

function progressPath(runId: string): string {
	return path.join(RUNS_DIR, `${runId}.ndjson`);
}

export class CancellationError extends Error {}

/** Whether a subscription can be cancelled automatically (has a recipe). */
export function recipeIdForName(name: string): string | null {
	return findRecipeForName(name)?.id ?? null;
}

export function startRun(subscriptionId: number, baseUrl: string): { runId: string } {
	const sub = getSubscription(subscriptionId);
	if (!sub) throw new CancellationError('Subscription not found.');

	const recipe = findRecipeForName(sub.name);
	if (!recipe) throw new CancellationError(`No automated cancellation recipe for "${sub.name}".`);

	const runId = crypto.randomUUID();
	mkdirSync(RUNS_DIR, { recursive: true });
	writeFileSync(progressPath(runId), '');

	const plan = {
		runId,
		recipe: { id: recipe.id, steps: recipe.steps },
		baseUrl,
		headless: HEADLESS,
		// Real providers reuse a persistent profile so login/2FA persists between
		// runs; the bundled demo always starts fresh.
		profileDir: recipe.id === 'demo-provider' ? undefined : path.join(PROFILES_DIR, recipe.id),
		screenshotDir: RUNS_DIR
	};
	const planPath = path.join(RUNS_DIR, `${runId}.plan.json`);
	writeFileSync(planPath, JSON.stringify(plan));

	getDb()
		.query(
			`INSERT INTO cancellation_runs (id, subscription_id, recipe_id, status, created_at, updated_at)
			 VALUES ($id, $sub, $recipe, 'running', $ts, $ts)`
		)
		.run({ $id: runId, $sub: subscriptionId, $recipe: recipe.id, $ts: now() });

	const child = spawn('node', [RUNNER, '--plan', planPath, '--out', progressPath(runId)], {
		stdio: 'ignore',
		detached: false
	});
	child.unref();

	return { runId };
}

interface RunRow {
	id: string;
	subscription_id: number;
	recipe_id: string;
	status: string;
	error: string | null;
	screenshot: string | null;
}

interface ProgressLine {
	t: string;
	i?: number;
	action?: string;
	description?: string;
	status?: StepStatus;
	message?: string;
	path?: string;
	error?: string;
}

function readProgress(runId: string): ProgressLine[] {
	const file = progressPath(runId);
	if (!existsSync(file)) return [];
	return readFileSync(file, 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			try {
				return JSON.parse(line) as ProgressLine;
			} catch {
				return null;
			}
		})
		.filter((l): l is ProgressLine => l !== null);
}

export function getRunStatus(runId: string): RunView | null {
	const row = getDb()
		.query('SELECT * FROM cancellation_runs WHERE id = $id')
		.get({ $id: runId }) as RunRow | null;
	if (!row) return null;

	const recipe = getRecipe(row.recipe_id);
	const lines = readProgress(runId);

	// Seed the step list from the recipe so the UI shows the full plan up front.
	const steps: RunStepView[] = (recipe?.steps ?? []).map((s, index) => ({
		index,
		action: s.action,
		description: s.description || s.action,
		status: 'pending' as StepStatus
	}));

	let screenshotPath: string | null = row.screenshot;
	let done: { status: RunStatus; error?: string } | null = null;

	for (const line of lines) {
		if (line.t === 'step' && typeof line.i === 'number' && steps[line.i]) {
			steps[line.i].status = line.status ?? steps[line.i].status;
			if (line.message) steps[line.i].message = line.message;
		} else if (line.t === 'shot' && line.path) {
			screenshotPath = line.path;
		} else if (line.t === 'done') {
			done = { status: (line.status as RunStatus) ?? 'failed', error: line.error };
		}
	}

	let status: RunStatus;
	if (done) {
		status = done.status;
	} else if (steps.some((s) => s.status === 'waiting')) {
		status = 'waiting_user';
	} else {
		status = 'running';
	}

	// Finalize on first observation of a terminal state.
	if (done && row.status !== status) {
		if (status === 'succeeded') cancelSubscription(row.subscription_id);
		getDb()
			.query(
				`UPDATE cancellation_runs
				 SET status = $status, error = $error, screenshot = $shot, updated_at = $ts
				 WHERE id = $id`
			)
			.run({
				$status: status,
				$error: done.error ?? null,
				$shot: screenshotPath,
				$ts: now(),
				$id: runId
			});
	}

	return {
		id: runId,
		subscriptionId: row.subscription_id,
		recipeId: row.recipe_id,
		status,
		steps,
		error: done?.error ?? row.error ?? undefined,
		screenshot: screenshotPath ? `/api/cancel/screenshot?runId=${runId}` : undefined
	};
}

export function getRunScreenshotPath(runId: string): string | null {
	const row = getDb()
		.query('SELECT screenshot FROM cancellation_runs WHERE id = $id')
		.get({ $id: runId }) as { screenshot: string | null } | null;
	return row?.screenshot ?? null;
}
