<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { formatMoney } from '$lib/cost';
	import { renewalStatus, type RenewalTone } from '$lib/renewals';
	import { CalendarClock, CircleDollarSign, Plus, TrendingDown } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const cur = $derived(data.settings.displayCurrency);

	const headline = $derived([
		{ label: 'Per day', value: data.totals.perDay },
		{ label: 'Per month', value: data.totals.perMonth },
		{ label: 'Per year', value: data.totals.perYear }
	]);

	function money(minor: number): string {
		return formatMoney(Math.round(minor), cur);
	}

	function maxCategory(): number {
		return Math.max(1, ...data.categories.map((c) => c.perMonth));
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	const toneClass: Record<RenewalTone, string> = {
		overdue: 'text-destructive',
		due: 'text-destructive',
		soon: 'text-amber-600 dark:text-amber-500',
		later: 'text-muted-foreground'
	};
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
			<p class="text-sm text-muted-foreground">
				{data.counts.active} active of {data.counts.total} tracked · shown in {cur}
			</p>
		</div>
		<Button href="/subscriptions">
			<Plus class="size-4" />
			Add subscription
		</Button>
	</div>

	{#if data.counts.total === 0}
		<Card.Root>
			<Card.Content class="flex flex-col items-center gap-3 py-16 text-center">
				<TrendingDown class="size-10 text-muted-foreground" />
				<div>
					<p class="font-medium">No subscriptions yet</p>
					<p class="text-sm text-muted-foreground">
						Add your first subscription to see what it's really costing you.
					</p>
				</div>
				<Button href="/subscriptions">
					<Plus class="size-4" />
					Add subscription
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 sm:grid-cols-3">
			{#each headline as item (item.label)}
				<Card.Root>
					<Card.Header class="pb-2">
						<Card.Description class="flex items-center gap-2">
							<CircleDollarSign class="size-4" />
							{item.label}
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<p class="text-3xl font-semibold tracking-tight">{money(item.value)}</p>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<Card.Title>Spend by category</Card.Title>
					<Card.Description>Monthly, active subscriptions only</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					{#if data.categories.length === 0}
						<p class="text-sm text-muted-foreground">No active subscriptions.</p>
					{:else}
						{#each data.categories as c (c.category)}
							<div class="space-y-1">
								<div class="flex items-center justify-between text-sm">
									<span class="font-medium">{c.category}</span>
									<span class="text-muted-foreground">{money(c.perMonth)}/mo</span>
								</div>
								<div class="h-2 overflow-hidden rounded-full bg-muted">
									<div
										class="h-full rounded-full bg-primary"
										style="width: {(c.perMonth / maxCategory()) * 100}%"
									></div>
								</div>
							</div>
						{/each}
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<CalendarClock class="size-4" />
						Upcoming renewals
					</Card.Title>
					<Card.Description>Next charges to expect</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-2">
					{#if data.upcoming.length === 0}
						<p class="text-sm text-muted-foreground">
							No renewal dates set. Add them when editing a subscription.
						</p>
					{:else}
						{#each data.upcoming as s (s.id)}
							{@const status = renewalStatus(s.nextRenewal!)}
							<div class="flex items-center justify-between rounded-md border px-3 py-2">
								<div>
									<p class="text-sm font-medium">{s.name}</p>
									<p class="text-xs {toneClass[status.tone]}">
										{formatDate(s.nextRenewal!)} · {status.label}
									</p>
								</div>
								<Badge variant="secondary">{formatMoney(s.amount, s.currency)}</Badge>
							</div>
						{/each}
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
