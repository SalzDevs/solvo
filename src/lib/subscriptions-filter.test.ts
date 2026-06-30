import { describe, expect, test } from 'bun:test';
import {
	categoryCounts,
	DEFAULT_FILTERS,
	FILTER_STATUSES,
	filterSubscriptions,
	hasActiveFilters,
	parseCategories,
	parseFilterStatus,
	uniqueCategories
} from './subscriptions-filter';
import type { Subscription } from './types';

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
	return {
		id: 1,
		name: 'Netflix',
		category: 'Streaming',
		amount: 1349,
		currency: 'EUR',
		cycle: 'monthly',
		cycleCount: 1,
		startDate: '2025-01-01',
		nextRenewal: '2025-02-01',
		status: 'active',
		cancelUrl: null,
		cancelNotes: null,
		cancelledAt: null,
		notes: null,
		isTrial: false,
		trialEndsOn: null,
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

describe('filterSubscriptions — query', () => {
	test('empty input returns empty array', () => {
		expect(filterSubscriptions([], DEFAULT_FILTERS)).toEqual([]);
	});

	test('no filters returns all subs', () => {
		const subs = [makeSub(), makeSub({ id: 2, name: 'Spotify' })];
		expect(filterSubscriptions(subs, DEFAULT_FILTERS)).toEqual(subs);
	});

	test('matches name (case-insensitive)', () => {
		const subs = [makeSub({ name: 'Netflix' }), makeSub({ id: 2, name: 'Spotify' })];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, query: 'NET' })).toEqual([subs[0]]);
	});

	test('matches notes', () => {
		const subs = [
			makeSub({ name: 'iCloud', notes: 'family plan' }),
			makeSub({ id: 2, name: 'Spotify' })
		];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, query: 'family' })).toEqual([subs[0]]);
	});

	test('matches category', () => {
		const subs = [
			makeSub({ name: 'Netflix', category: 'Streaming' }),
			makeSub({ id: 2, name: 'Spotify', category: 'Music' })
		];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, query: 'stream' })).toEqual([subs[0]]);
	});

	test('whitespace-only query is treated as empty', () => {
		const subs = [makeSub({ name: 'A' }), makeSub({ id: 2, name: 'B' })];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, query: '   ' })).toEqual(subs);
	});

	test('trims surrounding whitespace from query', () => {
		const subs = [makeSub({ name: 'Netflix' })];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, query: '  net  ' })).toEqual(subs);
	});

	test('no match returns empty', () => {
		const subs = [makeSub({ name: 'Netflix' })];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, query: 'spotify' })).toEqual([]);
	});
});

describe('filterSubscriptions — status', () => {
	const subs: Subscription[] = [
		makeSub({ id: 1, name: 'A', status: 'active' }),
		makeSub({ id: 2, name: 'B', status: 'cancelled' }),
		makeSub({ id: 3, name: 'C', status: 'active', isTrial: true }),
		makeSub({ id: 4, name: 'D', status: 'paused' })
	];

	test('all returns everything including paused and cancelled', () => {
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, status: 'all' })).toEqual(subs);
	});

	test('active excludes cancelled, trial, and paused', () => {
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, status: 'active' })).toEqual([
			subs[0]
		]);
	});

	test('trial shows only active+isTrial', () => {
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, status: 'trial' })).toEqual([
			subs[2]
		]);
	});

	test('cancelled shows only cancelled', () => {
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, status: 'cancelled' })).toEqual([
			subs[1]
		]);
	});
});

describe('filterSubscriptions — categories', () => {
	test('multi-select matches any (OR)', () => {
		const subs = [
			makeSub({ id: 1, name: 'A', category: 'Software' }),
			makeSub({ id: 2, name: 'B', category: 'Streaming' }),
			makeSub({ id: 3, name: 'C', category: 'Music' })
		];
		expect(
			filterSubscriptions(subs, { ...DEFAULT_FILTERS, categories: ['Software', 'Music'] })
		).toEqual([subs[0], subs[2]]);
	});

	test('empty array means no category filter', () => {
		const subs = [
			makeSub({ id: 1, category: 'Software' }),
			makeSub({ id: 2, category: 'Streaming' })
		];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, categories: [] })).toEqual(subs);
	});

	test('subscription without category is excluded when categories are selected', () => {
		const subs = [
			makeSub({ id: 1, name: 'A', category: 'Software' }),
			makeSub({ id: 2, name: 'B', category: null })
		];
		expect(filterSubscriptions(subs, { ...DEFAULT_FILTERS, categories: ['Software'] })).toEqual([
			subs[0]
		]);
	});

	test('non-existent category filters everything out', () => {
		const subs = [makeSub({ id: 1, category: 'Software' })];
		expect(
			filterSubscriptions(subs, { ...DEFAULT_FILTERS, categories: ['Nonexistent'] })
		).toEqual([]);
	});
});

