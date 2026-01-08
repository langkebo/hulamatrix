// import { readFileSync } from 'node:fs'
// import { join } from 'node:path'
import UnoCSS from '@unocss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import os from 'node:os'
import { existsSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'
import postcsspxtorem from 'postcss-pxtorem'
import AutoImport from 'unplugin-auto-import/vite' //自动导入
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite' //组件注册
import { type ConfigEnv, defineConfig, loadEnv } from 'vite'
import VueSetupExtend from 'vite-plugin-vue-setup-extend'
import { getComponentsDirs, getComponentsDtsPath } from './build/config/components'
import { atStartup } from './build/config/console'
import { getRootPath, getSrcPath } from './build/config/getPath'

// Type definitions for Vite environment configuration
interface ViteConfigEnv {
  VITE_DEV_PORT?: string
  VITE_MATRIX_SDK_LOCAL_PATH?: string
  TAURI_ENV_PLATFORM?: string
  [key: string]: string | undefined
}

// Type definition for Vite proxy options
interface ViteProxyOptions {
  target: string
  changeOrigin: boolean
  rewrite: (path: string) => string
  [key: string]: unknown
}

function getLocalIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // 只要 IPv4、非内网回环地址
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return void 0
}

/**
 * Custom plugin to handle mobile path alias resolution
 * Ensures that imports starting with '#/' are resolved from src/mobile directory
 */
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

// 读取 package.json 依赖
// const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))

// 预先获取本地IP
const rawIP = getLocalIP()

