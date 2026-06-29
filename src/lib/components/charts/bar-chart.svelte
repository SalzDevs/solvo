<script lang="ts">
	interface BarDatum {
		key: string;
		label: string;
		value: number;
		emphasis?: boolean;
	}

	let {
		data,
		formatValue = (n: number) => String(n),
		height = 180
	}: {
		data: BarDatum[];
		formatValue?: (n: number) => string;
		height?: number;
	} = $props();

	const max = $derived(Math.max(1, ...data.map((d) => d.value)));
</script>

<div class="w-full">
	<div class="flex items-end gap-1.5" style="height: {height}px">
		{#each data as d (d.key)}
			<div class="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
				<div
					class="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
				>
					{formatValue(d.value)}
				</div>
				<div
					class="w-full rounded-t-sm transition-colors {d.emphasis
						? 'bg-primary'
						: 'bg-primary/70 group-hover:bg-primary'}"
					style="height: {(d.value / max) * 100}%; min-height: {d.value > 0 ? '2px' : '0'}"
				></div>
			</div>
		{/each}
	</div>
	<div class="mt-1.5 flex gap-1.5">
		{#each data as d (d.key)}
			<div class="flex-1 text-center text-[10px] text-muted-foreground">{d.label}</div>
		{/each}
	</div>
</div>
