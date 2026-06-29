<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { CURRENCIES } from '$lib/types';
	import { Download, Upload } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectClass =
		'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none';
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
		<p class="text-sm text-muted-foreground">Display currency, exchange rate, and your data.</p>
	</div>

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
				method="POST"
				action="?/save"
				class="space-y-4"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') {
							toast.success('Settings saved');
							await invalidateAll();
						} else if (result.type === 'failure') {
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
							class={selectClass}
							value={data.settings.displayCurrency}
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
							value={data.settings.fxEurToUsd}
						/>
					</div>
				</div>
				<Button type="submit">Save settings</Button>
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
