<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import BarChart from '$lib/components/charts/bar-chart.svelte';
	import DonutChart from '$lib/components/charts/donut-chart.svelte';
	import { bySubscription, formatMoney } from '$lib/cost';
	import { renewalStatus, type RenewalTone } from '$lib/renewals';
	import { getActiveTrialReminders, type TrialTone } from '$lib/trials';
	import {
		ArrowLeft,
		CalendarClock,
		CircleDollarSign,
		ClockAlert,
		Plus,
		TrendingDown
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const trialReminders = $derived(getActiveTrialReminders(data.subscriptions ?? []));

	const cur = $derived(data.settings.displayCurrency);

	const headline = $derived([
		{ label: 'Per day', value: data.totals.perDay },
		{ label: 'Per month', value: data.totals.perMonth },
		{ label: 'Per year', value: data.totals.perYear }
	]);

	function money(minor: number): string {
		return formatMoney(Math.round(minor), cur);
	}

	const maxMonth = $derived(Math.max(0, ...data.projection.map((b) => b.total)));

	const projectionData = $derived(
		data.projection.map((b) => ({
			key: b.key,
			label: b.label,
			value: b.total,
			emphasis: b.total === maxMonth && maxMonth > 0
		}))
	);

	const categoryData = $derived(
		data.categories.map((c) => ({ key: c.category, label: c.category, value: c.perMonth }))
	);

	let selectedCategory = $state<string | null>(null);

	const drilldownData = $derived(
		selectedCategory
			? bySubscription(
					data.subscriptions ?? [],
					selectedCategory,
					data.settings.displayCurrency,
					data.settings.fxEurToUsd
				).map((s) => ({ key: s.key, label: s.name, value: s.perMonth }))
			: null
	);

	const chartData = $derived(drilldownData ?? categoryData);
	const chartTitle = $derived(
		selectedCategory ? `Spend in ${selectedCategory}` : 'Spend by category'
	);
	const chartCenterLabel = $derived(selectedCategory ?? 'per month');
	const chartDescription = $derived(
		selectedCategory
			? `Individual subscriptions in ${selectedCategory}, monthly`
			: 'Monthly, active subscriptions only'
	);

	function onCategorySelect(key: string) {
		// An empty key means the user clicked the already-selected slice — drill back out.
		selectedCategory = key === '' ? null : key;
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

	const trialToneClass: Record<TrialTone, string> = {
		overdue: 'text-destructive',
		today: 'text-destructive',
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

		{#if trialReminders.length > 0}
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<ClockAlert class="size-4" />
						Active trials
					</Card.Title>
					<Card.Description>
						Free trials on your subscriptions. They'll convert to a paid charge on the
						end date unless you cancel them first.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<ul class="space-y-2">
						{#each trialReminders as r (r.subscription.id)}
							{@const willCost = formatMoney(r.subscription.amount, r.subscription.currency)}
							<li
								class="hover:bg-muted/30 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium">{r.subscription.name}</p>
									<p class="text-muted-foreground text-xs">
										{willCost}/{r.subscription.cycleCount > 1
											? `${r.subscription.cycleCount} ${r.subscription.cycle}`
											: r.subscription.cycle}
										once the trial converts
									</p>
								</div>
								<span
									class="shrink-0 text-sm font-medium {trialToneClass[r.tone]}"
									data-testid="trial-reminder-label"
								>
									{r.label}
								</span>
								<Button href="/subscriptions" variant="ghost" size="sm">
									Manage
								</Button>
							</li>
						{/each}
					</ul>
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root>
			<Card.Header>
				<Card.Title>Projected spending</Card.Title>
				<Card.Description>
					Estimated charges over the next 12 months, in {cur} — annual subscriptions show up as
					spikes on their renewal month.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<BarChart data={projectionData} formatValue={money} />
			</Card.Content>
		</Card.Root>

		<div class="grid gap-6 md:grid-cols-2">
			<Card.Root>
				<Card.Header>
					<div>
						<Card.Title>{chartTitle}</Card.Title>
						<Card.Description>{chartDescription}</Card.Description>
					</div>
					{#if selectedCategory}
						<Card.Action>
							<Button variant="ghost" size="sm" onclick={() => (selectedCategory = null)}>
								<ArrowLeft class="size-4" />
								All categories
							</Button>
						</Card.Action>
					{/if}
				</Card.Header>
				<Card.Content>
					<DonutChart
						data={chartData}
						formatValue={money}
						centerLabel={chartCenterLabel}
						onSelect={selectedCategory ? undefined : onCategorySelect}
					/>
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
