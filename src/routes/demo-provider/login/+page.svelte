<div class="mx-auto max-w-sm space-y-6 py-16">
	<div class="text-center">
		<h1 class="text-xl font-semibold">Demo Provider</h1>
		<p class="text-sm text-muted-foreground">A mock service used to demo Solvo's auto-cancel.</p>
	</div>
	<form method="POST" class="space-y-3 rounded-lg border p-6">
		<div class="space-y-1">
			<label for="email" class="text-sm font-medium">Email</label>
			<input id="email" name="email" type="email" class="w-full rounded-md border px-3 py-2" />
		</div>
		<div class="space-y-1">
			<label for="password" class="text-sm font-medium">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				class="w-full rounded-md border px-3 py-2"
			/>
		</div>
		<button
			id="login-submit"
			type="submit"
			class="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground"
		>
			Sign in
		</button>
	</form>
</div>
