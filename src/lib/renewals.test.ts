import { describe, expect, it } from 'bun:test';
import { addCycle, daysUntil, renewalStatus, rollForward } from './renewals';

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
});
