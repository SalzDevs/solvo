import { Database } from 'bun:sqlite';
import type { Settings, Subscription } from '$lib/types';

/**
 * Demo mode (SOLVO_DEMO=1 or `--demo`) runs against a throwaway in-memory
 * database seeded with sample subscriptions, so the app can be explored without
 * touching real data.
 */
export const DEMO = process.env.SOLVO_DEMO === '1' || process.argv.includes('--demo');

/**
 * Local SQLite database. The file lives on the user's machine (default
 * `solvo.db` in the project root) — no cloud, fully private. Override the
 * location with the SOLVO_DB environment variable.
 */
const DB_PATH = DEMO ? ':memory:' : (process.env.SOLVO_DB ?? 'solvo.db');

let db: Database | null = null;

export function getDb(): Database {
	if (db) return db;
	db = new Database(DB_PATH, { create: true });
	if (!DEMO) db.exec('PRAGMA journal_mode = WAL;');
	migrate(db);
	seedSettings(db);
	if (DEMO) seedDemo(db);
	return db;
}

function migrate(database: Database): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS subscriptions (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			name         TEXT NOT NULL,
			category     TEXT,
			amount       INTEGER NOT NULL,
			currency     TEXT NOT NULL DEFAULT 'EUR',
			cycle        TEXT NOT NULL DEFAULT 'monthly',
			cycle_count  INTEGER NOT NULL DEFAULT 1,
			start_date   TEXT,
			next_renewal TEXT,
			status       TEXT NOT NULL DEFAULT 'active',
			cancel_url   TEXT,
			cancel_notes TEXT,
			cancelled_at TEXT,
			notes        TEXT,
			created_at   TEXT NOT NULL,
			updated_at   TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS cancellation_runs (
			id              TEXT PRIMARY KEY,
			subscription_id INTEGER NOT NULL,
			recipe_id       TEXT NOT NULL,
			status          TEXT NOT NULL,
			error           TEXT,
			screenshot      TEXT,
			created_at      TEXT NOT NULL,
			updated_at      TEXT NOT NULL
		);
	`);
}

const DEFAULT_SETTINGS: Settings = {
	displayCurrency: 'EUR',
	fxEurToUsd: 1.08
};

function seedSettings(database: Database): void {
	const insert = database.query(
		'INSERT OR IGNORE INTO settings (key, value) VALUES ($key, $value)'
	);
	insert.run({ $key: 'displayCurrency', $value: DEFAULT_SETTINGS.displayCurrency });
	insert.run({ $key: 'fxEurToUsd', $value: String(DEFAULT_SETTINGS.fxEurToUsd) });
}

/** ISO date `offsetDays` from today (UTC), e.g. -2 = two days ago. */
function dateOffset(offsetDays: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

interface DemoSeed {
	name: string;
	category: string;
	amount: number;
	currency: string;
	cycle: string;
	cycleCount: number;
	renewalOffset: number;
	status?: string;
	cancelUrl?: string;
	cancelNotes?: string;
}

const DEMO_SUBS: DemoSeed[] = [
	{ name: 'ChatGPT Plus', category: 'Software', amount: 2000, currency: 'USD', cycle: 'monthly', cycleCount: 1, renewalOffset: 1, cancelUrl: 'https://chatgpt.com/#settings/Subscription' },
	{ name: 'Netflix', category: 'Streaming', amount: 1349, currency: 'EUR', cycle: 'monthly', cycleCount: 1, renewalOffset: 3, cancelUrl: 'https://www.netflix.com/cancelplan' },
	{ name: 'iCloud+', category: 'Cloud Storage', amount: 299, currency: 'EUR', cycle: 'monthly', cycleCount: 1, renewalOffset: -2, cancelNotes: 'Settings > [your name] > iCloud > Manage Account Storage.' },
	{ name: 'Spotify', category: 'Music', amount: 1099, currency: 'EUR', cycle: 'monthly', cycleCount: 1, renewalOffset: 12, cancelUrl: 'https://www.spotify.com/account/subscription/' },
	{ name: 'Adobe Creative Cloud', category: 'Software', amount: 5999, currency: 'EUR', cycle: 'monthly', cycleCount: 1, renewalOffset: 21, cancelUrl: 'https://account.adobe.com/plans' },
	{ name: 'PlayStation Plus', category: 'Gaming', amount: 6999, currency: 'USD', cycle: 'yearly', cycleCount: 1, renewalOffset: 45, cancelUrl: 'https://www.playstation.com/account/' },
	{ name: 'Amazon Prime', category: 'Shopping', amount: 4990, currency: 'EUR', cycle: 'yearly', cycleCount: 1, renewalOffset: 70, cancelUrl: 'https://www.amazon.com/gp/primecentral' },
	{ name: 'Disney+', category: 'Streaming', amount: 899, currency: 'USD', cycle: 'monthly', cycleCount: 1, renewalOffset: 9, status: 'cancelled', cancelUrl: 'https://www.disneyplus.com/account/subscription' }
];

function seedDemo(database: Database): void {
	const count = database.query('SELECT COUNT(*) AS n FROM subscriptions').get() as { n: number };
	if (count.n > 0) return;
	const timestamp = new Date().toISOString();
	const insert = database.query(
		`INSERT INTO subscriptions
			(name, category, amount, currency, cycle, cycle_count, start_date, next_renewal,
			 status, cancel_url, cancel_notes, notes, created_at, updated_at)
		 VALUES
			($name, $category, $amount, $currency, $cycle, $cycleCount, $startDate, $nextRenewal,
			 $status, $cancelUrl, $cancelNotes, NULL, $createdAt, $updatedAt)`
	);
	for (const s of DEMO_SUBS) {
		insert.run({
			$name: s.name,
			$category: s.category,
			$amount: s.amount,
			$currency: s.currency,
			$cycle: s.cycle,
			$cycleCount: s.cycleCount,
			$startDate: dateOffset(-120),
			$nextRenewal: dateOffset(s.renewalOffset),
			$status: s.status ?? 'active',
			$cancelUrl: s.cancelUrl ?? null,
			$cancelNotes: s.cancelNotes ?? null,
			$createdAt: timestamp,
			$updatedAt: timestamp
		});
	}
}

/** Raw row shape as stored in SQLite (snake_case). */
export interface SubscriptionRow {
	id: number;
	name: string;
	category: string | null;
	amount: number;
	currency: string;
	cycle: string;
	cycle_count: number;
	start_date: string | null;
	next_renewal: string | null;
	status: string;
	cancel_url: string | null;
	cancel_notes: string | null;
	cancelled_at: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export function rowToSubscription(row: SubscriptionRow): Subscription {
	return {
		id: row.id,
		name: row.name,
		category: row.category,
		amount: row.amount,
		currency: row.currency as Subscription['currency'],
		cycle: row.cycle as Subscription['cycle'],
		cycleCount: row.cycle_count,
		startDate: row.start_date,
		nextRenewal: row.next_renewal,
		status: row.status as Subscription['status'],
		cancelUrl: row.cancel_url,
		cancelNotes: row.cancel_notes,
		cancelledAt: row.cancelled_at,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
