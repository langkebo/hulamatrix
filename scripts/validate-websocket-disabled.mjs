#!/usr/bin/env node
/**
 * Phase 4 WebSocket 迁移测试脚本
 * 用于验证 VITE_DISABLE_WEBSOCKET=true 配置下 Matrix SDK 完全接管
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(color, symbol, message) {
  console.log(`${COLORS[color]}${symbol}${COLORS.reset} ${message}`)
}

function success(msg) { log('green', '✓', msg) }
function error(msg) { log('red', '✗', msg) }
function warn(msg) { log('yellow', '⚠', msg) }
function info(msg) { log('blue', 'ℹ', msg) }
function header(msg) { console.log(`\n${COLORS.cyan}${msg}${COLORS.reset}\n`) }

// 检查环境变量配置
function checkEnvConfig() {
  header('1. 检查环境变量配置')

  const envPath = resolve('.env')
  if (!existsSync(envPath)) {
    error('.env 文件不存在，请从 .env.example 复制')
    return false
  }

  const envContent = readFileSync(envPath, 'utf-8')
  const hasDisableWebSocket = envContent.includes('VITE_DISABLE_WEBSOCKET')

  if (!hasDisableWebSocket) {
    error('.env 中缺少 VITE_DISABLE_WEBSOCKET 配置')
    return false
  }

  const isEnabled = envContent.match(/VITE_DISABLE_WEBSOCKET=(.*)/)?.[1]
  if (isEnabled === 'true') {
    success('VITE_DISABLE_WEBSOCKET=true (WebSocket 已禁用)')
  } else {
    warn(`VITE_DISABLE_WEBSOCKET=${isEnabled} (当前未禁用 WebSocket)`)
    info('测试完全迁移需要设置 VITE_DISABLE_WEBSOCKET=true')
  }

  return true
}

// 检查功能标志实现
function checkFeatureFlags() {
  header('2. 检查功能标志实现')

  const featureFlagsPath = resolve('src/config/feature-flags.ts')
  if (!existsSync(featureFlagsPath)) {
    error('feature-flags.ts 不存在')
    return false
  }

  const content = readFileSync(featureFlagsPath, 'utf-8')

  const checks = [
    { name: 'MATRIX_FIRST_ROUTING', pattern: /MATRIX_FIRST_ROUTING/ },
    { name: 'DISABLE_WEBSOCKET', pattern: /DISABLE_WEBSOCKET/ },
    { name: 'VITE_DISABLE_WEBSOCKET 环境变量读取', pattern: /VITE_DISABLE_WEBSOCKET/ }
  ]

  let allPassed = true
  for (const check of checks) {
    if (content.match(check.pattern)) {
      success(`${check.name} 已实现`)
    } else {
      error(`${check.name} 未实现`)
      allPassed = false
    }
  }

  return allPassed
}

// 检查迁移监控实现
function checkMigrationMonitor() {
  header('3. 检查迁移监控实现')

  const files = [
    { path: 'src/utils/migrationMonitor.ts', name: 'MigrationMonitor 工具类' },
    { path: 'src/components/migration/MigrationMonitorPanel.vue', name: '监控面板组件' }
  ]

  let allPassed = true
  for (const file of files) {
    const fullPath = resolve(file.path)
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8')

      const methods = [
        'recordRoute',
        'recordPerformance',
        'getStats',
        'getDetailedReport',
        'exportToFile',
        'importFromFile',
        'exportToCSV'
      ]

      if (file.path.endsWith('.ts')) {
        const hasAllMethods = methods.every(m => content.includes(m))
        if (hasAllMethods) {
          success(`${file.name} - 所有方法已实现`)
        } else {
          warn(`${file.name} - 部分方法缺失`)
        }
      } else {
        success(`${file.name} - 文件存在`)
      }
    } else {
      error(`${file.name} - 文件不存在: ${file.path}`)
      allPassed = false
    }
  }

  return allPassed
}

// 检查适配器优先级
function checkAdapterPriorities() {
  header('4. 检查适配器优先级配置')

  const adapterFactoryPath = resolve('src/adapters/adapter-factory.ts')
  if (!existsSync(adapterFactoryPath)) {
    error('adapter-factory.ts 不存在')
    return false
  }

  const content = readFileSync(adapterFactoryPath, 'utf-8')

  const checks = [
    { name: 'getMatrixPriority() 动态优先级方法', pattern: /getMatrixPriority/ },
    { name: 'getWebSocketPriority() 动态优先级方法', pattern: /getWebSocketPriority/ },
    { name: 'MATRIX_FIRST_ROUTING 优先级逻辑', pattern: /MATRIX_FIRST_ROUTING/ },
    { name: 'Matrix 优先级 = 100 (启用时)', pattern: /\?\s*100\s*:/ },
    { name: 'WebSocket 优先级 = 80 (Matrix 优先时)', pattern: /getWebSocketPriority\(\)[\s\S]*\?\s*80/ }
  ]

  let allPassed = true
  for (const check of checks) {
    if (content.match(check.pattern)) {
      success(check.name)
    } else {
      warn(check.name + ' - 未找到')
      allPassed = false
    }
  }

  return allPassed
}

// 检查测试覆盖
function checkTests() {
  header('5. 检查测试覆盖')

  const testFiles = [
    { path: 'src/__tests__/utils/migration-monitor.spec.ts', name: 'MigrationMonitor 测试' },
    { path: 'src/__tests__/services/message-router.spec.ts', name: 'MessageRouter 测试' }
  ]

  let allPassed = true
  for (const file of testFiles) {
    if (existsSync(resolve(file.path))) {
      success(`${file.name} - 存在`)
    } else {
      error(`${file.name} - 缺失: ${file.path}`)
      allPassed = false
    }
  }

  return allPassed
}

// 检查 Matrix 适配器迁移监控集成
function checkMatrixAdapterIntegration() {
  header('6. 检查 Matrix 适配器迁移监控集成')

  const adapters = [
    'src/adapters/matrix-adapter.ts',
    'src/adapters/matrix-friend-adapter.ts',
    'src/integrations/matrix/adapters/room.ts'
  ]

  let allPassed = true
  for (const adapterPath of adapters) {
    const fullPath = resolve(adapterPath)
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8')
      const hasMigrationMonitor = content.includes('migrationMonitor')

      if (hasMigrationMonitor) {
        const hasRecordRoute = content.includes('recordRoute')
        const hasRecordPerformance = content.includes('recordPerformance')

        if (hasRecordRoute && hasRecordPerformance) {
          success(`${adapterPath} - 完整集成`)
        } else if (hasRecordRoute) {
          warn(`${adapterPath} - 部分集成 (缺少 recordPerformance)`)
        } else {
          warn(`${adapterPath} - 部分集成 (缺少 recordRoute)`)
        }
      } else {
        warn(`${adapterPath} - 未集成迁移监控`)
      }
    } else {
      error(`${adapterPath} - 文件不存在`)
      allPassed = false
    }
  }

  return allPassed
}

// 检查 WebSocket 回退适配器
function checkWebSocketFallback() {
  header('7. 检查 WebSocket 回退适配器')

  const wsAdapterPath = resolve('src/adapters/websocket-friend-adapter.ts')
  if (existsSync(wsAdapterPath)) {
    const content = readFileSync(wsAdapterPath, 'utf-8')
    const hasPriority = content.includes('priority')
    const hasMigrationMonitor = content.includes('migrationMonitor')

    if (hasPriority && hasMigrationMonitor) {
      success('WebSocket Friend Adapter - 完整实现')
      return true
    } else if (hasPriority) {
      warn('WebSocket Friend Adapter - 缺少迁移监控')
      return false
    }
  }

  error('WebSocket Friend Adapter - 不存在')
  return false
}

// 生成测试报告
function generateReport() {
  header('8. 生成测试报告')

  info('创建 WebSocket 禁用模式测试配置...')

  const testConfig = `
# ============================================================================
# Phase 4 WebSocket 迁移测试配置
# ============================================================================
# 此配置用于测试 Matrix SDK 完全接管场景
# 使用方式: 复制到 .env 文件，然后重启开发服务器

# 禁用 WebSocket（核心测试配置）
VITE_DISABLE_WEBSOCKET=true

# 启用 Matrix SDK 优先路由
# (通过 featureFlags.isEnabled('MATRIX_FIRST_ROUTING') 控制)

# 确保 Matrix 功能已启用
VITE_MATRIX_ENABLED=on
VITE_MATRIX_ROOMS_ENABLED=on
VITE_SYNAPSE_FRIENDS_ENABLED=on

# ============================================================================
# 验证清单:
# ============================================================================
# [ ] 1. 启动应用: pnpm run tauri:dev
# [ ] 2. 检查控制台: 确认无 WebSocket 连接错误
# [ ] 3. 测试消息发送: 所有消息应通过 Matrix SDK
# [ ] 4. 测试房间列表: 应通过 client.getRooms() 获取
# [ ] 5. 测试好友列表: 应通过 Matrix 关系 API 获取
# [ ] 6. 查看监控面板: 迁移进度应接近 100%
# [ ] 7. 导出测试报告: 使用监控面板导出功能
# ============================================================================
`

  console.log(testConfig)

  // 写入文件
  const configPath = resolve('.env.websocket-disabled-test')
  try {
    // 注意：这里不实际写入，因为 .env 文件不应提交到 git
    success('测试配置已生成（请手动复制上述内容到 .env 文件）')
  } catch {
    info('测试配置已显示（请手动复制上述内容到 .env 文件）')
  }

  return true
}

// 主函数
async function main() {
  console.log(`
${COLORS.cyan}
╔═══════════════════════════════════════════════════════════════════════╗
║                     Phase 4 WebSocket 迁移验证                        ║
║                   VITE_DISABLE_WEBSOCKET=true 测试                     ║
╚═══════════════════════════════════════════════════════════════════════╝
${COLORS.reset}
`)

  const results = {
    '环境变量配置': checkEnvConfig(),
    '功能标志实现': checkFeatureFlags(),
    '迁移监控实现': checkMigrationMonitor(),
    '适配器优先级': checkAdapterPriorities(),
    '测试覆盖': checkTests(),
    'Matrix 适配器集成': checkMatrixAdapterIntegration(),
    'WebSocket 回退适配器': checkWebSocketFallback(),
    '测试报告': generateReport()
  }

  header('验证结果汇总')

  let passCount = 0
  let failCount = 0

  for (const [name, passed] of Object.entries(results)) {
    if (passed) {
      success(name)
      passCount++
    } else {
      error(name)
      failCount++
    }
  }

  console.log()
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log(`总计: ${passCount + failCount}  |  ${COLORS.green}通过: ${passCount}${COLORS.reset}  |  ${COLORS.red}失败: ${failCount}${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log()

  if (failCount === 0) {
    success('所有检查通过！可以开始 WebSocket 禁用模式测试')
    console.log(`
${COLORS.yellow}下一步操作:${COLORS.reset}
1. 在 .env 中设置: VITE_DISABLE_WEBSOCKET=true
2. 重启开发服务器: pnpm run tauri:dev
3. 使用应用验证所有功能正常
4. 打开监控面板查看迁移数据
`)
  } else {
    warn('部分检查未通过，请修复后重试')
  }

  process.exit(failCount > 0 ? 1 : 0)
}

main().catch(err => {
  error(`脚本执行错误: ${err.message}`)
  process.exit(1)
})
