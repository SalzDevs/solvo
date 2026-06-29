<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
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
	import { renewalStatus, type RenewalTone } from '$lib/renewals';
	import { findProvider } from '$lib/registry';
	import { BILLING_CYCLES, CURRENCIES, type Subscription } from '$lib/types';
	import { ExternalLink, Pencil, Plus, RotateCcw, Trash2, XCircle } from '@lucide/svelte';
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
			status: 'active'
		};
	}

	let dialogOpen = $state(false);
	let form = $state<FormState>(emptyForm());
	const isEditing = $derived(form.id !== null);

	let deleteOpen = $state(false);
	let pendingDelete = $state<Subscription | null>(null);

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
			status: sub.status
		};
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

	function startCancel(sub: Subscription) {
		if (sub.cancelUrl) {
			window.open(sub.cancelUrl, '_blank', 'noopener,noreferrer');
		} else if (sub.cancelNotes) {
			toast.info(`How to cancel ${sub.name}`, { description: sub.cancelNotes, duration: 8000 });
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Subscriptions</h1>
			<p class="text-sm text-muted-foreground">Track, price, and cancel your recurring spend.</p>
		</div>
		<Button onclick={openAdd}>
			<Plus class="size-4" />
			Add subscription
		</Button>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			{#if data.subscriptions.length === 0}
				<div class="py-16 text-center text-sm text-muted-foreground">
					Nothing here yet. Add your first subscription to get started.
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head>Price</Table.Head>
							<Table.Head class="text-right">Monthly ({cur})</Table.Head>
							<Table.Head>Next renewal</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head class="text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.subscriptions as sub (sub.id)}
							<Table.Row class={sub.status !== 'active' ? 'opacity-60' : ''}>
								<Table.Cell>
									<div class="font-medium">{sub.name}</div>
									{#if sub.category}
										<div class="text-xs text-muted-foreground">{sub.category}</div>
									{/if}
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
										<Button variant="ghost" size="icon" title="Edit" onclick={() => openEdit(sub)}>
											<Pencil class="size-4" />
										</Button>

										{#if sub.status === 'active'}
											<form
												method="POST"
												action="?/cancel"
												use:enhance={() => {
													return async ({ result, update }) => {
														await update({ reset: false });
														if (result.type === 'success') {
															toast.success(`Cancelled ${sub.name}`);
															await invalidateAll();
														}
													};
												}}
											>
												<input type="hidden" name="id" value={sub.id} />
												<Button
													type="submit"
													variant="ghost"
													size="icon"
													title="Cancel subscription"
													class="text-destructive hover:text-destructive"
													onclick={() => startCancel(sub)}
												>
													{#if sub.cancelUrl}
														<ExternalLink class="size-4" />
													{:else}
														<XCircle class="size-4" />
													{/if}
												</Button>
											</form>
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
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
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
			use:enhance={() => {
				return async ({ result, update }) => {
					await update({ reset: false });
					if (result.type === 'success') {
						toast.success(isEditing ? 'Subscription updated' : 'Subscription added');
						dialogOpen = false;
						await invalidateAll();
					} else if (result.type === 'failure') {
						toast.error(String(result.data?.error ?? 'Something went wrong'));
					}
				};
			}}
		>
			{#if isEditing}
				<input type="hidden" name="id" value={form.id} />
			{/if}

			<datalist id="providers">
				{#each data.registry as p (p.name)}
					<option value={p.name}></option>
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
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="category">Category</Label>
					<Input id="category" name="category" placeholder="Streaming" bind:value={form.category} />
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
					/>
				</div>
				<div class="grid gap-2">
					<Label for="currency">Currency</Label>
					<select id="currency" name="currency" class={selectClass} bind:value={form.currency}>
						{#each CURRENCIES as c (c)}
							<option value={c}>{c}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="grid gap-2">
					<Label for="cycle">Billing cycle</Label>
					<select id="cycle" name="cycle" class={selectClass} bind:value={form.cycle}>
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
					/>
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
				/>
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
