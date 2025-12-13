import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['highlight.js'],
		exclude: ['monaco-editor']
	},
	ssr: {
		noExternal: ['highlight.js']
	},
	build: {
		rollupOptions: {
			output: {
				inlineDynamicImports: false
			}
		}
	},
	worker: {
		format: 'es'
	}
});
