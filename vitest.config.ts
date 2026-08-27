import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * テストは vite.config.ts を読まない。
 * あちらは Cloudflare プラグインを含み、Workers 環境の制約が入るため、
 * 純粋なロジックのテストには不要な上に競合する。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
