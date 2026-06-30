import { describe, expect, it } from 'bun:test';
import { addCycle, daysUntil, nextRenewalFor, renewalStatus, rollForward } from './renewals';

describe('addCycle', () => {
	it('adds days and weeks', () => {
		expect(addCycle('2026-01-01', 'daily', 5)).toBe('2026-01-06');
		expect(addCycle('2026-01-01', 'weekly', 2)).toBe('2026-01-15');
	});

	it('adds calendar months and years', () => {
		expect(addCycle('2026-01-15', 'monthly', 1)).toBe('2026-02-15');
		expect(addCycle('2026-01-15', 'quarterly', 1)).toBe('2026-04-15');
		expect(addCycle('2026-01-15', 'yearly', 1)).toBe('2027-01-15');
	});

	it('clamps to the last day of a shorter month', () => {
		expect(addCycle('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
		expect(addCycle('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
	});
});

describe('rollForward', () => {
	it('advances a past date to the next future occurrence', () => {
		expect(rollForward('2026-01-10', 'monthly', 1, '2026-03-15')).toBe('2026-04-10');
	});

	it('leaves a future date unchanged', () => {
		expect(rollForward('2026-12-01', 'monthly', 1, '2026-06-01')).toBe('2026-12-01');
	});

	it('returns the date itself when it equals the reference day', () => {
		expect(rollForward('2026-06-01', 'monthly', 1, '2026-06-01')).toBe('2026-06-01');
	});

	it('rolls yearly subscriptions across multiple years', () => {
		expect(rollForward('2020-02-29', 'yearly', 1, '2026-06-01')).toBe('2027-02-28');
	});
});

describe('nextRenewalFor', () => {
	const FROM = '2026-06-29';

	it('advances by one cycle when the start date is today', () => {
		expect(nextRenewalFor('2026-06-29', 'monthly', 1, FROM)).toBe('2026-07-29');
		expect(nextRenewalFor('2026-06-29', 'yearly', 1, FROM)).toBe('2027-06-29');
	});

	it('rolls a past start date forward to the next future cycle', () => {
		// Yearly sub started Jan 2024, two cycles (2025, 2026) are already past.
		expect(nextRenewalFor('2024-01-15', 'yearly', 1, FROM)).toBe('2027-01-15');
	});

	it('respects multi-cycle counts (e.g. every 3 months)', () => {
		// Quarterly-ish: cycle=monthly, count=3 -> every 3 months.
		expect(nextRenewalFor('2026-01-10', 'monthly', 3, FROM)).toBe('2026-07-10');
	});

	it('handles short cycles', () => {
		// Daily sub starting today: first charge is today, next is tomorrow.
		expect(nextRenewalFor('2026-06-29', 'daily', 1, FROM)).toBe('2026-06-30');
		// Weekly sub starting in the past: next charge is the first future cycle.
		expect(nextRenewalFor('2026-06-25', 'weekly', 1, FROM)).toBe('2026-07-02');
	});
});

describe('daysUntil', () => {
	it('counts forward and backward', () => {
		expect(daysUntil('2026-06-10', '2026-06-01')).toBe(9);
		expect(daysUntil('2026-05-25', '2026-06-01')).toBe(-7);
		expect(daysUntil('2026-06-01', '2026-06-01')).toBe(0);
	});
});

describe('renewalStatus', () => {
	it('flags overdue dates', () => {
		expect(renewalStatus('2026-05-30', '2026-06-01').tone).toBe('overdue');
	});

	it('flags due today and soon', () => {
		expect(renewalStatus('2026-06-01', '2026-06-01').tone).toBe('due');
		expect(renewalStatus('2026-06-05', '2026-06-01').tone).toBe('soon');
	});

	it('treats distant dates as later', () => {
		expect(renewalStatus('2026-09-01', '2026-06-01').tone).toBe('later');
	});

	it('singularizes "month" when it rounds to exactly one', () => {
		// 45 days from the reference date rounds to 1 month (45 / 30.44 ≈ 1.48 -> 1).
		expect(renewalStatus('2026-07-16', '2026-06-01').label).toBe('in 1 month');
	});

	it('pluralizes "months" for two or more', () => {
		expect(renewalStatus('2026-12-01', '2026-06-01').label).toBe('in 6 months');
	});
});
