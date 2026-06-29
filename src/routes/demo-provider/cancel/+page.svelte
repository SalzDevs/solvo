<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="mx-auto max-w-md space-y-6 py-16">
	{#if data.cancelled}
		<div class="rounded-lg border p-6">
			<h1 class="text-xl font-semibold">Subscription cancelled</h1>
			<p id="cancel-result" class="mt-2 text-sm text-muted-foreground">
				Your subscription has been cancelled. You won't be charged again.
			</p>
		</div>
	{:else}
		<div class="rounded-lg border p-6">
			<h1 class="text-xl font-semibold">Cancel your subscription?</h1>
			<p class="mt-2 text-sm text-muted-foreground">We're sorry to see you go.</p>
			<form method="POST" class="mt-4">
				<button
					id="confirm-cancel"
					type="submit"
					class="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-white"
				>
					Yes, cancel my subscription
				</button>
			</form>
		</div>
	{/if}
</div>
