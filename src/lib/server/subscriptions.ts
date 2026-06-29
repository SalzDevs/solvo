import { rollForward, today } from '$lib/renewals';
import { DEFAULT_THEME_ID, isKnownTheme } from '$lib/themes';
import type { BillingCycle, Settings, Subscription, SubscriptionInput } from '$lib/types';
import { getDb, rowToSubscription, type SubscriptionRow } from './db';

function now(): string {
	return new Date().toISOString();
}

/**
 * Roll any active subscription whose next renewal has passed forward to its next
 * future occurrence, so the "next charge" stays accurate over time. Idempotent.
 */
export function syncRenewals(): void {
	const db = getDb();
	const rows = db
		.query(
			`SELECT id, next_renewal, cycle, cycle_count FROM subscriptions
			 WHERE status = 'active' AND next_renewal IS NOT NULL AND next_renewal < $today`
		)
		.all({ $today: today() }) as {
		id: number;
		next_renewal: string;
		cycle: string;
		cycle_count: number;
	}[];
	if (rows.length === 0) return;
	const update = db.query('UPDATE subscriptions SET next_renewal = $next WHERE id = $id');
	const tx = db.transaction(() => {
		for (const r of rows) {
			const next = rollForward(r.next_renewal, r.cycle as BillingCycle, r.cycle_count, today());
			update.run({ $id: r.id, $next: next });
		}
	});
	tx();
}

export function listSubscriptions(): Subscription[] {
	const rows = getDb()
		.query('SELECT * FROM subscriptions ORDER BY status = \'active\' DESC, name COLLATE NOCASE ASC')
		.all() as SubscriptionRow[];
	return rows.map(rowToSubscription);
}

export function getSubscription(id: number): Subscription | null {
	const row = getDb()
		.query('SELECT * FROM subscriptions WHERE id = $id')
		.get({ $id: id }) as SubscriptionRow | null;
	return row ? rowToSubscription(row) : null;
}

export function createSubscription(input: SubscriptionInput): Subscription {
	const timestamp = now();
	const result = getDb()
		.query(
			`INSERT INTO subscriptions
				(name, category, amount, currency, cycle, cycle_count, start_date,
				 next_renewal, status, cancel_url, cancel_notes, notes, created_at, updated_at)
			 VALUES
				($name, $category, $amount, $currency, $cycle, $cycleCount, $startDate,
				 $nextRenewal, $status, $cancelUrl, $cancelNotes, $notes, $createdAt, $updatedAt)
			 RETURNING *`
		)
		.get({
			$name: input.name,
			$category: input.category,
			$amount: input.amount,
			$currency: input.currency,
			$cycle: input.cycle,
			$cycleCount: input.cycleCount,
			$startDate: input.startDate,
			$nextRenewal: input.nextRenewal,
			$status: input.status,
			$cancelUrl: input.cancelUrl,
			$cancelNotes: input.cancelNotes,
			$notes: input.notes,
			$createdAt: timestamp,
			$updatedAt: timestamp
		}) as SubscriptionRow;
	return rowToSubscription(result);
}

export function updateSubscription(id: number, input: SubscriptionInput): Subscription | null {
	const row = getDb()
		.query(
			`UPDATE subscriptions SET
				name = $name, category = $category, amount = $amount, currency = $currency,
				cycle = $cycle, cycle_count = $cycleCount, start_date = $startDate,
				next_renewal = $nextRenewal, status = $status, cancel_url = $cancelUrl,
				cancel_notes = $cancelNotes, notes = $notes, updated_at = $updatedAt
			 WHERE id = $id
			 RETURNING *`
		)
		.get({
			$id: id,
			$name: input.name,
			$category: input.category,
			$amount: input.amount,
			$currency: input.currency,
			$cycle: input.cycle,
			$cycleCount: input.cycleCount,
			$startDate: input.startDate,
			$nextRenewal: input.nextRenewal,
			$status: input.status,
			$cancelUrl: input.cancelUrl,
			$cancelNotes: input.cancelNotes,
			$notes: input.notes,
			$updatedAt: now()
		}) as SubscriptionRow | null;
	return row ? rowToSubscription(row) : null;
}

export function deleteSubscription(id: number): void {
	getDb().query('DELETE FROM subscriptions WHERE id = $id').run({ $id: id });
}

/** Mark a subscription as cancelled; it immediately drops out of cost totals. */
export function cancelSubscription(id: number): Subscription | null {
	const timestamp = now();
	const row = getDb()
		.query(
			`UPDATE subscriptions
			 SET status = 'cancelled', cancelled_at = $cancelledAt, updated_at = $updatedAt
			 WHERE id = $id
			 RETURNING *`
		)
		.get({ $id: id, $cancelledAt: timestamp, $updatedAt: timestamp }) as SubscriptionRow | null;
	return row ? rowToSubscription(row) : null;
}

/** Re-activate a previously cancelled/paused subscription. */
export function reactivateSubscription(id: number): Subscription | null {
	const row = getDb()
		.query(
			`UPDATE subscriptions
			 SET status = 'active', cancelled_at = NULL, updated_at = $updatedAt
			 WHERE id = $id
			 RETURNING *`
		)
		.get({ $id: id, $updatedAt: now() }) as SubscriptionRow | null;
	return row ? rowToSubscription(row) : null;
}

export function getSettings(): Settings {
	const rows = getDb().query('SELECT key, value FROM settings').all() as {
		key: string;
		value: string;
	}[];
	const map = new Map(rows.map((r) => [r.key, r.value]));
	const theme = map.get('theme') ?? DEFAULT_THEME_ID;
	return {
		displayCurrency: (map.get('displayCurrency') as Settings['displayCurrency']) ?? 'EUR',
		fxEurToUsd: Number(map.get('fxEurToUsd') ?? '1.08'),
		theme: isKnownTheme(theme) ? theme : DEFAULT_THEME_ID
	};
}

export function updateSettings(settings: Settings): Settings {
	const upsert = getDb().query(
		`INSERT INTO settings (key, value) VALUES ($key, $value)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	);
	upsert.run({ $key: 'displayCurrency', $value: settings.displayCurrency });
	upsert.run({ $key: 'fxEurToUsd', $value: String(settings.fxEurToUsd) });
	upsert.run({ $key: 'theme', $value: settings.theme });
	return getSettings();
}

export interface ExportBundle {
	version: 1;
	exportedAt: string;
	settings: Settings;
	subscriptions: Subscription[];
}

export function exportData(): ExportBundle {
	return {
		version: 1,
		exportedAt: now(),
		settings: getSettings(),
		subscriptions: listSubscriptions()
	};
}

/** Replace all data with the contents of an export bundle. */
export function importData(bundle: ExportBundle): void {
	const db = getDb();
	const tx = db.transaction((b: ExportBundle) => {
		db.exec('DELETE FROM subscriptions');
		for (const s of b.subscriptions) {
			createSubscription({
				name: s.name,
				category: s.category,
				amount: s.amount,
				currency: s.currency,
				cycle: s.cycle,
				cycleCount: s.cycleCount,
				startDate: s.startDate,
				nextRenewal: s.nextRenewal,
				status: s.status,
				cancelUrl: s.cancelUrl,
				cancelNotes: s.cancelNotes,
				notes: s.notes
			});
		}
		if (b.settings) updateSettings(b.settings);
	});
	tx(bundle);
}
