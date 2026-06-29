<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { Toaster } from '$lib/components/ui/sonner';
	import { LayoutDashboard, ListChecks, Settings } from '@lucide/svelte';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/subscriptions', label: 'Subscriptions', icon: ListChecks },
		{ href: '/settings', label: 'Settings', icon: Settings }
	];

	function isActive(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Solvo — subscription manager</title>
</svelte:head>

<Toaster richColors closeButton />

<div class="min-h-screen bg-background">
	<header class="border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<a href="/" class="flex items-baseline gap-2">
				<span class="text-xl font-semibold tracking-tight">Solvo</span>
				<span class="hidden text-sm text-muted-foreground sm:inline">own your subscriptions</span>
			</a>
			<nav class="flex items-center gap-1">
				{#each nav as item (item.href)}
					{@const Icon = item.icon}
					<a
						href={item.href}
						class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
						class:bg-accent={isActive(item.href)}
						class:text-accent-foreground={isActive(item.href)}
						class:text-muted-foreground={!isActive(item.href)}
					>
						<Icon class="size-4" />
						<span class="hidden sm:inline">{item.label}</span>
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-8">
		{@render children()}
	</main>
</div>
