#!/usr/bin/env node
/**
 * Console.log 清理脚本
 *
 * 自动替换 console.log/warn/error/info/debug 为 logger 调用
 * 保留生产环境所需的错误日志，移除调试日志
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'

// 获取项目根目录
// 脚本在 scripts/ 目录下，需要获取其父目录
import { fileURLToPath } from 'node:url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = join(__filename, '..')
const PROJECT_ROOT = join(__dirname, '..')
const SRC_DIR = join(PROJECT_ROOT, 'src')

// 如果 src 目录不存在，尝试使用当前目录
const TARGET_DIR = existsSync(SRC_DIR) ? SRC_DIR : PROJECT_ROOT

// 替换规则
const REPLACEMENTS = [
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.debug(',
    type: 'debug'
  },
  {
    pattern: /console\.debug\(/g,
    replacement: 'logger.debug(',
    type: 'debug'
  },
  {
    pattern: /console\.info\(/g,
    replacement: 'logger.info(',
    type: 'info'
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn(',
    type: 'warn'
  },
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error(',
    type: 'error'
  },
  {
    pattern: /console\.trace\(/g,
    replacement: 'logger.trace(',
    type: 'trace'
  }
]

// 需要保留的 console 使用场景（不替换）
const PRESERVE_PATTERNS = [
  // 清除特定操作的 console
  /console\.clear\(/g,
  // 保留注释中的 console
  /^\s*\/\/.*console\./,
  // 保留字符串中的 console
  /['"`].*console\./,
  // 保留模板字符串中的 console
  /`.*console\./
]

// 统计
const stats = {
  files: 0,
  replacements: {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    trace: 0
  },
  skipped: 0
}

/**
 * 检查文件是否应该被处理
 */
function shouldProcessFile(filePath) {
  // 只处理 TypeScript 和 Vue 文件
  return /\.(ts|tsx|js|jsx|vue)$/.test(filePath)
}

/**
 * 检查是否需要 logger 导入
 */
function needsLoggerImport(content) {
  return content.includes('logger.') && !content.includes("import { logger }")
}

/**
 * 添加 logger 导入
 */
function addLoggerImport(content, filePath) {
  // 查找现有的导入语句块
  const importBlockEnd = content.indexOf('\n\n')
  if (importBlockEnd === -1) return content

  const beforeImports = content.substring(0, importBlockEnd)
  const afterImports = content.substring(importBlockEnd)

  // 检查是否已有从 @/utils/logger 的导入
  if (content.includes("from '@/utils/logger'")) {
    // 添加 logger 到现有导入
    const updatedImports = beforeImports.replace(
      /(import\s*{[^}]*)(\s*}\s*from\s*['"]@\/utils\/logger['"])/,
      '$1, logger$2'
    )
    return updatedImports + afterImports
  }

  // 添加新的导入行
  const loggerImport = "import { logger } from '@/utils/logger'\n"
  return beforeImports + '\n' + loggerImport + afterImports
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  const relativePath = relative(PROJECT_ROOT, filePath)

  try {
    let content = readFileSync(filePath, 'utf-8')
    const originalContent = content
    let fileReplacements = 0
    let skipped = 0

    // 检查每一行
    const lines = content.split('\n')
    const processedLines = lines.map((line, lineIndex) => {
      let modified = line
      let lineChanged = false

      // 检查是否应该保留这行
      for (const preservePattern of PRESERVE_PATTERNS) {
        if (preservePattern.test(line)) {
          skipped++
          return line
        }
      }

      // 应用替换规则
      for (const rule of REPLACEMENTS) {
        const matches = line.match(rule.pattern)
        if (matches) {
          modified = modified.replace(rule.pattern, rule.replacement)
          stats.replacements[rule.type] += matches.length
          fileReplacements += matches.length
          lineChanged = true
        }
      }

      return modified
    })

    content = processedLines.join('\n')

    // 如果进行了替换且需要 logger 导入
    if (fileReplacements > 0 && needsLoggerImport(originalContent)) {
      content = addLoggerImport(content, filePath)
    }

    // 如果内容发生了变化，写回文件
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8')
      stats.files++
      console.log(`✓ ${relativePath} (${fileReplacements} replacements)`)
      return true
    } else if (skipped > 0) {
      stats.skipped += skipped
    }

    return false
  } catch (error) {
    console.error(`✗ Error processing ${relativePath}: ${error.message}`)
    return false
  }
}

/**
 * 递归遍历目录
 */
function traverseDirectory(dir) {
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      // 跳过 node_modules 和隐藏目录
      if (entry !== 'node_modules' && !entry.startsWith('.')) {
        traverseDirectory(fullPath)
      }
    } else if (stat.isFile() && shouldProcessFile(fullPath)) {
      processFile(fullPath)
    }
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🧹 Console.log 清理工具')
  console.log('=' .repeat(50))
  console.log(`📁 处理目录: ${TARGET_DIR}`)
  console.log('')

  if (!existsSync(TARGET_DIR)) {
    console.error(`❌ 错误: 目录不存在 ${TARGET_DIR}`)
    process.exit(1)
  }

  const startTime = Date.now()

  // 遍历并处理文件
  traverseDirectory(TARGET_DIR)

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  // 输出统计
  console.log('')
  console.log('📊 统计信息:')
  console.log(`   处理文件数: ${stats.files}`)
  console.log(`   替换总数: ${Object.values(stats.replacements).reduce((a, b) => a + b, 0)}`)
  console.log(`   - debug:   ${stats.replacements.debug}`)
  console.log(`   - info:    ${stats.replacements.info}`)
  console.log(`   - warn:    ${stats.replacements.warn}`)
  console.log(`   - error:   ${stats.replacements.error}`)
  console.log(`   - trace:   ${stats.replacements.trace}`)
  console.log(`   跳过行数: ${stats.skipped}`)
  console.log(`   用时: ${duration}s`)
  console.log('')

  if (stats.files > 0) {
    console.log('✨ 完成! 请检查更改并运行 pnpm run check:write 进行格式化')
    console.log('   运行 pnpm run typecheck 验证类型检查')
  } else {
    console.log('ℹ️  没有需要处理的文件')
  }
}

// 运行
main()
