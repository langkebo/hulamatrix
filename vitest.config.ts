/// <reference types="vitest" />

import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { existsSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vitest/config'
import { getComponentsDirs, getComponentsDtsPath } from './build/config/components'
import { getRootPath, getSrcPath } from './build/config/getPath'

// Custom plugin to handle mobile path alias resolution in tests
function mobileAliasPlugin() {
  return {
    name: 'mobile-alias-resolver',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id.startsWith('#/')) {
        const resolvedPath = pathResolve(getSrcPath(), 'mobile', id.slice(2))
        if (existsSync(resolvedPath)) {
          return resolvedPath
        }
      }
      return null
    }
  }
}

const testPlatform = process.env.TAURI_ENV_PLATFORM
const testComponentsDirs = getComponentsDirs(testPlatform)
const testComponentsDtsPath = getComponentsDtsPath(testPlatform)

export default defineConfig({
  plugins: [
    mobileAliasPlugin(),
    vue(),
    vueJsx(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        { 'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar', 'useModal'] }
      ],
      dts: 'src/typings/auto-imports.d.ts'
    }),
    /**自动导入组件，但是不会自动导入jsx和tsx*/
    Components({
      dirs: testComponentsDirs, // 根据环境加载对应组件目录
      resolvers: [NaiveUiResolver()],
      dts: testComponentsDtsPath
    })
  ],
  resolve: {
    alias: (() => {
      const baseAliases: Record<string, string> = {
        '@': getSrcPath(),
        '#': pathResolve(getSrcPath(), 'mobile'),
        '~': getRootPath()
      }

      // 添加 matrix-js-sdk 别名（如果存在）
      const fallback = '../matrix-js-sdk-39.1.3'
      const local = process.env.VITE_MATRIX_SDK_LOCAL_PATH || fallback
      const abs = pathResolve(getRootPath(), local)
      if (existsSync(abs)) {
        baseAliases['matrix-js-sdk'] = abs
      }

      return baseAliases
    })()
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],

    // 增强的测试配置
    testTimeout: 10000, // 默认测试超时时间增加到10秒
    hookTimeout: 10000, // hook超时时间
    maxConcurrency: 1, // 限制并发测试数量避免资源竞争
    isolate: false, // 允许测试间共享状态以减少mock重复

    // 环境变量配置
    environmentOptions: {
      happyDom: {
        url: 'http://localhost:3000'
      }
    },

    // 全局设置
    setupFiles: ['tests/setup.ts'],

    // Mock配置
    clearMocks: false, // 不自动清除所有mock，避免破坏复杂的mock结构
    restoreMocks: false, // 不自动恢复mock，保持状态

    // 增强的覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{vue,js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{js,ts}',
        'src/types/**',
        'src/**/*.d.ts',
        'src/**/index.ts', // 导出文件
        'src/**/types/**', // 类型定义文件
        'src/**/mock/**', // mock文件
        'src/**/__tests__/**', // 测试工具文件
        'tests/**' // 测试目录
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      },
      clean: true, // 覆盖率报告时清理旧报告
      cleanOnRerun: true
    },

    // 输出配置
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/results.json'
    }

    // 全局变量配置移除，统一由 Vite 顶层 define 管理
  }
})
