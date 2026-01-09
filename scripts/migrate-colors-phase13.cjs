#!/usr/bin/env node

/**
 * 颜色迁移脚本 - Phase 13 (Final rgba cleanup)
 *
 * 处理剩余的可迁移 rgba 颜色
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

// Phase 13 rgba 替换映射
const RGBA_REPLACEMENTS = {
  // ==================== 功能色 ====================
  'rgba(250, 173, 20,': 'rgba(var(--hula-warning-rgb),',
  'rgba(245, 34, 45,': 'rgba(var(--hula-error-rgb),',
  'rgba(19, 152, 127,': 'rgba(var(--hula-brand-rgb),',

  // ==================== 灰度色 ====================
  'rgba(241, 241, 241,': 'rgba(var(--hula-gray-100-rgb),',
  'rgba(22, 22, 22,': 'rgba(var(--hula-gray-900-rgb),',
  'rgba(10, 20, 28,': 'rgba(var(--hula-gray-900-rgb),',
  'rgba(0, 0, 0,': 'rgba(var(--hula-black-rgb),',
  'rgba(255, 255, 255,': 'rgba(var(--hula-white-rgb),',

  // ==================== 信息色 ====================
  'rgba(96, 165, 250,': 'rgba(var(--hula-info-rgb),',

  // ==================== 保留的颜色（特殊用途）====================
  'rgba(255, 209, 255,': 'rgba(255, 209, 255,', // 粉色渐变，保留
  'rgba(130, 193, 187,': 'rgba(130, 193, 187,', // 青色渐变，保留
  'rgba(139, 92, 246,': 'rgba(139, 92, 246,',   // 紫色主题，保留
  'rgba(62, 101, 100,': 'rgba(62, 101, 100,',   // 深绿色背景，保留
  'rgba(148, 163, 184,': 'rgba(148, 163, 184,', // 冷灰色，保留
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

  // 替换 rgba 颜色（跳过保留的颜色）
  for (const [oldColor, newToken] of Object.entries(RGBA_REPLACEMENTS)) {
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
  console.log('🎨 HuLa 颜色迁移工具 - Phase 13 (Final rgba cleanup)\n');

  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors-phase13.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

Phase 13: 处理剩余的可迁移 rgba 颜色
    `);
    process.exit(0);
  }

  // 过滤出实际替换的规则
  const activeReplacements = Object.entries(RGBA_REPLACEMENTS).filter(([k, v]) => k !== v);

  console.log('🎨 Phase 13 rgba 颜色映射规则:\n');
  console.log(`rgba 颜色 (${activeReplacements.length} 个):`);
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
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): color migration phase 13 - final rgba cleanup"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
