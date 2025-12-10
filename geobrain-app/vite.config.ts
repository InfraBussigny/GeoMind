import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['monaco-editor']
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					'monaco-editor': ['monaco-editor']
				}
			}
		}
	}
});
