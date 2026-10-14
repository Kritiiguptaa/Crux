import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config for the Node-side unit tests (storage layer, and later FSRS and
 * AI-output validation). We alias `electron` to a tiny stub so modules that
 * import it at load time don't fail outside Electron, and map the same path
 * aliases the app uses.
 *
 * Note: better-sqlite3 is a native module. These tests need it built for your
 * local Node ABI (`npm run rebuild:node`), whereas running the app needs the
 * Electron ABI (`npm run rebuild:electron`). See the README.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      electron: resolve('tests/stubs/electron.ts'),
      '@main': resolve('src/main'),
      '@shared': resolve('src/shared')
    }
  }
})
