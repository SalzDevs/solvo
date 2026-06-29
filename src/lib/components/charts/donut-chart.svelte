<script lang="ts">
	interface DonutDatum {
		key: string;
		label: string;
		value: number;
	}

	let {
		data,
		formatValue = (n: number) => String(n),
		centerLabel = '',
		onSelect,
		selected = null
	}: {
		data: DonutDatum[];
		formatValue?: (n: number) => string;
		centerLabel?: string;
		/** When provided, slices become clickable buttons that call this with the slice key. */
		onSelect?: (key: string) => void;
		/** Currently selected slice key. Non-selected slices are dimmed when set. */
		selected?: string | null;
	} = $props();

	const palette = [
		'var(--chart-1)',
		'var(--chart-2)',
		'var(--chart-3)',
		'var(--chart-4)',
		'var(--chart-5)'
	];

	const RADIUS = 42;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	const total = $derived(data.reduce((sum, d) => sum + d.value, 0));

	const segments = $derived(
		(() => {
			let offset = 0;
			return data
				.filter((d) => d.value > 0)
				.map((d, i) => {
					const fraction = total > 0 ? d.value / total : 0;
					const dash = fraction * CIRCUMFERENCE;
					const seg = {
						key: d.key,
						label: d.label,
						value: d.value,
						color: palette[i % palette.length],
						fraction,
						dash,
						offset: -offset * CIRCUMFERENCE
					};
					offset += fraction;
					return seg;
				});
		})()
	);

	const interactive = $derived(onSelect !== undefined);

	function select(key: string) {
		if (!onSelect) return;
		// Clicking the already-selected slice drills back out (toggle).
		onSelect(selected === key ? '' : key);
	}

	function onSliceKeydown(event: KeyboardEvent, key: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			select(key);
		}
	}
</script>

<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
	<div class="relative shrink-0">
		<svg viewBox="0 0 100 100" class="size-40 -rotate-90">
			<circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--muted)" stroke-width="14" />
			{#each segments as s (s.key)}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<circle
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					stroke={s.color}
					stroke-width="14"
					stroke-dasharray="{s.dash} {CIRCUMFERENCE - s.dash}"
					stroke-dashoffset={s.offset}
					class:segment-interactive={interactive}
					class:segment-dim={selected !== null && selected !== s.key}
					role={interactive ? 'button' : undefined}
					tabindex={interactive ? 0 : undefined}
					aria-label={interactive
						? `${s.label}: ${formatValue(s.value)} (${Math.round(s.fraction * 100)}%)`
						: undefined}
					aria-pressed={interactive ? selected === s.key : undefined}
					onclick={interactive ? () => select(s.key) : undefined}
					onkeydown={interactive ? (e) => onSliceKeydown(e, s.key) : undefined}
				/>
			{/each}
		</svg>
		<div class="absolute inset-0 flex flex-col items-center justify-center text-center">
			<span class="text-lg font-semibold tracking-tight">{formatValue(total)}</span>
			{#if centerLabel}
				<span class="text-xs text-muted-foreground">{centerLabel}</span>
			{/if}
		</div>
	</div>

	<ul class="w-full space-y-1.5">
		{#each segments as s (s.key)}
			<li>
				{#if interactive}
					<button
						type="button"
						class="hover:bg-muted/50 flex w-full items-center gap-2 rounded-sm px-1.5 py-0.5 text-left text-sm transition-colors"
						class:bg-muted={selected === s.key}
						aria-pressed={selected === s.key}
						aria-label="Show {s.label}: {formatValue(s.value)}"
						onclick={() => select(s.key)}
					>
						<span class="size-2.5 shrink-0 rounded-full" style="background: {s.color}"></span>
						<span class="flex-1 truncate">{s.label}</span>
						<span class="text-muted-foreground">{Math.round(s.fraction * 100)}%</span>
						<span class="w-20 text-right font-medium">{formatValue(s.value)}</span>
					</button>
				{:else}
					<div class="flex items-center gap-2 px-1.5 py-0.5 text-sm">
						<span class="size-2.5 shrink-0 rounded-full" style="background: {s.color}"></span>
						<span class="flex-1 truncate">{s.label}</span>
						<span class="text-muted-foreground">{Math.round(s.fraction * 100)}%</span>
						<span class="w-20 text-right font-medium">{formatValue(s.value)}</span>
					</div>
				{/if}
			</li>
		{/each}
		{#if segments.length === 0}
			<li class="text-sm text-muted-foreground">No active subscriptions.</li>
		{/if}
	</ul>
</div>

<style>
	.segment-interactive {
		cursor: pointer;
		transition: opacity 0.15s ease;
	}
	.segment-interactive:hover,
	.segment-interactive:focus-visible {
		opacity: 0.85;
		outline: none;
	}
	.segment-dim {
		opacity: 0.3;
	}
</style>
