import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		// bun:sqlite is a Bun built-in; keep it external so Vite doesn't try to bundle it.
		external: ['bun:sqlite']
	}
});
