import { describe, expect, it } from 'bun:test';
import { DEFAULT_THEME_ID, THEMES, getTheme, isKnownTheme } from './themes';

describe('THEMES', () => {
	it('has exactly 4 themes (default + 3 alternatives)', () => {
		expect(THEMES).toHaveLength(4);
	});

	it('includes the default theme', () => {
		expect(THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
	});

	it('all theme ids are unique', () => {
		const ids = THEMES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('every theme has a non-empty label, description, and full preview palette', () => {
		for (const t of THEMES) {
			expect(t.label.length).toBeGreaterThan(0);
			expect(t.description.length).toBeGreaterThan(0);
			expect(t.preview.background).toBeTruthy();
			expect(t.preview.foreground).toBeTruthy();
			expect(t.preview.primary).toBeTruthy();
			expect(t.preview.accent).toBeTruthy();
		}
	});
});

describe('getTheme', () => {
	it('returns the theme for a known id', () => {
		expect(getTheme('ocean').label).toBe('Ocean');
		expect(getTheme('forest').label).toBe('Forest');
		expect(getTheme('sunset').label).toBe('Sunset');
	});

	it('falls back to default for unknown ids', () => {
		expect(getTheme('unknown').id).toBe(DEFAULT_THEME_ID);
	});

	it('falls back to default for null, undefined, and empty string', () => {
		expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
		expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
		expect(getTheme('').id).toBe(DEFAULT_THEME_ID);
	});
});

describe('isKnownTheme', () => {
	it('returns true for known ids', () => {
		for (const t of THEMES) {
			expect(isKnownTheme(t.id)).toBe(true);
		}
	});

	it('returns false for unknown ids', () => {
		expect(isKnownTheme('unknown')).toBe(false);
		expect(isKnownTheme('')).toBe(false);
	});
});
