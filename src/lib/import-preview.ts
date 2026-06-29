import { DEFAULT_THEME_ID, isKnownTheme, type ThemeId } from './themes';
import type { Currency, ExportBundle, Settings, Subscription } from './types';

/** Minimal structural check on a value before we trust it as a backup file. */
export function validateBundle(
	bundle: unknown
): { valid: boolean; error?: string } {
	if (!bundle || typeof bundle !== 'object') {
		return { valid: false, error: 'That file is not a Solvo backup.' };
	}
	const b = bundle as Record<string, unknown>;
	if (b.version !== 1) {
		return {
			valid: false,
			error: `Unsupported backup version: ${String(b.version)}.`
		};
	}
	if (!Array.isArray(b.subscriptions)) {
		return { valid: false, error: 'Missing subscriptions array.' };
	}
	if (!b.settings || typeof b.settings !== 'object') {
		return { valid: false, error: 'Missing settings.' };
	}
	return { valid: true };
}

export interface FieldDiff<T> {
	from: T;
	to: T;
	changed: boolean;
}

export interface ImportPreview {
	settings: {
		displayCurrency: FieldDiff<Currency>;
		fxEurToUsd: FieldDiff<number>;
		theme: FieldDiff<ThemeId>;
	};
	subscriptions: {
		total: number;
		active: number;
		paused: number;
		cancelled: number;
		/** Grouped by status for the dialog rendering. */
		byStatus: {
			active: Subscription[];
			paused: Subscription[];
			cancelled: Subscription[];
		};
	};
	warnings: string[];
	/** How many subscriptions the user currently has — drives the "this will
	 *  replace your N" warning in the dialog. */
	currentCount: number;
}

/**
 * Compute a preview of an import: the settings diff, the subscription
 * breakdown by status, and any warnings (e.g. an unknown theme in the
 * backup that will fall back to the default).
 */
export function computePreview(
	bundle: ExportBundle,
	currentSettings: Settings,
	currentCount: number
): ImportPreview {
	const warnings: string[] = [];

	const incomingTheme = bundle.settings.theme;
	if (incomingTheme && !isKnownTheme(incomingTheme)) {
		warnings.push(
			`Theme "${incomingTheme}" is not recognised — it will be reset to the default.`
		);
	}
	const resolvedTheme: ThemeId = isKnownTheme(incomingTheme)
		? incomingTheme
		: DEFAULT_THEME_ID;

	const subs = bundle.subscriptions;
	const active: Subscription[] = [];
	const paused: Subscription[] = [];
	const cancelled: Subscription[] = [];
	for (const s of subs) {
		if (s.status === 'active') active.push(s);
		else if (s.status === 'paused') paused.push(s);
		else if (s.status === 'cancelled') cancelled.push(s);
	}

	return {
		settings: {
			displayCurrency: {
				from: currentSettings.displayCurrency,
				to: bundle.settings.displayCurrency,
				changed: bundle.settings.displayCurrency !== currentSettings.displayCurrency
			},
			fxEurToUsd: {
				from: currentSettings.fxEurToUsd,
				to: bundle.settings.fxEurToUsd,
				changed: bundle.settings.fxEurToUsd !== currentSettings.fxEurToUsd
			},
			theme: {
				from: currentSettings.theme,
				to: resolvedTheme,
				changed: resolvedTheme !== currentSettings.theme
			}
		},
		subscriptions: {
			total: subs.length,
			active: active.length,
			paused: paused.length,
			cancelled: cancelled.length,
			byStatus: { active, paused, cancelled }
		},
		warnings,
		currentCount
	};
}
