#!/usr/bin/env node

/**
 * HuLa UI/UX 颜色迁移脚本
 *
 * 用途：批量查找和替换硬编码的颜色值为统一的 CSS 变量
 *
 * 使用方法：
 * node scripts/migrate-colors.js [选项]
 *
 * 选项：
 *   --check     仅检查，不进行替换（默认）
 *   --fix       执行替换操作
 *   --dry-run   显示将要进行的更改但不执行
 *   --verbose   显示详细的输出
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 配置
const CONFIG = {
  rootDir: join(__dirname, '..'),
  srcDir: join(__dirname, '..', 'src'),
  // 要扫描的文件扩展名
  extensions: ['.vue', '.scss', '.css', '.ts', '.tsx', '.js', '.jsx'],
  // 要忽略的目录
  ignoreDirs: ['node_modules', 'dist', 'build', '.git', 'coverage', 'mobile'],
  // 颜色迁移映射表
  colorMappings: {
    // 旧颜色值 -> 新 CSS 变量
    '#13987f': 'var(--hula-brand-primary)',
    '#0f7d69': 'var(--hula-brand-hover)',
    '#0c6354': 'var(--hula-brand-active)',
    '#1ab292': 'var(--hula-brand-primary)',
    '#b8d4d1': 'var(--hula-brand-subtle)',
    '#64a29c': 'var(--hula-primary)',
    '#82b2ac': 'var(--hula-primary-light)',

    // 功能色
    '#00B894': 'var(--hula-success)',
    '#ff976a': 'var(--hula-warning)',
    '#ee0a24': 'var(--hula-error)',
    '#1989fa': 'var(--hula-info)',

    // 灰色
    '#f9f9f9': 'var(--hula-gray-50)',
    '#f5f5f5': 'var(--hula-gray-100)',
    '#e0e0e0': 'var(--hula-gray-200)',
    '#cccccc': 'var(--hula-gray-300)',
    '#b0b0b0': 'var(--hula-gray-400)',
    '#909090': 'var(--hula-gray-500)',
    '#707070': 'var(--hula-gray-600)',
    '#505050': 'var(--hula-gray-700)',
    '#2a2a2a': 'var(--hula-gray-800)',
    '#1a1a1a': 'var(--hula-gray-900)'
  }
}

// 命令行参数
const args = process.argv.slice(2)
const options = {
  check: !args.includes('--fix'),
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  fix: args.includes('--fix')
}

// 统计信息
const stats = {
  filesScanned: 0,
  filesWithIssues: 0,
  totalReplacements: 0,
  replacementsByFile: new Map()
}

/**
 * 递归获取目录下所有文件
 */
