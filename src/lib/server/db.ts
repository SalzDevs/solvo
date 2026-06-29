import { Database } from 'bun:sqlite';
import type { Settings, Subscription } from '$lib/types';

/**
 * Local SQLite database. The file lives on the user's machine (default
 * `solvo.db` in the project root) — no cloud, fully private. Override the
 * location with the SOLVO_DB environment variable.
 */
const DB_PATH = process.env.SOLVO_DB ?? 'solvo.db';

let db: Database | null = null;

export function getDb(): Database {
	if (db) return db;
	db = new Database(DB_PATH, { create: true });
	db.exec('PRAGMA journal_mode = WAL;');
	migrate(db);
	seedSettings(db);
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
