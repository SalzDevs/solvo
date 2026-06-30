<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatMoney, normalize } from '$lib/cost';
	import { daysUntil, nextRenewalFor, renewalStatus, type RenewalTone } from '$lib/renewals';
	import { findProvider } from '$lib/registry';
	import {
		categoryCounts,
		DEFAULT_FILTERS,
		FILTER_STATUSES,
		filterSubscriptions,
		hasActiveFilters,
		parseCategories,
		parseFilterStatus,
		uniqueCategories,
		type FilterStatus
	} from '$lib/subscriptions-filter';
	import {
		nextSortState,
		sortSubscriptions,
		type SortDirection,
		type SortKey,
		type SortState
	} from '$lib/subscriptions-sort';
	import { BILLING_CYCLES, CURRENCIES, type BillingCycle, type Subscription } from '$lib/types';
	import type { FieldErrors } from './+page.server';
	import {
		ArrowDown,
		ArrowUp,
		ArrowUpDown,
		ExternalLink,
		AlertCircle,
		CheckCircle2,
		Clock,
		ClockAlert,
		Pencil,
		Plus,
		RotateCcw,
		Search,
		Trash2,
		X,
		XCircle
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const cur = $derived(data.settings.displayCurrency);

	type FormState = {
		id: number | null;
		name: string;
		category: string;
		amount: string;
		currency: string;
		cycle: string;
		cycleCount: string;
		startDate: string;
		nextRenewal: string;
		cancelUrl: string;
		cancelNotes: string;
		notes: string;
		status: string;
		/** '1' when the subscription is in a trial, '0' otherwise. Sent as a
		 *  hidden input so an edit doesn't accidentally wipe a trial. */
		isTrial: string;
		trialEndsOn: string;
	};

	function emptyForm(): FormState {
		return {
			id: null,
			name: '',
			category: '',
			amount: '',
			currency: 'EUR',
			cycle: 'monthly',
			cycleCount: '1',
			startDate: '',
			nextRenewal: '',
			cancelUrl: '',
			cancelNotes: '',
			notes: '',
			status: 'active',
			isTrial: '0',
			trialEndsOn: ''
		};
	}

	let dialogOpen = $state(false);
	let form = $state<FormState>(emptyForm());
	let formErrors = $state<FieldErrors>({});
	const isEditing = $derived(form.id !== null);

	/** Clears a single field's error as the user edits it, so the message
	 *  disappears the moment they start fixing it instead of staying stale
	 *  until the next submit. */
	function clearFieldError(field: keyof FieldErrors) {
		if (formErrors[field]) formErrors = { ...formErrors, [field]: undefined };
	}

	// nextRenewal is a derived field — it always reflects the current
	// startDate + cycle + cycleCount, live ("hot reload"). The user can
	// still type a manual override and that value sticks while they're
	// editing, but any change to the upstream inputs re-derives it.
	//
	// We deliberately do NOT read form.nextRenewal inside the effect:
	// reading it would create a write/read cycle and the effect would
	// never settle. Only startDate, cycle, and cycleCount are tracked.
	$effect(() => {
		const start = form.startDate;
		const cycle = form.cycle;
		const count = Number(form.cycleCount) || 1;
		if (!start) {
			form.nextRenewal = '';
			return;
		}
		if (!(BILLING_CYCLES as readonly string[]).includes(cycle)) return;
		form.nextRenewal = nextRenewalFor(start, cycle as BillingCycle, count);
	});

	let deleteOpen = $state(false);
	let pendingDelete = $state<Subscription | null>(null);

	let cancelOpen = $state(false);
	let pendingCancel = $state<Subscription | null>(null);
	let cancelConfirmation = $state('');
	let cancelConfirmationError = $state<string | null>(null);

	let trialDialogOpen = $state(false);
	let pendingTrialSubId = $state('');
	let trialEndsOn = $state('');
	// Set when the dialog is opened from a specific row's "Start trial"
	// button — locks the subscription picker to that one row instead of
	// making the user re-find it in a dropdown they just clicked away from.
	let lockedTrialSub = $state<Subscription | null>(null);

	const cancelPhrase = $derived(
		pendingCancel ? `${pendingCancel.name} canceled` : ''
	);
	const cancelHasInput = $derived(cancelConfirmation.trim().length > 0);
	const cancelConfirmed = $derived(
		cancelPhrase !== '' && cancelConfirmation.trim().toLowerCase() === cancelPhrase.toLowerCase()
	);
	const cancelInputInvalid = $derived(cancelHasInput && !cancelConfirmed);

	const toneClass: Record<RenewalTone, string> = {
		overdue: 'text-destructive',
		due: 'text-destructive',
		soon: 'text-amber-600 dark:text-amber-500',
		later: 'text-muted-foreground'
	};

	function confirmDelete(sub: Subscription) {
		pendingDelete = sub;
		deleteOpen = true;
	}

	const selectClass =
		'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-none';

	function openAdd() {
		form = emptyForm();
		formErrors = {};
		dialogOpen = true;
	}

	function openEdit(sub: Subscription) {
		form = {
			id: sub.id,
			name: sub.name,
			category: sub.category ?? '',
			amount: (sub.amount / 100).toFixed(2),
			currency: sub.currency,
			cycle: sub.cycle,
			cycleCount: String(sub.cycleCount),
			startDate: sub.startDate ?? '',
			nextRenewal: sub.nextRenewal ?? '',
			cancelUrl: sub.cancelUrl ?? '',
			cancelNotes: sub.cancelNotes ?? '',
			notes: sub.notes ?? '',
			status: sub.status,
			isTrial: sub.isTrial ? '1' : '0',
			trialEndsOn: sub.trialEndsOn ?? ''
		};
		formErrors = {};
		dialogOpen = true;
	}

	function onNameBlur() {
		const match = findProvider(form.name);
		if (!match) return;
		if (!form.category) form.category = match.category;
		if (!form.cancelUrl) form.cancelUrl = match.cancelUrl;
		if (!form.cancelNotes && match.notes) form.cancelNotes = match.notes;
	}

	function monthly(sub: Subscription): string {
		const n = normalize(sub, cur, data.settings.fxEurToUsd);
		return formatMoney(Math.round(n.perMonth), cur);
	}

	function cycleLabel(sub: Subscription): string {
		return sub.cycleCount > 1 ? `every ${sub.cycleCount} ${sub.cycle}` : sub.cycle;
	}

	function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
		if (status === 'active') return 'default';
		if (status === 'paused') return 'outline';
		return 'secondary';
	}

	function openCancelPage(sub: Subscription) {
		if (sub.cancelUrl) {
			window.open(sub.cancelUrl, '_blank', 'noopener,noreferrer');
		} else if (sub.cancelNotes) {
			toast.info(`How to cancel ${sub.name}`, { description: sub.cancelNotes, duration: 8000 });
		}
	}

	function confirmCancel(sub: Subscription) {
		pendingCancel = sub;
		cancelConfirmation = '';
		cancelConfirmationError = null;
		cancelOpen = true;
		openCancelPage(sub);
	}

	function onCancelConfirmationInput() {
		cancelConfirmationError = null;
	}

	function defaultTrialEndDate(): string {
		// One week out — a sensible starting point, always overridable.
		const oneWeekOut = new Date();
		oneWeekOut.setDate(oneWeekOut.getDate() + 7);
		return oneWeekOut.toISOString().slice(0, 10);
	}

	function openTrialDialog() {
		// Pre-select the first eligible subscription (active + not already
		// on trial) so the user can submit with a single click if the
		// default date is fine.
		const eligible = data.subscriptions.find(
			(s) => s.status === 'active' && !s.isTrial
		);
		lockedTrialSub = null;
		pendingTrialSubId = eligible ? String(eligible.id) : '';
		trialEndsOn = defaultTrialEndDate();
		trialDialogOpen = true;
	}

	function openTrialDialogFor(sub: Subscription) {
		lockedTrialSub = sub;
		pendingTrialSubId = String(sub.id);
		trialEndsOn = defaultTrialEndDate();
		trialDialogOpen = true;
	}

	function blockInvalidCancelSubmit(event: SubmitEvent) {
		if (cancelConfirmed) return;
		event.preventDefault();
		cancelConfirmationError = cancelHasInput
			? `That doesn't match. Type exactly: ${cancelPhrase}`
			: `Type ${cancelPhrase} to confirm you cancelled with the provider.`;
	}

	// --- Filter state -----------------------------------------------------------
	// Filters live in the URL so they're shareable, survive reload, and the
	// back button works as expected. Initialised from `page.url.searchParams`
	// and synced back via the effect below. The `lastWrittenSearch` non-reactive
	// variable breaks the otherwise-infinite loop between state changes and
	// URL changes (same pattern used in settings for theme/currency sync).
	let query = $state(page.url.searchParams.get('q') ?? '');
	let status = $state<FilterStatus>(parseFilterStatus(page.url.searchParams.get('status')));
	let categories = $state<string[]>(parseCategories(page.url.searchParams.get('cat')));
	let lastWrittenSearch = page.url.search.replace(/^\?/, '');

	$effect(() => {
		const params = new URLSearchParams();
		if (query) params.set('q', query);
		if (status !== 'all') params.set('status', status);
		if (categories.length > 0) params.set('cat', categories.join(','));
		const search = params.toString();
		if (search === lastWrittenSearch) return;
		lastWrittenSearch = search;
		const url = page.url.pathname + (search ? `?${search}` : '');
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	});

	const filters = $derived({ query, status, categories });
	const filtered = $derived(filterSubscriptions(data.subscriptions, filters));
	const filtersActive = $derived(hasActiveFilters(filters));
	const allCategories = $derived(uniqueCategories(data.subscriptions));
	const categoryCount = $derived(categoryCounts(data.subscriptions));

	// --- Sorting ------------------------------------------------------------
	// null = the default order (active first, then alphabetical, as returned
	// by the server). Clicking a header switches to an explicit sort; clicking
	// the same header again flips direction.
	let sort = $state<SortState | null>(null);
	const sorted = $derived(
		sort ? sortSubscriptions(filtered, sort, data.settings.displayCurrency, data.settings.fxEurToUsd) : filtered
	);

	function toggleSort(key: SortKey) {
		sort = nextSortState(sort, key);
	}

	function sortIcon(key: SortKey) {
		if (!sort || sort.key !== key) return ArrowUpDown;
		return sort.direction === 'asc' ? ArrowUp : ArrowDown;
	}

	/** `aria-sort` for the `<th>` itself — separate from the icon so screen
	 *  readers get the standard table-sort announcement, not just sighted users. */
	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (!sort || sort.key !== key) return 'none';
		return sort.direction === 'asc' ? 'ascending' : 'descending';
	}

	// The column headers (and their sort buttons) are hidden on mobile along
	// with the table, so this <select> is the only way to change sort order
	// below the sm breakpoint — without it, mobile is stuck on the default.
	const mobileSortValue = $derived(sort ? `${sort.key}:${sort.direction}` : 'default');
	function onMobileSortChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		if (value === 'default') {
			sort = null;
			return;
		}
		const [key, direction] = value.split(':') as [SortKey, SortDirection];
		sort = { key, direction };
	}

	function clearFilters() {
		query = '';
		status = 'all';
		categories = [];
	}

	function toggleCategory(cat: string) {
		categories = categories.includes(cat) ? categories.filter((c) => c !== cat) : [...categories, cat];
	}

	function statusLabel(s: FilterStatus): string {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Subscriptions</h1>
			<p class="text-sm text-muted-foreground">Track, price, and cancel your recurring spend.</p>
		</div>
		<div class="flex gap-2">
			<Button onclick={openAdd}>
				<Plus class="size-4" />
				Add subscription
			</Button>
			<Button variant="outline" onclick={openTrialDialog}>
				<Clock class="size-4" />
				Start trial
			</Button>
		</div>
	</div>

	{#if data.subscriptions.length > 0}
		<div class="space-y-3" data-testid="subscriptions-filters">
			<div class="relative">
				<Search
					class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="text"
					placeholder="Search by name, category, or notes…"
					class="pl-9"
					bind:value={query}
					data-testid="subscriptions-search"
				/>
				{#if query}
					<button
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
						onclick={() => (query = '')}
						title="Clear search"
						aria-label="Clear search"
					>
						<X class="size-3.5" />
					</button>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<span class="text-xs font-medium text-muted-foreground">Status:</span>
				{#each FILTER_STATUSES as s (s)}
					{@const active = status === s}
					<button
						type="button"
						class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
						class:bg-primary={active}
						class:text-primary-foreground={active}
						class:hover:bg-accent={!active}
						class:hover:text-accent-foreground={!active}
						onclick={() => (status = s)}
						aria-pressed={active}
					>
						{statusLabel(s)}
					</button>
				{/each}
			</div>

			{#if allCategories.length > 0}
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-xs font-medium text-muted-foreground">Category:</span>
					{#each allCategories as cat (cat)}
						{@const active = categories.includes(cat)}
						<button
							type="button"
							class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
							class:bg-primary={active}
							class:text-primary-foreground={active}
							class:hover:bg-accent={!active}
							class:hover:text-accent-foreground={!active}
							onclick={() => toggleCategory(cat)}
							aria-pressed={active}
						>
							{cat}
							<span class="ml-1 opacity-70">({categoryCount.get(cat) ?? 0})</span>
						</button>
					{/each}
				</div>
			{/if}

			{#if filtersActive}
				<div class="flex items-center gap-3 text-sm text-muted-foreground">
					<span>
						Showing <strong class="text-foreground">{filtered.length}</strong> of
						{data.subscriptions.length} subscriptions
					</span>
					<Button variant="ghost" size="sm" onclick={clearFilters}>
						<X class="size-3" />
						Clear filters
					</Button>
				</div>
			{/if}
		</div>
	{/if}

	<Card.Root>
		<Card.Content class="p-0">
			{#if data.subscriptions.length === 0}
				<div class="py-16 text-center text-sm text-muted-foreground">
					Nothing here yet. Add your first subscription to get started.
				</div>
			{:else if filtered.length === 0}
				<div class="space-y-3 py-16 text-center">
					<p class="text-sm text-muted-foreground" data-testid="no-matches">
						No subscriptions match your filters.
					</p>
					<Button variant="outline" size="sm" onclick={clearFilters}>
						<X class="size-3" />
						Clear filters
					</Button>
				</div>
			{:else}
				{#snippet sortHeader(label: string, key: SortKey, align: 'left' | 'right' = 'left')}
					{@const Icon = sortIcon(key)}
					<button
						type="button"
						class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
						class:flex-row-reverse={align === 'right'}
						onclick={() => toggleSort(key)}
						aria-label={`Sort by ${label}`}
					>
						{label}
						<Icon class="size-3.5 {sort?.key === key ? 'text-foreground' : ''}" />
					</button>
				{/snippet}

				{#snippet rowActions(sub: Subscription)}
					<Button variant="ghost" size="icon" title="Edit" onclick={() => openEdit(sub)}>
						<Pencil class="size-4" />
					</Button>

					{#if sub.status === 'active'}
						{#if !sub.isTrial}
							<Button
								variant="ghost"
								size="icon"
								title="Start trial"
								onclick={() => openTrialDialogFor(sub)}
							>
								<Clock class="size-4" />
							</Button>
						{/if}

						{#if sub.isTrial}
							<form
								method="POST"
								action="?/cancelTrial"
								use:enhance={() => {
									return async ({ result, update }) => {
										await update({ reset: false });
										if (result.type === 'success') {
											toast.success(`Cancelled trial for ${sub.name}`);
											await invalidateAll();
										} else if (result.type === 'failure') {
											toast.error(String(result.data?.error ?? 'Could not cancel trial'));
										}
									};
								}}
							>
								<input type="hidden" name="id" value={sub.id} />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									title="Cancel trial"
									class="text-amber-600 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-500"
								>
									<ClockAlert class="size-4" />
								</Button>
							</form>
						{/if}

						<Button
							type="button"
							variant="ghost"
							size="icon"
							title="Cancel subscription"
							class="text-destructive hover:text-destructive"
							onclick={() => confirmCancel(sub)}
						>
							{#if sub.cancelUrl}
								<ExternalLink class="size-4" />
							{:else}
								<XCircle class="size-4" />
							{/if}
						</Button>
					{:else}
						<form
							method="POST"
							action="?/reactivate"
							use:enhance={() => {
								return async ({ result, update }) => {
									await update({ reset: false });
									if (result.type === 'success') {
										toast.success(`Reactivated ${sub.name}`);
										await invalidateAll();
									}
								};
							}}
						>
							<input type="hidden" name="id" value={sub.id} />
							<Button type="submit" variant="ghost" size="icon" title="Reactivate">
								<RotateCcw class="size-4" />
							</Button>
						</form>
					{/if}

					<Button
						variant="ghost"
						size="icon"
						title="Delete"
						class="text-muted-foreground hover:text-destructive"
						onclick={() => confirmDelete(sub)}
					>
						<Trash2 class="size-4" />
					</Button>
				{/snippet}

				{#snippet trialBadge(sub: Subscription)}
					{#if sub.isTrial && sub.trialEndsOn}
						{@const trialDays = daysUntil(sub.trialEndsOn)}
						<Badge
							variant="outline"
							class="mt-0.5 text-xs"
							title="Trial converts to a paid subscription on this date unless cancelled"
						>
							{#if trialDays <= 3}
								<ClockAlert class="mr-1 size-3" />
							{:else}
								<Clock class="mr-1 size-3" />
							{/if}
							{#if trialDays <= 0}
								Trial ends today
							{:else if trialDays === 1}
								Trial ends tomorrow
							{:else}
								Trial ends in {trialDays} days
							{/if}
						</Badge>
					{/if}
				{/snippet}

				<!-- Desktop / wide layout: full table, sortable headers. -->
				<div class="hidden sm:block">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head aria-sort={ariaSort('name')}>{@render sortHeader('Name', 'name')}</Table.Head>
								<Table.Head>Price</Table.Head>
								<Table.Head class="text-right" aria-sort={ariaSort('monthly')}>
									{@render sortHeader(`Monthly (${cur})`, 'monthly', 'right')}
								</Table.Head>
								<Table.Head aria-sort={ariaSort('nextRenewal')}>
									{@render sortHeader('Next renewal', 'nextRenewal')}
								</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head class="text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each sorted as sub (sub.id)}
								<Table.Row class={sub.status !== 'active' ? 'opacity-60' : ''}>
									<Table.Cell>
										<div class="font-medium">{sub.name}</div>
										{#if sub.category}
											<div class="text-xs text-muted-foreground">{sub.category}</div>
										{/if}
										{@render trialBadge(sub)}
									</Table.Cell>
									<Table.Cell>
										<div>{formatMoney(sub.amount, sub.currency)}</div>
										<div class="text-xs text-muted-foreground">{cycleLabel(sub)}</div>
									</Table.Cell>
									<Table.Cell class="text-right font-medium">
										{sub.status === 'active' ? monthly(sub) : '—'}
									</Table.Cell>
									<Table.Cell class="text-sm">
										{#if sub.nextRenewal}
											{@const status = renewalStatus(sub.nextRenewal)}
											<div class="text-muted-foreground">
												{new Date(sub.nextRenewal).toLocaleDateString(undefined, {
													day: 'numeric',
													month: 'short',
													year: 'numeric'
												})}
											</div>
											{#if sub.status === 'active'}
												<div class="text-xs {toneClass[status.tone]}">{status.label}</div>
											{/if}
										{:else}
											<span class="text-muted-foreground">—</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										<Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
									</Table.Cell>
									<Table.Cell>
										<div class="flex items-center justify-end gap-1">
											{@render rowActions(sub)}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>

				<!-- Mobile layout: one card per subscription, same data and actions. -->
				<div class="sm:hidden">
					<div class="flex items-center justify-between gap-2 border-b p-3">
						<Label for="mobileSort" class="shrink-0 text-xs font-medium text-muted-foreground">
							Sort by
						</Label>
						<select
							id="mobileSort"
							class={selectClass}
							value={mobileSortValue}
							onchange={onMobileSortChange}
						>
							<option value="default">Default order</option>
							<option value="name:asc">Name (A–Z)</option>
							<option value="name:desc">Name (Z–A)</option>
							<option value="monthly:desc">Monthly: high to low</option>
							<option value="monthly:asc">Monthly: low to high</option>
							<option value="nextRenewal:asc">Next renewal: soonest</option>
							<option value="nextRenewal:desc">Next renewal: latest</option>
						</select>
					</div>
					<div class="divide-y">
						{#each sorted as sub (sub.id)}
						<div class="space-y-3 p-4 {sub.status !== 'active' ? 'opacity-60' : ''}">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="truncate font-medium">{sub.name}</p>
									{#if sub.category}
										<p class="text-xs text-muted-foreground">{sub.category}</p>
									{/if}
									{@render trialBadge(sub)}
								</div>
								<Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
							</div>

							<div class="flex items-end justify-between gap-3 text-sm">
								<div>
									<p>{formatMoney(sub.amount, sub.currency)} <span class="text-muted-foreground">/ {cycleLabel(sub)}</span></p>
									{#if sub.nextRenewal}
										{@const status = renewalStatus(sub.nextRenewal)}
										<p class="text-muted-foreground">
											{new Date(sub.nextRenewal).toLocaleDateString(undefined, {
												day: 'numeric',
												month: 'short',
												year: 'numeric'
											})}
											{#if sub.status === 'active'}
												· <span class={toneClass[status.tone]}>{status.label}</span>
											{/if}
										</p>
									{/if}
								</div>
								<p class="font-semibold">
									{sub.status === 'active' ? monthly(sub) : '—'}
									<span class="text-xs font-normal text-muted-foreground">/mo</span>
								</p>
							</div>

							<div class="flex items-center justify-end gap-1 border-t pt-2">
								{@render rowActions(sub)}
							</div>
						</div>
						{/each}
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{isEditing ? 'Edit subscription' : 'Add subscription'}</Dialog.Title>
			<Dialog.Description>
				{isEditing
					? 'Update the details of this subscription.'
					: 'Type a known service name to auto-fill its cancellation link.'}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action={isEditing ? '?/update' : '?/create'}
			class="space-y-4"
			novalidate
			use:enhance={() => {
				formErrors = {};
				return async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') {
						toast.success(isEditing ? 'Subscription updated' : 'Subscription added');
						dialogOpen = false;
						await invalidateAll();
					} else if (result.type === 'failure') {
						formErrors = (result.data?.errors as FieldErrors) ?? {};
						toast.error(String(result.data?.error ?? 'Something went wrong'));
					}
				};
			}}
		>
			{#if isEditing}
				<input type="hidden" name="id" value={form.id} />
			{/if}

			<!-- Trial fields: round-tripped through every edit so an unrelated
			     form save can't accidentally wipe an active trial. The values
			     are managed by the dedicated Trial button + dialog, not here. -->
			<input type="hidden" name="isTrial" value={form.isTrial} />
			<input type="hidden" name="trialEndsOn" value={form.trialEndsOn} />

			<datalist id="providers">
				{#each data.registry as p (p.name)}
					<option value={p.name}></option>
				{/each}
			</datalist>

			<datalist id="categories">
				{#each allCategories as c (c)}
					<option value={c}></option>
				{/each}
			</datalist>

			<div class="grid gap-2">
				<Label for="name">Name</Label>
				<Input
					id="name"
					name="name"
					list="providers"
					placeholder="Netflix"
					required
					bind:value={form.name}
					onblur={onNameBlur}
					oninput={() => clearFieldError('name')}
					aria-invalid={!!formErrors.name}
				/>
				{#if formErrors.name}
					<p class="text-destructive text-xs">{formErrors.name}</p>
				{/if}
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="category">Category</Label>
					<Input
						id="category"
						name="category"
						list="categories"
						placeholder="Streaming"
						bind:value={form.category}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="status">Status</Label>
					<select id="status" name="status" class={selectClass} bind:value={form.status}>
						<option value="active">active</option>
						<option value="paused">paused</option>
						<option value="cancelled">cancelled</option>
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="amount">Price</Label>
					<Input
						id="amount"
						name="amount"
						type="number"
						min="0"
						step="0.01"
						placeholder="9.99"
						required
						bind:value={form.amount}
						oninput={() => clearFieldError('amount')}
						aria-invalid={!!formErrors.amount}
					/>
					{#if formErrors.amount}
						<p class="text-destructive text-xs">{formErrors.amount}</p>
					{/if}
				</div>
				<div class="grid gap-2">
					<Label for="currency">Currency</Label>
					<select
						id="currency"
						name="currency"
						class={selectClass}
						bind:value={form.currency}
						aria-invalid={!!formErrors.currency}
					>
						{#each CURRENCIES as c (c)}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="cycle">Billing cycle</Label>
					<select
						id="cycle"
						name="cycle"
						class={selectClass}
						bind:value={form.cycle}
						aria-invalid={!!formErrors.cycle}
					>
						{#each BILLING_CYCLES as c (c)}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>
				<div class="grid gap-2">
					<Label for="cycleCount">Every</Label>
					<Input
						id="cycleCount"
						name="cycleCount"
						type="number"
						min="1"
						step="1"
						bind:value={form.cycleCount}
						oninput={() => clearFieldError('cycleCount')}
						aria-invalid={!!formErrors.cycleCount}
					/>
					{#if formErrors.cycleCount}
						<p class="text-destructive text-xs">{formErrors.cycleCount}</p>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="startDate">Start date</Label>
					<Input id="startDate" name="startDate" type="date" bind:value={form.startDate} />
				</div>
				<div class="grid gap-2">
					<Label for="nextRenewal">Next renewal</Label>
					<Input id="nextRenewal" name="nextRenewal" type="date" bind:value={form.nextRenewal} />
				</div>
			</div>

			<div class="grid gap-2">
				<Label for="cancelUrl">Cancellation URL</Label>
				<Input
					id="cancelUrl"
					name="cancelUrl"
					type="url"
					placeholder="https://…"
					bind:value={form.cancelUrl}
					oninput={() => clearFieldError('cancelUrl')}
					aria-invalid={!!formErrors.cancelUrl}
				/>
				{#if formErrors.cancelUrl}
					<p class="text-destructive text-xs">{formErrors.cancelUrl}</p>
				{/if}
			</div>

			<div class="grid gap-2">
				<Label for="cancelNotes">Cancellation notes</Label>
				<Input
					id="cancelNotes"
					name="cancelNotes"
					placeholder="Steps / phone / email if there's no URL"
					bind:value={form.cancelNotes}
				/>
			</div>

			<div class="grid gap-2">
				<Label for="notes">Notes</Label>
				<Input id="notes" name="notes" bind:value={form.notes} />
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
				<Button type="submit">{isEditing ? 'Save changes' : 'Add subscription'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	bind:open={cancelOpen}
	onOpenChange={(open) => {
		if (!open) {
			pendingCancel = null;
			cancelConfirmation = '';
			cancelConfirmationError = null;
		}
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Mark as cancelled?</AlertDialog.Title>
			<AlertDialog.Description>
				{#if pendingCancel?.cancelUrl}
					We opened the provider's cancellation page in a new tab. Finish cancelling there, then
					confirm below so Solvo stops counting <strong>{pendingCancel.name}</strong> in your
					totals.
				{:else if pendingCancel?.cancelNotes}
					Cancel <strong>{pendingCancel?.name}</strong> with the provider first
					({pendingCancel.cancelNotes}), then confirm below.
				{:else}
					Cancel <strong>{pendingCancel?.name}</strong> with the provider first, then confirm below
					so Solvo stops counting it in your totals.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>

		{#if pendingCancel?.cancelUrl}
			<Button type="button" variant="outline" class="w-full" onclick={() => openCancelPage(pendingCancel!)}>
				<ExternalLink class="size-4" />
				Open cancellation page
			</Button>
		{/if}

		<div class="grid gap-2">
			<Label for="cancelConfirmation">
				Type <span class="font-mono text-foreground">{cancelPhrase}</span> to confirm
			</Label>
			<Input
				id="cancelConfirmation"
				autocomplete="off"
				placeholder={cancelPhrase}
				bind:value={cancelConfirmation}
				aria-invalid={cancelInputInvalid || cancelConfirmationError !== null}
				aria-describedby="cancelConfirmationHelp"
				oninput={onCancelConfirmationInput}
			/>
			<div id="cancelConfirmationHelp" class="text-sm">
				{#if cancelConfirmed}
					<p class="flex items-start gap-2 text-emerald-600 dark:text-emerald-500">
						<CheckCircle2 class="mt-0.5 size-4 shrink-0" />
						<span>Phrase matches — you can mark this subscription as cancelled.</span>
					</p>
				{:else if cancelInputInvalid || cancelConfirmationError}
					<p class="flex items-start gap-2 text-destructive">
						<AlertCircle class="mt-0.5 size-4 shrink-0" />
						<span>
							{cancelConfirmationError ??
								`That doesn't match. Type exactly: ${cancelPhrase}`}
						</span>
					</p>
				{:else}
					<p class="text-muted-foreground">
						Copy the phrase above exactly, including the word <span class="font-mono">canceled</span>.
					</p>
				{/if}
			</div>
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Cancel>Not yet</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/cancel"
				onsubmit={blockInvalidCancelSubmit}
				use:enhance={() => {
					const name = pendingCancel?.name;
					return async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') {
							toast.success(`Marked ${name} as cancelled`);
							cancelOpen = false;
							pendingCancel = null;
							cancelConfirmation = '';
							cancelConfirmationError = null;
							await invalidateAll();
						} else if (result.type === 'failure') {
							cancelConfirmationError = String(
								result.data?.error ?? 'Could not mark as cancelled.'
							);
						}
					};
				}}
			>
				<input type="hidden" name="id" value={pendingCancel?.id} />
				<input type="hidden" name="confirmation" value={cancelConfirmation} />
				<AlertDialog.Action
					type="submit"
					class={buttonVariants({ variant: 'destructive' })}
					disabled={!cancelConfirmed}
				>
					Mark as cancelled
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={deleteOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete subscription?</AlertDialog.Title>
			<AlertDialog.Description>
				This permanently removes <strong>{pendingDelete?.name}</strong> from Solvo. This can't be
				undone. To stop paying without losing the record, cancel it instead.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep it</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/remove"
				use:enhance={() => {
					const name = pendingDelete?.name;
					return async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') {
							toast.success(`Deleted ${name}`);
							await invalidateAll();
						}
						deleteOpen = false;
						pendingDelete = null;
					};
				}}
			>
				<input type="hidden" name="id" value={pendingDelete?.id} />
				<AlertDialog.Action type="submit" class={buttonVariants({ variant: 'destructive' })}>
					Delete
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root
	bind:open={trialDialogOpen}
	onOpenChange={(open) => {
		if (!open) lockedTrialSub = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Start trial</Dialog.Title>
			<Dialog.Description>
				Pick the active subscription and the date its free trial ends. If you
				don't cancel the trial before then, it converts to a paid subscription
				and the normal billing cycle takes over.
			</Dialog.Description>
		</Dialog.Header>

		{@const eligibleSubs = data.subscriptions.filter(
			(s) => s.status === 'active' && !s.isTrial
		)}

		{#if lockedTrialSub === null && eligibleSubs.length === 0}
			<p class="text-muted-foreground text-sm">
				No eligible subscriptions. A subscription must be active and not already
				on trial.
			</p>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (trialDialogOpen = false)}>
					Close
				</Button>
			</Dialog.Footer>
		{:else}
			<form
				method="POST"
				action="?/startTrial"
				class="space-y-4"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update({ reset: false });
						if (result.type === 'success') {
							const started =
								lockedTrialSub ??
								data.subscriptions.find((s) => String(s.id) === pendingTrialSubId);
							toast.success(`Trial set for ${started?.name ?? 'subscription'}`);
							trialDialogOpen = false;
							await invalidateAll();
						} else if (result.type === 'failure') {
							toast.error(String(result.data?.error ?? 'Could not start trial'));
						}
					};
				}}
			>
				<div class="grid gap-2">
					<Label for="trialSubId">Subscription</Label>
					{#if lockedTrialSub}
						<input type="hidden" name="id" value={lockedTrialSub.id} />
						<p class="border-input bg-muted/30 flex h-9 items-center rounded-md border px-3 text-sm">
							{lockedTrialSub.name} — {formatMoney(lockedTrialSub.amount, lockedTrialSub.currency)}/{lockedTrialSub.cycleCount >
							1
								? `${lockedTrialSub.cycleCount} ${lockedTrialSub.cycle}`
								: lockedTrialSub.cycle}
						</p>
					{:else}
						<select
							id="trialSubId"
							name="id"
							bind:value={pendingTrialSubId}
							class={selectClass}
							required
						>
							{#each eligibleSubs as s (s.id)}
								<option value={s.id}>
									{s.name} — {formatMoney(s.amount, s.currency)}/{s.cycleCount > 1
										? `${s.cycleCount} ${s.cycle}`
										: s.cycle}
								</option>
							{/each}
						</select>
					{/if}
				</div>
				<div class="grid gap-2">
					<Label for="trialEndsOn">Trial ends on</Label>
					<Input
						id="trialEndsOn"
						name="trialEndsOn"
						type="date"
						required
						bind:value={trialEndsOn}
					/>
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (trialDialogOpen = false)}>
						Cancel
					</Button>
					<Button type="submit">Start trial</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
