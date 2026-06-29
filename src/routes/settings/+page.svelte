<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { computePreview, validateBundle } from '$lib/import-preview';
	import { formatMoney } from '$lib/cost';
	import { DEFAULT_THEME_ID, THEMES, getTheme } from '$lib/themes';
	import { CURRENCIES, type Currency, type ExportBundle } from '$lib/types';
	import {
		AlertTriangle,
		Check,
		Download,
		Pause,
		Palette,
		Upload,
		XCircle
	} from '@lucide/svelte';
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

	// Sync the local selection from server data when it changes — most
	// importantly after `invalidateAll()` following an import, where the
	// theme is applied by the layout's $effect but the radio card would
	// otherwise still be pointing at the previous selection. For the
	// user-clicks-a-card case, selectedTheme was just updated by
	// bind:group to match the server, so the equality check makes this a
	// no-op and we don't fight the user's input.
	$effect(() => {
		const serverTheme = getTheme(data.settings.theme).id;
		if (selectedTheme !== serverTheme) {
			selectedTheme = serverTheme;
		}
	});

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

	// Same sync pattern as the theme: after import (or any other data
	// refresh), mirror the server values into the local form state. Safe
	// for the debounced-save case because the save only completes after
	// the user stops editing, by which point the local values already
	// match the server ones.
	$effect(() => {
		if (displayCurrency !== data.settings.displayCurrency) {
			displayCurrency = data.settings.displayCurrency;
		}
	});
	$effect(() => {
		if (fxEurToUsd !== data.settings.fxEurToUsd) {
			fxEurToUsd = data.settings.fxEurToUsd;
		}
	});

	function onSettingsChange(): void {
		if (currencySaveTimer !== null) clearTimeout(currencySaveTimer);
		currencySaveTimer = setTimeout(() => {
			settingsForm?.requestSubmit();
		}, 500);
	}

	// --- Import preview state ---
	// Import is a two-step flow: pick file → client-side parse → preview
	// dialog with the diff → user confirms or cancels. The actual import
	// runs through the existing ?/import form action — we just gate it
	// behind the dialog so the user can see what they're about to lose.
	let importForm: HTMLFormElement | undefined = $state();
	let importDialogOpen = $state(false);
	let pendingBundle = $state<ExportBundle | null>(null);
	const importPreview = $derived(
		pendingBundle
			? computePreview(pendingBundle, data.settings, data.currentSubscriptionCount)
			: null
	);

	async function onImportFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			toast.error('That file is not valid JSON.');
			input.value = '';
			return;
		}

		const result = validateBundle(parsed);
		if (!result.valid) {
			toast.error(result.error ?? 'Not a valid Solvo backup.');
			input.value = '';
			return;
		}

		pendingBundle = parsed as ExportBundle;
		importDialogOpen = true;
	}

	function acceptImport() {
		// Hand off to the existing form action. The use:enhance handler below
		// takes care of the toast + invalidation; `update({ reset: true })`
		// inside it clears the file input.
		importDialogOpen = false;
		importForm?.requestSubmit();
	}

	function cancelImport() {
		pendingBundle = null;
		importDialogOpen = false;
		// Clear the file input so the user can pick a different file or
		// close without leaving a stale selection behind.
		importForm?.reset();
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
				<Button href="/api/export" download={''}>
					<Download class="size-4" />
					Export JSON
				</Button>
			</div>

			<form
				bind:this={importForm}
				method="POST"
				action="?/import"
				enctype="multipart/form-data"
				class="flex items-end justify-between gap-4"
				use:enhance={() => {
					return async ({ result, update }) => {
						// reset: true so the file input is cleared after a
						// successful (or failed) import — the user shouldn't
						// see the same file still selected.
						await update({ reset: true });
						if (result.type === 'success') {
							toast.success(`Imported ${result.data?.imported ?? 0} subscriptions`);
							await invalidateAll();
							pendingBundle = null;
						} else if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Import failed'));
						}
					};
				}}
			>
				<div class="grid gap-2">
					<p class="text-sm font-medium">Import</p>
					<p class="text-sm text-muted-foreground">
						Pick a Solvo backup to preview the changes before importing.
					</p>
					<Input
						id="file"
						name="file"
						type="file"
						accept="application/json,.json"
						required
						onchange={onImportFileChange}
					/>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>

<Dialog.Root
	bind:open={importDialogOpen}
	onOpenChange={(open) => {
		if (!open) cancelImport();
	}}
