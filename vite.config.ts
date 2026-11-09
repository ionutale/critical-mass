import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { withPwa } from '@vite-pwa/sveltekit';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
	plugins: [
		...withPwa(
			{
				compilerOptions: {
					// Force runes mode for the project, except for libraries.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter({ fallback: '200.html' })
			},
			{
				registerType: 'prompt',
				pwaAssets: { config: true },
				manifest: {
					name: 'Critical Mass',
					short_name: 'Critical Mass',
					description: 'Fuse the alpha ladder and climb the reactor before it melts down.',
					theme_color: '#070B14',
					background_color: '#070B14',
					display: 'standalone',
					orientation: 'portrait',
					start_url: '/',
					scope: '/'
				},
				// The plugin adds a prerendered/** glob this SPA never produces;
				// globStrict keeps the harmless warning from failing the build.
				generateSW: {
					globPatterns: ['client/**/*.{js,css,html,svg,png,ico,woff2}'],
					globStrict: false,
					navigateFallback: '/'
				},
				kit: {
					adapterFallback: '200.html',
					spa: { fallbackMapping: '/' },
					includeVersionFile: true
				}
			}
		),
		svelteTesting()
	],
	test: {
		expect: { requireAssertions: true },
		environment: 'jsdom',
		environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.test.ts']
	}
});
