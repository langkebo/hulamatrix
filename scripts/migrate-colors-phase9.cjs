#!/usr/bin/env node

/**
 * 颜色迁移脚本 - Phase 9
 *
 * 处理剩余的十六进制颜色和特殊 rgba 值
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  srcDir: path.join(process.cwd(), 'src'),
  dryRun: false,
  excludePatterns: [
    /tokens\/_colors-unified\.scss$/,
    /node_modules/,
    /\.git/,
  ],
};

// Phase 9 颜色映射
const PHASE9_COLORS = [
  // ==================== 功能色（十六进制） ====================
  // 错误/红色
  '#d03050', // Naive UI 错误色
  '#ff4d4f',
  '#ff0000',

  // 成功/绿色
  '#18a058', // Naive UI 成功色
  '#52c41a',

  // 警告/橙色
  '#f0a020', // Naive UI 警告色
  '#faad14',
  '#ff9800',

  // 信息/蓝色
  '#0958d9',
  '#1890ff',
  '#18a058',

  // ==================== 灰度色（十六进制） ====================
  '#f0f0f0', // 浅灰 - → var(--hula-gray-100)
  '#dfdfdf', // 浅灰 - → var(--hula-gray-200)
  '#e0e0e0', // 灰色 - → var(--hula-gray-200)
  '#d0d0d0', // 灰色 - → var(--hula-gray-300)
  '#ebebeb', // 浅灰 - → var(--hula-gray-200)
  '#f7f8fa', // 极浅灰 - → var(--hula-gray-50)
  '#6E6E6E', // 中灰 - → var(--hula-gray-500)
  '#969799', // 中灰 - → var(--hula-gray-400)
  '#757775', // 中灰 - → var(--hula-gray-500)

  // ==================== 蓝色系 ====================
  '#91d5ff', // 浅蓝 - → var(--hula-info) 或保留

  // ==================== 白色 ====================
  '#FFFFFF',
  '#ffffff',

  // ==================== rgba 特殊值 ====================
  // 绿色系
  'rgba(24, 160, 88,', // → rgba(var(--hula-success-rgb),
  'rgba(16, 185, 129,', // → rgba(var(--hula-success-rgb),

  // 橙色系
  'rgba(240, 160, 32,', // → rgba(var(--hula-warning-rgb),

  // 红色系
  'rgba(208, 48, 80,', // → rgba(var(--hula-error-rgb),
  'rgba(255, 77, 79,', // → rgba(var(--hula-error-rgb),

  // 蓝色系
  'rgba(24, 144, 255,', // → rgba(var(--hula-info-rgb),

  // 灰色系
  'rgba(70, 70, 70,', // → rgba(var(--hula-gray-600-rgb),
];

// 颜色替换映射
const COLOR_REPLACEMENTS = {
  // 功能色
  '#d03050': 'var(--hula-error)',
  '#ff4d4f': 'var(--hula-error)',
  '#ff0000': 'var(--hula-error)',
  '#18a058': 'var(--hula-success)',
  '#52c41a': 'var(--hula-success)',
  '#f0a020': 'var(--hula-warning)',
  '#faad14': 'var(--hula-warning)',
  '#ff9800': 'var(--hula-warning)',
  '#0958d9': 'var(--hula-info)',
  '#1890ff': 'var(--hula-info)',

  // 灰度色
  '#f0f0f0': 'var(--hula-gray-100)',
  '#dfdfdf': 'var(--hula-gray-200)',
  '#e0e0e0': 'var(--hula-gray-200)',
  '#d0d0d0': 'var(--hula-gray-300)',
  '#ebebeb': 'var(--hula-gray-200)',
  '#f7f8fa': 'var(--hula-gray-50)',
  '#6E6E6E': 'var(--hula-gray-500)',
  '#969799': 'var(--hula-gray-400)',
  '#757775': 'var(--hula-gray-500)',

  // 蓝色
  '#91d5ff': 'var(--hula-info)',

  // 白色
  '#FFFFFF': 'var(--hula-white)',
  '#ffffff': 'var(--hula-white)',
};

// rgba 替换映射
const RGBA_REPLACEMENTS = {
  'rgba(24, 160, 88,': 'rgba(var(--hula-success-rgb),',
  'rgba(16, 185, 129,': 'rgba(var(--hula-success-rgb),',
  'rgba(240, 160, 32,': 'rgba(var(--hula-warning-rgb),',
  'rgba(208, 48, 80,': 'rgba(var(--hula-error-rgb),',
  'rgba(255, 77, 79,': 'rgba(var(--hula-error-rgb),',
  'rgba(24, 144, 255,': 'rgba(var(--hula-info-rgb),',
  'rgba(70, 70, 70,': 'rgba(var(--hula-gray-600-rgb),',
};

// 统计
const stats = {
  processed: 0,
  modified: 0,
  totalReplacements: 0,
  errors: 0,
};

/**
 * 获取所有 Vue/SCSS 文件
 */
function getSourceFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const relativePath = path.relative(process.cwd(), fullPath);

        const shouldExclude = CONFIG.excludePatterns.some(pattern =>
          pattern.test(relativePath) || pattern.test(fullPath) || pattern.test(item)
        );

        if (shouldExclude) continue;

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
          traverse(fullPath);
        } else if (/\.(vue|scss|css)$/.test(item)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  traverse(dir);
  return files;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 迁移文件中的颜色
 */
function migrateColors(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let replacements = 0;

  const originalContent = content;

  // 替换十六进制颜色
  for (const [oldColor, newToken] of Object.entries(COLOR_REPLACEMENTS)) {
    const regex = new RegExp(escapeRegExp(oldColor), 'g');
    const matches = content.match(regex);

    if (matches) {
      content = content.replace(regex, newToken);
      replacements += matches.length;
      modified = true;
    }
  }

  // 替换 rgba 颜色
  for (const [oldColor, newToken] of Object.entries(RGBA_REPLACEMENTS)) {
    const regex = new RegExp(escapeRegExp(oldColor), 'g');
    const matches = content.match(regex);

    if (matches) {
      content = content.replace(regex, newToken);
      replacements += matches.length;
      modified = true;
    }
  }

  if (modified) {
    stats.modified++;
    stats.totalReplacements += replacements;

    console.log(`\n📝 ${relativePath}`);
    console.log(`   替换: ${replacements} 处`);

    if (CONFIG.dryRun) {
      console.log(`   [DRY-RUN] 将进行修改`);
    } else {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`   ✅ 已应用修改`);
    }

    return true;
  }

  return false;
}

/**
 * 主函数
 */
function main() {
  console.log('🎨 HuLa 颜色迁移工具 - Phase 9\n');

  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors-phase9.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

Phase 9 迁移规则:
  - 十六进制功能色 (#d03050 → var(--hula-error))
  - 十六进制灰度色 (#f0f0f0 → var(--hula-gray-100))
  - rgba 特殊值 (rgba(24, 160, 88, → rgba(var(--hula-success-rgb),)
    `);
    process.exit(0);
  }

  console.log('🎨 Phase 9 颜色映射规则:\n');
  console.log('十六进制颜色:');
  for (const [old, new_] of Object.entries(COLOR_REPLACEMENTS)) {
    console.log(`   ${old} → ${new_}`);
  }
  console.log('\nrgba 颜色:');
  for (const [old, new_] of Object.entries(RGBA_REPLACEMENTS)) {
    console.log(`   ${old} → ${new_}`);
  }
  console.log('\n' + '─'.repeat(80) + '\n');

  const files = getSourceFiles(CONFIG.srcDir);
  console.log(`📁 找到 ${files.length} 个源文件\n`);

  console.log('开始处理...\n');
  console.log('─'.repeat(80) + '\n');

  for (const file of files) {
    try {
      migrateColors(file);
      stats.processed++;
    } catch (error) {
      console.error(`✗ 错误: ${file}`);
      console.error(`  ${error.message}\n`);
      stats.errors++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 迁移统计\n');

  console.log(`处理文件:     ${stats.processed}`);
  console.log(`修改文件:     ${stats.modified}`);
  console.log(`替换次数:     ${stats.totalReplacements}`);
  console.log(`错误:         ${stats.errors}`);

  if (CONFIG.dryRun) {
    console.log('\n💡 这是 dry-run 模式。运行不带 --dry-run 的命令来实际应用修改。');
  } else {
    console.log('\n💡 提示: 运行 `git diff` 查看修改，`git add .` 添加更改。');
  }

  console.log('\n✅ 完成!\n');

  console.log('📌 下一步:');
  console.log('   1. 检查修改: pnpm run dev');
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): color migration phase 9 - hex and special rgba"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
