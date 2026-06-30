<script lang="ts">
	// Imported directly (not just inherited from +layout.svelte) because a
	// root-layout load failure means this page renders standalone, without
	// the rest of the app shell — it still needs its own styles either way.
	import './layout.css';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle } from '@lucide/svelte';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? 'Something went wrong.');
</script>

<svelte:head>
	<title>{status} — Solvo</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
	<div class="flex max-w-sm flex-col items-center gap-4 text-center">
		<div class="flex size-12 items-center justify-center rounded-full bg-destructive/10">
			<AlertTriangle class="size-6 text-destructive" />
		</div>
		<div>
			<p class="text-sm font-medium text-muted-foreground">Error {status}</p>
			<h1 class="text-xl font-semibold tracking-tight">{message}</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Your data is untouched — it's just this page that hit a snag.
		</p>
		<div class="flex items-center gap-2">
			<Button href="/">Back to dashboard</Button>
			<Button href="https://github.com/SalzDevs/solvo/issues" variant="outline">
				Report an issue
			</Button>
		</div>
	</div>
</div>
