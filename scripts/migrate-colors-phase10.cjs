#!/usr/bin/env node

/**
 * 颜色迁移脚本 - Phase 10 (Final Phase)
 *
 * 处理最后的可迁移硬编码颜色
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

// Phase 10 颜色替换映射
const COLOR_REPLACEMENTS = {
  // ==================== 灰度色 ====================
  '#909090': 'var(--hula-gray-400)',
  '#373838': 'var(--hula-gray-700)',
  '#f3f4f6': 'var(--hula-gray-100)',
  '#e8e8e8': 'var(--hula-gray-200)',
  '#e5e7eb': 'var(--hula-gray-200)',
  '#d9d9d9': 'var(--hula-gray-300)',
  '#d1d5db': 'var(--hula-gray-300)',
  '#9ca3af': 'var(--hula-gray-400)',
  '#909399': 'var(--hula-gray-400)',
  '#717171': 'var(--hula-gray-600)',
  '#707070': 'var(--hula-gray-600)',
  '#c0c0c0': 'var(--hula-gray-300)',
  '#FAFAFA': 'var(--hula-gray-50)',
  '#fafafa': 'var(--hula-gray-50)',
  '#a8a8a8': 'var(--hula-gray-400)',
  '#c1c1c1': 'var(--hula-gray-300)',
  '#f1f1f1': 'var(--hula-gray-100)',
  '#e6f7ff': 'rgba(var(--hula-info-rgb), 0.1)', // 浅蓝色背景
  '#303030': 'var(--hula-gray-800)',
  '#4e4e4e': 'var(--hula-gray-700)',
  '#b45309': 'var(--hula-warning)',

  // ==================== 功能色 ====================
  '#07c160': 'var(--hula-success)', // 微信绿
  '#14997E': 'var(--hula-brand-primary)', // 品牌色变体
  '#1aaa55': 'var(--hula-success)',
  '#f56c6c': 'var(--hula-error)',
  '#0050b3': 'var(--hula-info)',

  // ==================== 白色 ====================
  '#ffffff': 'var(--hula-white)',
};

// rgba 替换映射
const RGBA_REPLACEMENTS = {
  'rgba(74, 74, 74,': 'rgba(var(--hula-gray-700-rgb),',
  'rgba(42, 42, 42,': 'rgba(var(--hula-gray-800-rgb),',
  'rgba(100, 162, 156,': 'rgba(var(--hula-brand-rgb),',
  'rgba(0, 184, 148,': 'rgba(var(--hula-success-rgb),',
  'rgba(82, 196, 26,': 'rgba(var(--hula-success-rgb),',
  'rgba(51, 136, 255,': 'rgba(var(--hula-info-rgb),',
  'rgba(36, 36, 40,': 'rgba(var(--hula-gray-900-rgb),',
  'rgba(30, 30, 30,': 'rgba(var(--hula-gray-900-rgb),',
  'rgba(0, 0, 0,': 'rgba(var(--hula-black-rgb),',
  'rgba(255, 255, 255,': 'rgba(var(--hula-white-rgb),',
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
  console.log('🎨 HuLa 颜色迁移工具 - Phase 10 (Final Phase)\n');

  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors-phase10.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

Phase 10 (Final Phase): 处理最后的可迁移颜色
  - 灰度色 #909090, #373838 等
  - 功能色 #07c160, #f56c6c 等
  - rgba 值 rgba(74, 74, 74, 等
    `);
    process.exit(0);
  }

  console.log('🎨 Phase 10 颜色映射规则:\n');
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
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): color migration phase 10 - final phase"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
