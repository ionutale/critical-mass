import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.ts',
	use: {
		baseURL: 'http://127.0.0.1:4319',
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	},
	webServer: {
		command: './node_modules/.bin/vite preview --host 127.0.0.1 --port 4319',
		url: 'http://127.0.0.1:4319',
		reuseExistingServer: false,
		timeout: 120_000
	}
});
