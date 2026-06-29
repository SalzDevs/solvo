/**
 * Theme registry. Each theme is a complete color story with its own light
 * and dark palettes. The actual CSS variables live in src/routes/layout.css
 * under `:root[data-theme="..."]` and `.dark[data-theme="..."]` selectors;
 * this file is the source of truth for the list of themes, their labels,
 * and the preview swatches shown in the settings page.
 *
 * Adding a new theme:
 *   1. Add an entry to THEMES below (id, label, description, preview swatches).
 *   2. Add `:root[data-theme="<id>"]` and `.dark[data-theme="<id>"]` blocks
 *      to layout.css with the full variable set.
 *   3. The default theme is intentionally rendered without a data-theme
 *      attribute, so it keeps matching the bare `:root` / `.dark` selectors.
 */

export interface ThemePreview {
	/** Background color of the theme, shown as a preview swatch. */
	background: string;
	/** Foreground / text color of the theme, shown as a preview swatch. */
	foreground: string;
	/** Primary / brand color of the theme, shown as a preview swatch. */
	primary: string;
	/** Accent / muted color of the theme, shown as a preview swatch. */
	accent: string;
}

export interface Theme {
	id: string;
	label: string;
	description: string;
	preview: ThemePreview;
}

export const DEFAULT_THEME_ID = 'default';

export const THEMES: readonly Theme[] = [
	{
		id: 'default',
		label: 'Default',
		description: 'Neutral grays with mixed accents. The classic Solvo look.',
		preview: {
			background: 'oklch(1 0 0)',
			foreground: 'oklch(0.141 0.005 285.823)',
			primary: 'oklch(0.21 0.006 285.885)',
			accent: 'oklch(0.967 0.001 286.375)'
		}
	},
	{
		id: 'ocean',
		label: 'Ocean',
		description: 'Cool blues and teals. Calm and focused.',
		preview: {
			background: 'oklch(0.99 0.005 230)',
			foreground: 'oklch(0.2 0.03 250)',
			primary: 'oklch(0.45 0.15 250)',
			accent: 'oklch(0.95 0.02 230)'
		}
	},
	{
		id: 'forest',
		label: 'Forest',
		description: 'Natural greens and sage. Grounded and steady.',
		preview: {
			background: 'oklch(0.99 0.005 150)',
			foreground: 'oklch(0.2 0.03 160)',
			primary: 'oklch(0.45 0.12 155)',
			accent: 'oklch(0.95 0.02 150)'
		}
	},
	{
		id: 'sunset',
		label: 'Sunset',
		description: 'Warm corals and amber. Energetic and inviting.',
		preview: {
			background: 'oklch(0.99 0.008 60)',
			foreground: 'oklch(0.25 0.04 30)',
			primary: 'oklch(0.55 0.18 30)',
			accent: 'oklch(0.95 0.04 50)'
		}
	}
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/** Look up a theme by id, falling back to the default theme for unknown ids. */
export function getTheme(id: string | null | undefined): Theme {
	if (!id) return BY_ID.get(DEFAULT_THEME_ID)!;
	return BY_ID.get(id) ?? BY_ID.get(DEFAULT_THEME_ID)!;
}

/** Type guard: is this id a known theme id? */
export function isKnownTheme(id: string): boolean {
	return BY_ID.has(id);
}
