// Standalone Playwright runner for cancellation recipes. Spawned as a separate
// Node process by the Solvo server so the browser engine never runs inside the
// Bun web server. Reads a JSON "plan" and appends newline-delimited JSON
// progress to an output file the server polls.
//
// Plan shape: { runId, recipe: { steps }, baseUrl, headless, profileDir?, screenshotDir }

import { chromium } from 'playwright';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
	const out = {};
	for (let i = 2; i < argv.length; i++) {
		if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
	}
	return out;
}

const args = parseArgs(process.argv);
const plan = JSON.parse(readFileSync(args.plan, 'utf8'));
const outFile = args.out;

function emit(obj) {
	appendFileSync(outFile, JSON.stringify({ ...obj, ts: Date.now() }) + '\n');
}

function resolveUrl(url) {
	return /^https?:/i.test(url) ? url : (plan.baseUrl || '') + url;
}

let context;

async function cleanup() {
	try {
		if (context) await context.close();
	} catch {
		// ignore
	}
}

function fail(message) {
	emit({ t: 'done', status: 'failed', error: message });
}

try {
	emit({ t: 'start', runId: plan.runId });

	let page;
	if (plan.profileDir) {
		mkdirSync(plan.profileDir, { recursive: true });
		context = await chromium.launchPersistentContext(plan.profileDir, { headless: plan.headless });
		page = context.pages()[0] ?? (await context.newPage());
	} else {
		const browser = await chromium.launch({ headless: plan.headless });
		context = await browser.newContext();
		page = await context.newPage();
	}

	const steps = plan.recipe.steps ?? [];
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const description = step.description || step.action;
		const timeout = step.timeoutMs || (step.manual ? 300000 : 30000);

		emit({
			t: 'step',
			i,
			action: step.action,
			description,
			status: step.action === 'waitFor' && step.manual ? 'waiting' : 'running',
			message: step.action === 'waitFor' && step.manual ? description : undefined
		});

		try {
			switch (step.action) {
				case 'goto':
					await page.goto(resolveUrl(step.url), { timeout, waitUntil: 'domcontentloaded' });
					break;
				case 'click':
					await page.click(step.selector, { timeout });
					break;
				case 'fill':
					await page.fill(step.selector, step.value, { timeout });
					break;
				case 'waitFor':
					await page.waitForSelector(step.selector, { timeout });
					break;
				case 'assertText': {
					await page.waitForSelector(step.selector, { timeout });
					const text = (await page.textContent(step.selector)) ?? '';
					if (!text.toLowerCase().includes(String(step.contains).toLowerCase())) {
						throw new Error(`Expected "${step.contains}" but saw "${text.trim().slice(0, 80)}"`);
					}
					break;
				}
				case 'screenshot': {
					mkdirSync(plan.screenshotDir, { recursive: true });
					const file = path.join(plan.screenshotDir, `${plan.runId}-${step.name}.png`);
					await page.screenshot({ path: file, fullPage: true });
					emit({ t: 'shot', path: file });
					break;
				}
				default:
					throw new Error(`Unknown step action: ${step.action}`);
			}
			emit({ t: 'step', i, action: step.action, description, status: 'ok' });
		} catch (err) {
			const message = String((err && err.message) || err);
			emit({ t: 'step', i, action: step.action, description, status: 'fail', message });
			fail(message);
			await cleanup();
			process.exit(1);
		}
	}

	emit({ t: 'done', status: 'succeeded' });
	await cleanup();
	process.exit(0);
} catch (err) {
	fail(String((err && err.message) || err));
	await cleanup();
	process.exit(1);
}