// https://vitejs.dev/config/
/**! 不需要优化前端打包(如开启gzip) */
export default defineConfig(({ mode }: ConfigEnv) => {
  // 获取当前环境的配置,如何设置第三个参数则加载所有变量，而不是以"VITE_"前缀的变量
  const config = loadEnv(mode, process.cwd(), '') as ViteConfigEnv
  const currentPlatform = config.TAURI_ENV_PLATFORM
  const isPC =
    !currentPlatform || currentPlatform === 'windows' || currentPlatform === 'darwin' || currentPlatform === 'linux'

  const serverPort = Number(config.VITE_DEV_PORT || process.env.PORT || (isPC ? 6130 : 5210))
  const componentsDirs = getComponentsDirs(currentPlatform || '')
  const componentsDtsPath = getComponentsDtsPath(currentPlatform || '')

  // 根据平台决定host地址
  const host = (() => {
    if (isPC) {
      return '127.0.0.1'
    }

    // 移动端逻辑：检查是否为有效的内网IP地址
    if (rawIP && !rawIP.endsWith('.0') && !rawIP.endsWith('.255')) {
      return rawIP // 有效IP且非网段/广播地址
    }

    // 无效IP或特殊地址的情况
    const mobileHost = config.TAURI_ENV_PLATFORM === 'android' ? '0.0.0.0' : '127.0.0.1'
    return config.TAURI_ENV_PLATFORM === 'ios' ? rawIP : mobileHost
  })()

  // 是否开启启动时打印信息
  const hmrHost = host ?? '127.0.0.1'
  atStartup(config as { [key: string]: string }, mode, hmrHost)()

  return {
    resolve: {
      alias: (() => {
        const baseAliases: Record<string, string> = {
          // 配置主路径别名@
          '@': getSrcPath(),
          // 配置移动端路径别名# (src/mobile目录)
          '#': pathResolve(getSrcPath(), 'mobile'),
          // 配置路径别名~(根路径)
          '~': getRootPath()
        }

        // 添加 matrix-js-sdk 别名（如果存在）
        const fallback = '../matrix-js-sdk-39.1.3'
        const local = config.VITE_MATRIX_SDK_LOCAL_PATH || fallback
        const abs = pathResolve(getRootPath(), local)
        if (existsSync(abs)) {
          baseAliases['matrix-js-sdk'] = abs
        }

        return baseAliases
      })()
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: '@use "@/styles/scss/global/variable.scss" as *;' // 加载全局样式，使用scss特性
        }
      },
      postcss: {
        plugins: [
          postcsspxtorem({
            rootValue: 16, // 1rem = 16px，可根据设计稿调整
            propList: ['*'], // 所有属性都转换
            unitPrecision: 5, // 保留小数位数
            selectorBlackList: [], // 不转换的类名（可选）
            replace: true, // 替换原来的 px
            mediaQuery: false, // 是否在媒体查询中转换
            minPixelValue: 0 // 最小转换单位
          })
        ]
      }
    },
    plugins: [
      mobileAliasPlugin(),
      /**
       * vue3.5.0已支持解构并具有响应式
       * */
      vue(),
      VueSetupExtend(), // setup 中给组件命名(keepAlive需要)
      vueJsx(), // 开启jsx功能
      UnoCSS(), // 开启UnoCSS
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
        dirs: componentsDirs, // 根据平台加载对应组件目录
        resolvers: [NaiveUiResolver()],
        dts: componentsDtsPath,
        // 排除有命名冲突的组件，改为手动导入
        exclude: [
          /VoiceRecorderMobile\.vue$/,
          /VoiceRecorder\.vue$/,
          /EmojiPicker\.vue$/ // 排除我们的 EmojiPicker，避免与 Naive UI 冲突
        ]
      })
    ],
    worker: {
      format: 'es' as const,
      plugins: () => [vue(), VueSetupExtend()]
    },
    build: {
      // 设置兼容低版本浏览器的目标
      target: ['esnext'],
      cssCodeSplit: true, // 启用 CSS 代码拆分
      minify: mode === 'production' ? ('terser' as const) : ('esbuild' as const),
      // chunk 大小警告的限制(kb)
      chunkSizeWarningLimit: 1200,
      // esbuild配置，解决低版本浏览器兼容性问题
      esbuild: {
        supported: {
          'top-level-await': false
        },
        // 生产环境移除 console.log、debugger(默认移除注释)
        drop: mode === 'production' ? ['console', 'debugger'] : []
      },
      sourcemap: false, // 关闭源码映射
      // 分包配置
      rollupOptions: {
        output: {
          chunkFileNames: 'static/js/[name]-[hash].js', // 引入文件名的名称
          entryFileNames: 'static/js/[name]-[hash].js', // 包的入口文件名称
          assetFileNames: 'static/[ext]/[name]-[hash].[ext]', // 资源文件像 字体，图片等
          // 代码分割优化 - 提升首屏加载速度
          manualChunks(id) {
            // Vue 核心库
            if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/')) {
              return 'vue-vendor'
            }
            // 路由和状态管理
            if (id.includes('vue-router') || id.includes('pinia') || id.includes('pinia-plugin')) {
              return 'router-vendor'
            }
            // UI 框架
            if (id.includes('naive-ui') || id.includes('css-render')) {
              return 'ui-vendor'
            }
            // Matrix SDK - 大型依赖单独分包
            if (id.includes('matrix-js-sdk') || id.includes('matrix-widget-api')) {
              return 'matrix-vendor'
            }
            // Tauri 相关
            if (id.includes('@tauri-apps')) {
              return 'tauri-vendor'
            }
            // 日期处理
            if (id.includes('dayjs') || id.includes('date-fns')) {
              return 'date-vendor'
            }
            // 工具库
            if (id.includes('es-toolkit') || id.includes('lodash-es') || id.includes('@vueuse')) {
              return 'utils-vendor'
            }
            // 加密库
            if (id.includes('crypto-js') || id.includes('@stablelib/x25519')) {
              return 'crypto-vendor'
            }
            // 其他 node_modules
            if (id.includes('/node_modules/')) {
              return 'vendor'
            }
            return undefined
          }
        }
      }
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      hmr: {
        protocol: 'ws',
        host: hmrHost,
        port: serverPort,
        overlay: false
      },
      cors: true, // 配置 CORS
      host: '0.0.0.0',
      port: serverPort,
      strictPort: false,
      proxy: (() => {
        const matrixTarget =
          process.env.VITE_MATRIX_PROXY_BASE ||
          process.env.VITE_VITE_MATRIX_BASE_URL ||
          process.env.VITE_MATRIX_BASE_URL ||
          'https://matrix.cjystx.top'
        const adminTarget =
          process.env.VITE_ADMIN_PROXY_BASE ||
          process.env.VITE_MATRIX_PROXY_BASE ||
          process.env.VITE_VITE_MATRIX_BASE_URL ||
          process.env.VITE_MATRIX_BASE_URL ||
          'https://matrix.cjystx.top'
        const proxy: Record<string, ViteProxyOptions> = {}
        if (matrixTarget) {
          proxy['/_synapse'] = { target: matrixTarget, changeOrigin: true, secure: true, rewrite: (p: string) => p }
          proxy['/_matrix'] = { target: matrixTarget, changeOrigin: true, secure: true, rewrite: (p: string) => p }
        }
        if (adminTarget) {
          proxy['/api/me'] = { target: adminTarget, changeOrigin: true, secure: true, rewrite: (p: string) => p }
        }
        return proxy
      })(),
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ['**/src-tauri/**']
      }
    }
  }
})
