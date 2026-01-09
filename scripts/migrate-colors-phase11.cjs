#!/usr/bin/env node

/**
 * 颜色迁移脚本 - Phase 11
 *
 * 处理剩余的可迁移颜色（品牌变体、更多灰度、功能色）
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

// Phase 11 颜色替换映射
const COLOR_REPLACEMENTS = {
  // ==================== 品牌色变体 ====================
  '#13987f': 'var(--hula-brand-primary)',
  '#13987F': 'var(--hula-brand-primary)',
  '#0f7d69': 'var(--hula-brand-hover)',
  '#0f7e6a': 'var(--hula-brand-hover)',
  '#0c6354': 'var(--hula-brand-active)',
  '#1ab292': 'var(--hula-success)',
  '#1ec29f': 'var(--hula-success)',
  '#1A9B83': 'var(--hula-brand-primary)',
  '#398D7E': 'var(--hula-brand-primary)',
  '#2DA38D': 'var(--hula-brand-primary)',
  '#64a29c': 'var(--hula-success)',
  '#6B9C89': 'var(--hula-brand-primary)',
  '#6fb0a4': 'var(--hula-success)',
  '#7eb7ac': 'var(--hula-success)',
  '#5fa89c': 'var(--hula-brand-primary)',

  // ==================== 灰度色 ====================
  // 深灰/黑
  '#111819': 'var(--hula-gray-900)',
  '#1a1a1a': 'var(--hula-gray-900)',
  '#505050': 'var(--hula-gray-600)',
  '#3d3d3d': 'var(--hula-gray-700)',
  '#2d2d2d': 'var(--hula-gray-800)',
  '#242424': 'var(--hula-gray-800)',
  '#374151': 'var(--hula-gray-700)',
  '#1f2937': 'var(--hula-gray-800)',
  '#18212c': 'var(--hula-gray-900)',
  '#606060': 'var(--hula-gray-600)',
  '#4d4d4d': 'var(--hula-gray-700)',
  '#4a4a4a': 'var(--hula-gray-700)',
  '#404040': 'var(--hula-gray-700)',
  '#3a3a3a': 'var(--hula-gray-700)',
  '#343434': 'var(--hula-gray-700)',
  '#333333': 'var(--hula-gray-700)',
  '#111': 'var(--hula-gray-900)',
  '#000000': 'var(--hula-black)',

  // 浅灰
  '#f3f4f6': 'var(--hula-gray-100)',
  '#f9fafb': 'var(--hula-gray-50)',
  '#e5e7eb': 'var(--hula-gray-200)',
  '#d1d5db': 'var(--hula-gray-300)',
  '#9ca3af': 'var(--hula-gray-400)',
  '#6b7280': 'var(--hula-gray-500)',
  '#4b5563': 'var(--hula-gray-600)',

  // 其他灰度
  '#f5f5f5': 'var(--hula-gray-100)',
  '#e3e3e3': 'var(--hula-gray-200)',
  '#dcdee0': 'var(--hula-gray-300)',
  '#dcdde0': 'var(--hula-gray-300)',
  '#c8c9cc': 'var(--hula-gray-400)',
  '#c0c4cc': 'var(--hula-gray-400)',
  '#9fa1a9': 'var(--hula-gray-400)',

  // ==================== 功能色 ====================
  // 蓝色/信息色
  '#1989fa': 'var(--hula-info)',
  '#2080f0': 'var(--hula-info)',
  '#3b82f6': 'var(--hula-info)',
  '#576b95': 'var(--hula-info)',

  // 橙色/警告色
  '#ff976a': 'var(--hula-warning)',
  '#fa8c16': 'var(--hula-warning)',
  '#f97316': 'var(--hula-warning)',
  '#f59e0b': 'var(--hula-warning)',
  '#eab308': 'var(--hula-warning)',
  '#d46b08': 'var(--hula-warning)',
  '#fdcb6e': 'var(--hula-warning)',
  '#ffd591': 'var(--hula-warning)',

  // 红色/错误色
  '#ee0a24': 'var(--hula-error)',
  '#ff4757': 'var(--hula-error)',
  '#ef4444': 'var(--hula-error)',
  '#d5304f': 'var(--hula-error)',
  '#c14053': 'var(--hula-error)',
  '#f54a5f': 'var(--hula-error)',
  '#f5576c': 'var(--hula-error)',
  '#d5304f': 'var(--hula-error)',

  // 绿色/成功色
  '#079669': 'var(--hula-success)',
  '#22c55e': 'var(--hula-success)',
  '#10b981': 'var(--hula-success)',
  '#389e0d': 'var(--hula-success)',
  '#b7eb8f': 'var(--hula-success)',
  '#f6ffed': 'rgba(var(--hula-success-rgb), 0.1)',
  '#f0fdf9': 'rgba(var(--hula-success-rgb), 0.1)',
  '#e6f7ef': 'rgba(var(--hula-success-rgb), 0.1)',

  // ==================== 白色 ====================
  '#ffffff': 'var(--hula-white)',
  '#fefefe': 'var(--hula-white)',
  '#fdfdfd': 'var(--hula-white)',

  // ==================== 特殊颜色（保留或特殊处理）====================
  // 青绿色系
  '#43e97b': '#43e97b', // 渐变色，保留
  '#38f9d7': '#38f9d7', // 渐变色，保留
  '#00cec9': '#00cec9', // 渐变色，保留
  '#00f2fe': '#00f2fe', // 渐变色，保留
  '#4facfe': '#4facfe', // 渐变色，保留

  // 紫色系
  '#8b5cf6': '#8b5cf6', // 紫色主题，保留
  '#7c4dff': '#7c4dff', // 紫色主题，保留
  '#a29bfe': '#a29bfe', // 紫色主题，保留
  '#764ba2': '#764ba2', // 紫色渐变，保留
  '#667eea': '#667eea', // 紫蓝渐变，保留
  '#f093fb': '#f093fb', // 渐变色，保留
  '#fa709a': '#fa709a', // 渐变色，保留
};

// rgba 替换映射
const RGBA_REPLACEMENTS = {
  // 品牌色
  'rgba(19, 152, 127,': 'rgba(var(--hula-brand-rgb),',
  'rgba(15, 125, 105,': 'rgba(var(--hula-brand-hover-rgb),',

  // 成功色
  'rgba(26, 178, 146,': 'rgba(var(--hula-success-rgb),',

  // 紫色（保留）
  'rgba(139, 92, 246,': 'rgba(139, 92, 246,',
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

  // 替换 rgba 颜色
  for (const [oldColor, newToken] of Object.entries(RGBA_REPLACEMENTS)) {
    if (oldColor === newToken) {
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
  console.log('🎨 HuLa 颜色迁移工具 - Phase 11\n');

  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors-phase11.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

Phase 11: 处理品牌变体、更多灰度、功能色
  - 品牌色变体 (#1A9B83, #398D7E 等)
  - 更多灰度色 (#111819, #374151 等)
  - 功能色 (#1989fa, #ff976a, #ee0a24 等)
  - 绿色/成功色 (#079669, #22c55e 等)
    `);
    process.exit(0);
  }

  // 过滤出实际替换的规则
  const activeHexReplacements = Object.entries(COLOR_REPLACEMENTS).filter(([k, v]) => k !== v);
  const activeRgbaReplacements = Object.entries(RGBA_REPLACEMENTS).filter(([k, v]) => k !== v);

  console.log('🎨 Phase 11 颜色映射规则:\n');
  console.log(`十六进制颜色 (${activeHexReplacements.length} 个):`);
  activeHexReplacements.slice(0, 20).forEach(([old, new_]) => {
    console.log(`   ${old} → ${new_}`);
  });
  if (activeHexReplacements.length > 20) {
    console.log(`   ... 还有 ${activeHexReplacements.length - 20} 个`);
  }
  console.log(`\nrgba 颜色 (${activeRgbaReplacements.length} 个):`);
  activeRgbaReplacements.forEach(([old, new_]) => {
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
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): color migration phase 11 - brand variants and more"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