>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Import backup</Dialog.Title>
			<Dialog.Description>
				Review the changes below. Accepting will replace all your current data.
			</Dialog.Description>
		</Dialog.Header>

		{#if importPreview}
			{@const anySettingsChanged =
				importPreview.settings.displayCurrency.changed ||
				importPreview.settings.fxEurToUsd.changed ||
				importPreview.settings.theme.changed}
			<div class="space-y-5">
				<div
					class="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-3"
					data-testid="import-warning"
				>
					<AlertTriangle class="text-destructive mt-0.5 size-4 shrink-0" />
					<div class="text-sm">
						<p class="font-medium">
							This will replace your {importPreview.currentCount} current
							{importPreview.currentCount === 1 ? 'subscription' : 'subscriptions'}.
						</p>
						<p class="text-muted-foreground mt-0.5">
							Make sure you have a backup if you want to keep them.
						</p>
					</div>
				</div>

				<section>
					<h3 class="mb-2 text-sm font-semibold">Settings</h3>
					{#if !anySettingsChanged}
						<p class="text-muted-foreground text-sm">No changes to settings.</p>
					{:else}
						<dl class="space-y-1 text-sm">
							{#if importPreview.settings.displayCurrency.changed}
								<div class="flex items-center justify-between gap-2">
									<dt class="text-muted-foreground">Display currency</dt>
									<dd class="font-mono">
										{importPreview.settings.displayCurrency.from}
										<span class="text-muted-foreground">→</span>
										{importPreview.settings.displayCurrency.to}
									</dd>
								</div>
							{/if}
							{#if importPreview.settings.fxEurToUsd.changed}
								<div class="flex items-center justify-between gap-2">
									<dt class="text-muted-foreground">Exchange rate (1 EUR → USD)</dt>
									<dd class="font-mono">
										{importPreview.settings.fxEurToUsd.from}
										<span class="text-muted-foreground">→</span>
										{importPreview.settings.fxEurToUsd.to}
									</dd>
								</div>
							{/if}
							{#if importPreview.settings.theme.changed}
								<div class="flex items-center justify-between gap-2">
									<dt class="text-muted-foreground">Theme</dt>
									<dd class="font-mono">
										{importPreview.settings.theme.from}
										<span class="text-muted-foreground">→</span>
										{importPreview.settings.theme.to}
									</dd>
								</div>
							{/if}
						</dl>
					{/if}
				</section>

				<section>
					<h3 class="mb-2 text-sm font-semibold">
						Subscriptions
						<span class="text-muted-foreground font-normal">
							({importPreview.subscriptions.total} total)
						</span>
					</h3>
					{#if importPreview.subscriptions.total === 0}
						<p class="text-muted-foreground text-sm">
							This backup contains no subscriptions. Accepting will leave Solvo with no data.
						</p>
					{:else}
						<div class="max-h-72 space-y-3 overflow-y-auto pr-1">
							{#if importPreview.subscriptions.byStatus.active.length > 0}
								<div>
									<h4 class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
										<Check class="size-3" />
										Active ({importPreview.subscriptions.active})
									</h4>
									<ul class="space-y-0.5 text-sm">
										{#each importPreview.subscriptions.byStatus.active as s (s.id)}
											<li class="flex items-baseline justify-between gap-2">
												<span class="truncate">{s.name}</span>
												<span class="text-muted-foreground shrink-0 text-xs">
													{formatMoney(s.amount, s.currency)}/
													{s.cycleCount > 1 ? `${s.cycleCount} ${s.cycle}` : s.cycle}
												</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if importPreview.subscriptions.byStatus.paused.length > 0}
								<div>
									<h4 class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
										<Pause class="size-3" />
										Paused ({importPreview.subscriptions.paused})
									</h4>
									<ul class="space-y-0.5 text-sm">
										{#each importPreview.subscriptions.byStatus.paused as s (s.id)}
											<li class="flex items-baseline justify-between gap-2">
												<span class="truncate">{s.name}</span>
												<span class="text-muted-foreground shrink-0 text-xs">
													{formatMoney(s.amount, s.currency)}/
													{s.cycleCount > 1 ? `${s.cycleCount} ${s.cycle}` : s.cycle}
												</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if importPreview.subscriptions.byStatus.cancelled.length > 0}
								<div>
									<h4 class="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
										<XCircle class="size-3" />
										Cancelled ({importPreview.subscriptions.cancelled})
									</h4>
									<ul class="space-y-0.5 text-sm">
										{#each importPreview.subscriptions.byStatus.cancelled as s (s.id)}
											<li class="flex items-baseline justify-between gap-2">
												<span class="truncate">{s.name}</span>
												<span class="text-muted-foreground shrink-0 text-xs">
													{#if s.cancelledAt}
														cancelled {new Date(s.cancelledAt).toLocaleDateString()}
													{/if}
												</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</section>

				{#if importPreview.warnings.length > 0}
					<section class="space-y-1.5">
						{#each importPreview.warnings as w (w)}
							<div
								class="text-foreground flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 p-2.5 text-sm dark:bg-amber-950/20"
							>
								<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
								<span>{w}</span>
							</div>
						{/each}
					</section>
				{/if}
			</div>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button variant="outline" onclick={cancelImport}>Cancel</Button>
			<Button onclick={acceptImport} disabled={!pendingBundle}>
				<Upload class="size-4" />
				Accept Import
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
