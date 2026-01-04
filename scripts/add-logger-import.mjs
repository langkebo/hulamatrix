#!/usr/bin/env node
/**
 * 批量添加 logger 导入
 */

import { readFileSync, writeFileSync } from 'node:fs'

const FILES = [
  'src/__tests__/performance/benchmarks.spec.ts',
  'src/__tests__/services/adminClient.spec.ts',
  'src/__tests__/setup.ts',
  'src/composables/useMatrixClient.ts',
  'src/hooks/useChatMain/useChatHelpers.ts',
  'src/hooks/useMatrixSpaces.ts',
  'src/integrations/matrix/enhanced-rtc.ts',
  'src/integrations/synapse/friends.ts',
  'src/stores/matrix.ts',
  'src/utils/cacheCleanup.ts',
  'src/utils/chatListMenu.ts',
  'src/utils/MatrixLoginDebugger.ts',
  'src/utils/mediaCacheDB.ts',
  'src/utils/messageDebug.ts',
  'src/utils/messageListDebugger.ts',
  'src/utils/test-discovery.ts',
  'src/components/friends/FriendsList.vue',
  'src/components/matrix/MatrixCall.vue',
  'src/components/matrix/NotificationHistory.vue',
  'src/components/migration/MigrationMonitorPanel.vue',
  'src/mobile/components/MobileLayout.vue',
  'src/mobile/components/friends/MobileFriendCategories.vue',
  'src/mobile/components/security/MobileEncryptionStatus.vue',
  'src/mobile/views/media/MediaCache.vue',
  'src/mobile/views/settings/index.vue',
  'src/services/unifiedMessageReceiver.ts',
  'src/services/webSocketRust.ts',
  'src/views/homeWindow/FriendsList.vue',
  'src/views/loginWindow/Login.vue',
  'src/views/moreWindow/settings/Sessions.vue',
  'src/views/private-chat/PrivateChatView.vue'
]

function addLoggerImport(filePath) {
  try {
    let content = readFileSync(filePath, 'utf-8')

    // Skip if already has logger import
    if (content.includes("import { logger }") || content.includes("import logger")) {
      return false
    }

    // Find the last import line
    const importMatch = content.match(/^import .+$/m)
    if (!importMatch) {
      console.log(`⚠ Skipping ${filePath} - no imports found`)
      return false
    }

    // Get all import lines
    const imports = [...content.matchAll(/^import .+$/gm)]
    const lastImport = imports[imports.length - 1]
    const lastImportEnd = lastImport.index + lastImport[0].length

    // Insert logger import after the last import
    const newContent =
      content.slice(0, lastImportEnd) +
      '\n' +
      `import { logger } from '@/utils/logger'` +
      content.slice(lastImportEnd)

    writeFileSync(filePath, newContent, 'utf-8')
    console.log(`✓ ${filePath}`)
    return true
  } catch (error) {
    console.error(`✗ ${filePath}: ${error.message}`)
    return false
  }
}

// Main
console.log('📦 添加 logger 导入...')
console.log('')

let count = 0
for (const file of FILES) {
  if (addLoggerImport(file)) {
    count++
  }
}

console.log('')
console.log(`✅ 完成! 已处理 ${count} 个文件`)
