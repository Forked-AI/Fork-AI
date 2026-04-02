import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	esbuild: {
		jsx: 'automatic',
		jsxImportSource: 'react',
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
		exclude: ['tests/benchmarks/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['lib/**', 'hooks/**'],
			exclude: ['lib/prisma.ts', 'lib/models.ts', 'lib/redis.ts', 'lib/email.ts'],
		},
		benchmark: {
			include: ['tests/**/*.bench.ts'],
		},
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, '.'),
		},
	},
})
