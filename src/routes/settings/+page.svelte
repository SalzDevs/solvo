<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DEFAULT_THEME_ID, THEMES, getTheme } from '$lib/themes';
	import { CURRENCIES, type Currency } from '$lib/types';
	import { Check, Download, Palette, Upload } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// --- Theme picker state ---
	// Tracks the user's current selection. Initialised from the server's
	// theme, then driven by `bind:group` on the radio inputs. Using local
	// state (rather than reading from data.settings.theme) means the card
	// stays visually "selected" immediately on click, without waiting for
	// the save round-trip.
	// `untrack` tells the compiler the read is intentional, not a missed
	// derived dependency.
	let selectedTheme = $state<string>(untrack(() => getTheme(data.settings.theme).id));
	let themeForm: HTMLFormElement | undefined = $state();
	let themeSaveTimer: ReturnType<typeof setTimeout> | null = null;

	function applyTheme(themeId: string): void {
		if (themeId === DEFAULT_THEME_ID) {
			document.documentElement.removeAttribute('data-theme');
		} else {
			document.documentElement.setAttribute('data-theme', themeId);
		}
	}

	// Apply the theme instantly and debounce a save. The bind:group on the
	// radio has already updated `selectedTheme` by the time this fires.
	function onThemeChange(): void {
		applyTheme(selectedTheme);
		if (themeSaveTimer !== null) clearTimeout(themeSaveTimer);
		themeSaveTimer = setTimeout(() => {
			themeForm?.requestSubmit();
		}, 300);
	}

	// --- Currency form state ---
	// Mirrors the theme pattern: local state bound to the form fields, with
	// a debounced submit. The longer 500ms debounce is so incremental edits
	// to the exchange rate ("1." → "1.0" → "1.08") collapse into a single
	// save instead of firing one per keystroke.
	let displayCurrency = $state<Currency>(untrack(() => data.settings.displayCurrency));
	let fxEurToUsd = $state<number>(untrack(() => data.settings.fxEurToUsd));
	let settingsForm: HTMLFormElement | undefined = $state();
	let currencySaveTimer: ReturnType<typeof setTimeout> | null = null;

	function onSettingsChange(): void {
		if (currencySaveTimer !== null) clearTimeout(currencySaveTimer);
		currencySaveTimer = setTimeout(() => {
			settingsForm?.requestSubmit();
		}, 500);
	}

	const selectClass =
		'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none';
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
		<p class="text-sm text-muted-foreground">
			Customize how Solvo looks, how totals are calculated, and manage your data.
		</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Palette class="size-4" />
				Appearance
			</Card.Title>
			<Card.Description>
				Pick a theme. The default is the classic Solvo look; the others change the palette
				across the whole app.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				bind:this={themeForm}
				method="POST"
				action="?/saveTheme"
				class="space-y-4"
				use:enhance={() => {
					return async ({ result, update }) => {
						// update() invalidates all data by default, so the
						// layout's $effect picks up the new theme and the
						// server's data stays in sync.
						await update({ reset: false });
						if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Could not save theme'));
						}
					};
				}}
			>
				<fieldset class="grid gap-3 sm:grid-cols-2">
					<legend class="sr-only">Theme</legend>
					{#each THEMES as t (t.id)}
						<label
							class="has-[:checked]:border-primary has-[:checked]:ring-primary/40 hover:bg-muted/30 flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition-colors has-[:checked]:ring-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60"
						>
							<input
								type="radio"
								name="theme"
								bind:group={selectedTheme}
								value={t.id}
								onchange={onThemeChange}
								class="sr-only"
							/>
							<div class="flex items-start justify-between gap-2">
								<div>
									<p class="text-sm font-medium">{t.label}</p>
									<p class="text-xs text-muted-foreground">{t.description}</p>
								</div>
								{#if t.id === selectedTheme}
									<Check class="text-primary size-4 shrink-0" aria-label="Selected" />
								{/if}
							</div>
							<div class="flex gap-1.5" aria-hidden="true">
								<span
									class="border-border/40 size-6 rounded-md border"
									style="background: {t.preview.background}"
									title="Background"
								></span>
								<span
									class="border-border/40 size-6 rounded-md border"
									style="background: {t.preview.foreground}"
									title="Foreground"
								></span>
								<span
									class="size-6 rounded-md"
									style="background: {t.preview.primary}"
									title="Primary"
								></span>
								<span
									class="border-border/40 size-6 rounded-md border"
									style="background: {t.preview.accent}"
									title="Accent"
								></span>
							</div>
						</label>
					{/each}
				</fieldset>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Currency</Card.Title>
			<Card.Description>
				Totals are shown in your display currency. EUR/USD amounts are converted using the rate
				below — kept editable so the app works fully offline.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				bind:this={settingsForm}
				method="POST"
				action="?/save"
				class="space-y-4"
				use:enhance={() => {
					return async ({ result, update }) => {
						// update() invalidates all data by default, so the
						// dashboard picks up the new currency on next visit.
						await update({ reset: false });
						if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Could not save settings'));
						}
					};
				}}
			>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-2">
						<Label for="displayCurrency">Display currency</Label>
						<select
							id="displayCurrency"
							name="displayCurrency"
							bind:value={displayCurrency}
							onchange={onSettingsChange}
							class={selectClass}
						>
							{#each CURRENCIES as c (c)}
								<option value={c}>{c}</option>
							{/each}
						</select>
					</div>
					<div class="grid gap-2">
						<Label for="fxEurToUsd">Exchange rate (1 EUR = ? USD)</Label>
						<Input
							id="fxEurToUsd"
							name="fxEurToUsd"
							type="number"
							min="0"
							step="0.0001"
							bind:value={fxEurToUsd}
							oninput={onSettingsChange}
						/>
					</div>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Your data</Card.Title>
			<Card.Description>
				Everything lives in a local SQLite file on your machine. Export a backup or restore one.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-sm font-medium">Export</p>
					<p class="text-sm text-muted-foreground">Download all subscriptions and settings as JSON.</p>
				</div>
				<Button href="/api/export" download>
					<Download class="size-4" />
					Export JSON
				</Button>
			</div>

			<form
				method="POST"
				action="?/import"
				enctype="multipart/form-data"
				class="flex items-end justify-between gap-4"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update({ reset: true });
						if (result.type === 'success') {
							toast.success(`Imported ${result.data?.imported ?? 0} subscriptions`);
							await invalidateAll();
						} else if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Import failed'));
						}
					};
				}}
			>
				<div class="grid gap-2">
					<p class="text-sm font-medium">Import</p>
					<p class="text-sm text-muted-foreground">
						Restoring a backup replaces all current data.
					</p>
					<Input id="file" name="file" type="file" accept="application/json,.json" required />
				</div>
				<Button type="submit" variant="outline">
					<Upload class="size-4" />
					Import
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