function getAllFiles(dir, extensions, ignoreDirs = []) {
  let files = []

  try {
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      // 跳过忽略的目录
      if (ignoreDirs.includes(entry)) {
        continue
      }

      if (stat.isDirectory()) {
        files = files.concat(getAllFiles(fullPath, extensions, ignoreDirs))
      } else if (stat.isFile()) {
        const ext = entry.slice(entry.lastIndexOf('.'))
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch {
    // 忽略无法访问的目录
  }

  return files
}

/**
 * 检查文件中的颜色值
 */
function checkFileColors(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const relativePath = relative(CONFIG.rootDir, filePath)
    const findings = []
    let replacementCount = 0

    // 检查每个颜色映射
    for (const [oldColor, newVariable] of Object.entries(CONFIG.colorMappings)) {
      // 使用正则表达式查找颜色值
      // 匹配 #13987f 或 #13987F（大小写不敏感）
      const regex = new RegExp(oldColor.replace(/[0-9a-f]/gi, '[0-9a-fA-F]'), 'gi')
      const matches = content.match(regex)

      if (matches) {
        findings.push({
          color: oldColor,
          variable: newVariable,
          count: matches.length,
          samples: matches.slice(0, 3) // 显示前 3 个示例
        })
        replacementCount += matches.length
      }
    }

    return {
      filePath,
      relativePath,
      findings,
      replacementCount
    }
  } catch (error) {
    console.error(`无法读取文件 ${filePath}:`, error.message)
    return null
  }
}

/**
 * 执行颜色替换
 */
function fixFileColors(filePath) {
  try {
    let content = readFileSync(filePath, 'utf-8')
    let hasChanges = false
    let replacementCount = 0

    // 对每个颜色映射进行替换
    for (const [oldColor, newVariable] of Object.entries(CONFIG.colorMappings)) {
      // 替换颜色值（大小写不敏感，但保留原大小写样式）
      const regex = new RegExp(oldColor.replace(/[0-9a-f]/gi, '[0-9a-fA-F]'), 'gi')
      const newContent = content.replace(regex, newVariable)

      if (newContent !== content) {
        content = newContent
        hasChanges = true
        const matches = content.match(regex)
        replacementCount += matches ? matches.length : 0
      }
    }

    if (hasChanges) {
      writeFileSync(filePath, content, 'utf-8')
      return replacementCount
    }

    return 0
  } catch (error) {
    console.error(`无法写入文件 ${filePath}:`, error.message)
    return 0
  }
}

/**
 * 打印检查结果
 */
function printResults(results) {
  console.log('\n========================================')
  console.log('🎨 HuLa 颜色迁移检查报告')
  console.log('========================================\n')

  console.log(`📊 统计信息：`)
  console.log(`   扫描文件数：${stats.filesScanned}`)
  console.log(`   存在问题文件数：${stats.filesWithIssues}`)
  console.log(`   需要替换总数：${stats.totalReplacements}\n`)

  if (results.length === 0) {
    console.log('✅ 太棒了！所有文件都使用了统一的色彩系统。')
    return
  }

  console.log(`📁 文件详情：\n`)

  results.forEach((result, index) => {
    if (result && result.findings.length > 0) {
      console.log(`${index + 1}. ${result.relativePath}`)
      console.log(`   替换数量：${result.replacementCount}`)

      if (options.verbose) {
        result.findings.forEach((finding) => {
          console.log(`   - ${finding.color} → ${finding.variable}`)
          console.log(`     示例：${finding.samples.join(', ')}${finding.samples.length < finding.count ? '...' : ''}`)
        })
      } else {
        const colors = result.findings.map((f) => f.color).join(', ')
        console.log(`   需要迁移的颜色：${colors}`)
      }

      console.log()
    }
  })

  console.log('========================================')
  console.log('💡 使用建议：')
  console.log('========================================\n')
  console.log('1. 使用 --dry-run 选项预览将要进行的更改')
  console.log('   node scripts/migrate-colors.js --dry-run\n')

  console.log('2. 使用 --fix 选项执行颜色迁移')
  console.log('   node scripts/migrate-colors.js --fix\n')

  console.log('3. 使用 --verbose 选项查看详细信息')
  console.log('   node scripts/migrate-colors.js --verbose\n')
}

/**
 * 主函数
 */
function main() {
  console.log('\n🔍 HuLa UI/UX 颜色迁移工具\n')
  console.log('模式：', options.fix ? '执行迁移' : '检查模式')
  console.log('详细：', options.verbose ? '是' : '否')
  console.log('模拟：', options.dryRun ? '是' : '否')

  // 获取所有文件
  console.log('\n📂 扫描文件中...')
  const files = getAllFiles(CONFIG.srcDir, CONFIG.extensions, CONFIG.ignoreDirs)
  stats.filesScanned = files.length

  // 检查或修复文件
  console.log('🔍 分析颜色使用...\n')
  const results = files.map((filePath) => checkFileColors(filePath))

  // 统计结果
  results.forEach((result) => {
    if (result && result.replacementCount > 0) {
      stats.filesWithIssues++
      stats.totalReplacements += result.replacementCount
      stats.replacementsByFile.set(result.relativePath, result.replacementCount)
    }
  })

  // 打印检查结果
  printResults(results.filter((r) => r && r.findings.length > 0))

  // 执行修复
  if (options.fix && !options.dryRun) {
    console.log('🔧 执行颜色迁移...\n')

    let totalReplaced = 0
    results.forEach((result) => {
      if (result && result.replacementCount > 0) {
        const count = fixFileColors(result.filePath)
        if (count > 0) {
          console.log(`✅ ${result.relativePath}: ${count} 处替换`)
          totalReplaced += count
        }
      }
    })

    console.log(`\n✅ 完成！共替换 ${totalReplaced} 处颜色值。`)
    console.log('💡 建议运行 git diff 查看更改内容。')
  }

  // 模拟运行
  if (options.dryRun && options.fix) {
    console.log('\n📋 模拟运行 - 不会实际修改文件')
    console.log(`将要替换 ${stats.totalReplacements} 处颜色值`)
  }
}

// 运行主函数
main()
