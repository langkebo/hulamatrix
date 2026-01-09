#!/usr/bin/env node

/**
 * 颜色迁移脚本 - Phase 12
 *
 * 处理遗漏的颜色（包括大小写敏感和特殊上下文）
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

// Phase 12 颜色替换映射（包括大小写变体）
const COLOR_REPLACEMENTS = {
  // ==================== 白色 ====================
  '#ffffff': 'var(--hula-white)',
  '#FFFFFF': 'var(--hula-white)',
  '#fff': 'var(--hula-white)',
  '#FFF': 'var(--hula-white)',

  // ==================== 黑色/深灰 ====================
  '#000000': 'var(--hula-black)',
  '#000': 'var(--hula-black)',
  '#111819': 'var(--hula-gray-900)',
  '#1a1a1a': 'var(--hula-gray-900)',
  '#1A1A1A': 'var(--hula-gray-900)',
  '#2d2d2d': 'var(--hula-gray-800)',
  '#2D2D2D': 'var(--hula-gray-800)',
  '#3d3d3d': 'var(--hula-gray-700)',
  '#3D3D3D': 'var(--hula-gray-700)',

  // ==================== 灰度色 ====================
  '#f3f4f6': 'var(--hula-gray-100)',
  '#f9fafb': 'var(--hula-gray-50)',
  '#f5f5f5': 'var(--hula-gray-100)',
  '#e5e7eb': 'var(--hula-gray-200)',
  '#d1d5db': 'var(--hula-gray-300)',
  '#ebedf0': 'var(--hula-gray-200)',
  '#9ca3af': 'var(--hula-gray-400)',
  '#6b7280': 'var(--hula-gray-500)',
  '#4b5563': 'var(--hula-gray-600)',

  // ==================== 品牌色 ====================
  '#13987f': 'var(--hula-brand-primary)',
  '#13987F': 'var(--hula-brand-primary)',
  '#0f7d69': 'var(--hula-brand-hover)',
  '#0f7D69': 'var(--hula-brand-hover)',

  // ==================== 功能色 ====================
  '#f59e0b': 'var(--hula-warning)',
  '#f0fdf9': 'rgba(var(--hula-success-rgb), 0.1)',

  // ==================== 特殊浅色背景 ====================
  '#E7EFE6': 'rgba(var(--hula-success-rgb), 0.05)',
  '#E5EFEE': 'rgba(var(--hula-success-rgb), 0.05)',
  '#EFF5F4': 'rgba(var(--hula-success-rgb), 0.05)',
  '#EEF4F3': 'rgba(var(--hula-success-rgb), 0.05)',

  // ==================== 渐变色（保留）====================
  '#667eea': '#667eea', // 紫蓝渐变
  '#764ba2': '#764ba2', // 紫色渐变
  '#fa709a': '#fa709a', // 粉红渐变
  '#f093fb': '#f093fb', // 紫粉渐变
  '#feedba': '#feedba', // 渐变
  '#fee140': '#fee140', // 渐变
  '#ffccc7': '#ffccc7', // 渐变
  '#ffb88a': '#ffb88a', // 渐变
  '#ff9a9e': '#ff9a9e', // 渐变
};

// 统计
const stats = {
  processed: 0,
  modified: 0,
  totalReplacements: 0,
  skipped: 0,
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
      // Skip
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

  // 替换十六进制颜色（跳过保留的颜色）
  for (const [oldColor, newToken] of Object.entries(COLOR_REPLACEMENTS)) {
    // 如果新值与旧值相同，说明是保留的颜色，跳过
    if (oldColor === newToken) {
      stats.skipped++;
      continue;
    }

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
  console.log('🎨 HuLa 颜色迁移工具 - Phase 12\n');

  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors-phase12.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

Phase 12: 处理遗漏的颜色（大小写敏感和特殊上下文）
    `);
    process.exit(0);
  }

  // 过滤出实际替换的规则
  const activeReplacements = Object.entries(COLOR_REPLACEMENTS).filter(([k, v]) => k !== v);

  console.log('🎨 Phase 12 颜色映射规则:\n');
  console.log(`颜色 (${activeReplacements.length} 个):`);
  activeReplacements.forEach(([old, new_]) => {
    console.log(`   ${old} → ${new_}`);
  });
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
  console.log(`跳过保留色:   ${stats.skipped} 次`);
  console.log(`错误:         ${stats.errors}`);

  if (CONFIG.dryRun) {
    console.log('\n💡 这是 dry-run 模式。运行不带 --dry-run 的命令来实际应用修改。');
  } else {
    console.log('\n💡 提示: 运行 `git diff` 查看修改，`git add .` 添加更改。');
  }

  console.log('\n✅ 完成!\n');

  console.log('📌 下一步:');
  console.log('   1. 检查修改: pnpm run dev');
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): color migration phase 12 - missed colors"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
