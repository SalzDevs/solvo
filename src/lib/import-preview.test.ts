import { describe, expect, it } from 'bun:test';
import { computePreview, validateBundle } from './import-preview';
import { DEFAULT_THEME_ID } from './themes';
import type { ExportBundle, Settings, Subscription } from './types';

function sub(overrides: Partial<Subscription> = {}): Subscription {
	return {
		id: 1,
		name: 'Test',
		category: 'Misc',
		amount: 1000,
		currency: 'EUR',
		cycle: 'monthly',
		cycleCount: 1,
		startDate: null,
		nextRenewal: null,
		status: 'active',
		cancelUrl: null,
		cancelNotes: null,
		cancelledAt: null,
		notes: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

const SETTINGS: Settings = {
	displayCurrency: 'EUR',
	fxEurToUsd: 1.08,
	theme: 'default'
};

function bundle(overrides: Partial<ExportBundle> = {}): ExportBundle {
	return {
		version: 1,
		exportedAt: '2026-06-29T12:00:00.000Z',
		settings: { ...SETTINGS },
		subscriptions: [],
		...overrides
	};
}

describe('validateBundle', () => {
	it('rejects null and primitives', () => {
		expect(validateBundle(null).valid).toBe(false);
		expect(validateBundle('hello').valid).toBe(false);
		expect(validateBundle(42).valid).toBe(false);
		expect(validateBundle([]).valid).toBe(false);
	});

	it('rejects an unsupported version', () => {
		const result = validateBundle({ version: 2, subscriptions: [], settings: {} });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('version');
	});

	it('rejects a bundle without subscriptions', () => {
		const result = validateBundle({ version: 1, settings: {} });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('subscriptions');
	});

	it('rejects a bundle without settings', () => {
		const result = validateBundle({ version: 1, subscriptions: [] });
		expect(result.valid).toBe(false);
		expect(result.error).toContain('settings');
	});

	it('accepts a structurally valid bundle', () => {
		const result = validateBundle(bundle());
		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});
});

describe('computePreview — settings diff', () => {
	it('marks all fields unchanged when bundle matches current', () => {
		const p = computePreview(bundle(), SETTINGS, 5);
		expect(p.settings.displayCurrency.changed).toBe(false);
		expect(p.settings.fxEurToUsd.changed).toBe(false);
		expect(p.settings.theme.changed).toBe(false);
	});

	it('detects every changed settings field with from/to values', () => {
		const p = computePreview(
			bundle({ settings: { displayCurrency: 'USD', fxEurToUsd: 1.1, theme: 'ocean' } }),
			SETTINGS,
			0
		);
		expect(p.settings.displayCurrency).toEqual({
			from: 'EUR',
			to: 'USD',
			changed: true
		});
		expect(p.settings.fxEurToUsd).toEqual({
			from: 1.08,
			to: 1.1,
			changed: true
		});
		expect(p.settings.theme).toEqual({
			from: 'default',
			to: 'ocean',
			changed: true
		});
	});

	it('falls back to the default theme and warns on an unknown theme id', () => {
		// Use a non-default current theme so the fallback is actually a change.
		const current = { ...SETTINGS, theme: 'ocean' as const };
		const p = computePreview(
			bundle({ settings: { ...SETTINGS, theme: 'unicorn' } }),
			current,
			0
		);
		expect(p.settings.theme.from).toBe('ocean');
		expect(p.settings.theme.to).toBe(DEFAULT_THEME_ID);
		expect(p.settings.theme.changed).toBe(true);
		expect(p.warnings).toHaveLength(1);
		expect(p.warnings[0]).toContain('unicorn');
	});

	it('does not warn when the incoming theme is the same as the current one', () => {
		const p = computePreview(
			bundle({ settings: { ...SETTINGS, theme: 'ocean' } }),
			{ ...SETTINGS, theme: 'ocean' },
			0
		);
		expect(p.settings.theme.changed).toBe(false);
		expect(p.warnings).toEqual([]);
	});
});

describe('computePreview — subscription breakdown', () => {
	it('counts and groups subscriptions by status', () => {
		const p = computePreview(
			bundle({
				subscriptions: [
					sub({ id: 1, status: 'active' }),
					sub({ id: 2, status: 'active' }),
					sub({ id: 3, status: 'paused' }),
					sub({ id: 4, status: 'cancelled' }),
					sub({ id: 5, status: 'cancelled' })
				]
			}),
			SETTINGS,
			0
		);
		expect(p.subscriptions.total).toBe(5);
		expect(p.subscriptions.active).toBe(2);
		expect(p.subscriptions.paused).toBe(1);
		expect(p.subscriptions.cancelled).toBe(2);
		expect(p.subscriptions.byStatus.active).toHaveLength(2);
		expect(p.subscriptions.byStatus.paused).toHaveLength(1);
		expect(p.subscriptions.byStatus.cancelled).toHaveLength(2);
	});

	it('passes the current count through unchanged', () => {
		const p = computePreview(bundle(), SETTINGS, 42);
		expect(p.currentCount).toBe(42);
	});
});
