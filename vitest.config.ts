import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import { join, resolve } from 'path'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))
const projectRoot = resolve(__dirname)

export default defineConfig({
  plugins: [],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'tests/services/MatrixI18nService.test.ts',
      'tests/services/MatrixSettingsService.test.ts',
      'tests/services/MatrixPerformanceService.test.ts',
      'tests/services/MatrixNotificationService.test.ts',
      'tests/services/MatrixUserService.test.ts',
      'tests/services/MatrixMessageService.test.ts',
      'tests/services/MatrixAuthService.test.ts',
      'tests/services/MatrixCrossSigningService.test.ts',
      'tests/services/MatrixKeyBackupService.test.ts',
      'tests/services/MatrixDataDeletionService.test.ts',
      'tests/services/MatrixDataExportService.test.ts',
      'tests/services/MatrixPrivateChatService.test.ts',
      'tests/services/MatrixPollService.test.ts'
    ],
    exclude: ['node_modules', 'lib', '.git', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/matrix/**/*.{ts,vue}'],
      exclude: ['src/services/matrix/index.ts', 'src/**/*.d.ts']
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@/lib/matrix-sdk': join(projectRoot, './lib/matrix-sdk/matrix.js'),
      '@lib/matrix-sdk': join(projectRoot, './lib/matrix-sdk/matrix.js'),
      '@/lib/matrix-sdk/enhanced': join(projectRoot, './lib/matrix-sdk/enhanced/index.js'),
      '@/lib/matrix-sdk/enhanced/utils/error-codes': join(
        projectRoot,
        './lib/matrix-sdk/enhanced/utils/error-codes.js'
      ),
      '@/lib/matrix-sdk/enhanced/utils/http': join(projectRoot, './lib/matrix-sdk/enhanced/utils/http.js'),
      '@/lib/matrix-sdk/*': join(projectRoot, './lib/matrix-sdk/*'),
      '@': join(projectRoot, './src'),
      '#': join(projectRoot, './src/mobile'),
      '~': join(projectRoot, '.'),
      '~~': projectRoot
    },
    extensions: ['.js', '.ts', '.vue', '.json', '.d.ts']
  },
  esbuild: {
    target: 'esnext'
  }
})