describe('filterSubscriptions — combined', () => {
	test('all three filters applied together', () => {
		const subs = [
			makeSub({ id: 1, name: 'Netflix', category: 'Streaming', status: 'active' }),
			makeSub({ id: 2, name: 'Disney+', category: 'Streaming', status: 'cancelled' }),
			makeSub({ id: 3, name: 'Linear', category: 'Software', status: 'active', isTrial: true }),
			makeSub({ id: 4, name: 'Spotify', category: 'Music', status: 'active' })
		];
		const result = filterSubscriptions(subs, {
			query: 'ne',
			status: 'active',
			categories: ['Streaming']
		});
		expect(result).toEqual([subs[0]]);
	});

	test('returns empty when no match across all three', () => {
		const subs = [makeSub({ name: 'Netflix' })];
		expect(
			filterSubscriptions(subs, {
				query: 'spotify',
				status: 'active',
				categories: ['Music']
			})
		).toEqual([]);
	});
});

describe('parseFilterStatus', () => {
	test('returns valid status', () => {
		for (const s of FILTER_STATUSES) {
			expect(parseFilterStatus(s)).toBe(s);
		}
	});

	test('returns all for null/undefined/invalid/empty', () => {
		expect(parseFilterStatus(null)).toBe('all');
		expect(parseFilterStatus(undefined)).toBe('all');
		expect(parseFilterStatus('invalid')).toBe('all');
		expect(parseFilterStatus('')).toBe('all');
	});
});

describe('parseCategories', () => {
	test('parses comma-separated values', () => {
		expect(parseCategories('Software,Streaming,Music')).toEqual([
			'Software',
			'Streaming',
			'Music'
		]);
	});

	test('trims whitespace and dedupes', () => {
		expect(parseCategories(' Software , Streaming , Software ')).toEqual([
			'Software',
			'Streaming'
		]);
	});

	test('filters empty strings', () => {
		expect(parseCategories('Software,,Streaming,')).toEqual(['Software', 'Streaming']);
	});

	test('returns empty array for null/undefined/empty', () => {
		expect(parseCategories(null)).toEqual([]);
		expect(parseCategories(undefined)).toEqual([]);
		expect(parseCategories('')).toEqual([]);
	});
});

describe('hasActiveFilters', () => {
	test('false for defaults', () => {
		expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
	});

	test('true when query is non-empty', () => {
		expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: 'x' })).toBe(true);
	});

	test('true when status is not all', () => {
		expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: 'active' })).toBe(true);
	});

	test('true when categories are selected', () => {
		expect(hasActiveFilters({ ...DEFAULT_FILTERS, categories: ['Software'] })).toBe(true);
	});

	test('whitespace-only query is not active', () => {
		expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: '   ' })).toBe(false);
	});
});

describe('uniqueCategories', () => {
	test('returns sorted unique categories, ignoring nulls', () => {
		const subs = [
			makeSub({ category: 'Streaming' }),
			makeSub({ category: 'Software' }),
			makeSub({ category: 'Streaming' }),
			makeSub({ category: null }),
			makeSub({ category: 'Music' })
		];
		expect(uniqueCategories(subs)).toEqual(['Music', 'Software', 'Streaming']);
	});

	test('returns empty array when no categories', () => {
		expect(uniqueCategories([makeSub({ category: null })])).toEqual([]);
	});
});

describe('categoryCounts', () => {
	test('counts occurrences per category', () => {
		const subs = [
			makeSub({ category: 'Software' }),
			makeSub({ category: 'Software' }),
			makeSub({ category: 'Streaming' }),
			makeSub({ category: null })
		];
		const counts = categoryCounts(subs);
		expect(counts.get('Software')).toBe(2);
		expect(counts.get('Streaming')).toBe(1);
		expect(counts.has(null as unknown as string)).toBe(false);
		expect(counts.size).toBe(2);
	});

	test('empty input returns empty map', () => {
		expect(categoryCounts([]).size).toBe(0);
	});
});
