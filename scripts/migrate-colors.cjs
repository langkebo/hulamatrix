#!/usr/bin/env node

/**
 * 颜色迁移脚本 - 将硬编码颜色替换为设计令牌
 *
 * 第一阶段：常见颜色迁移
 * - #fff → var(--hula-white)
 * - #ffffff → var(--hula-white)
 * - #333 → var(--hula-gray-900) (主要文字)
 * - #333333 → var(--hula-gray-900)
 * - #999 → var(--hula-gray-400) (次要文字)
 * - #999999 → var(--hula-gray-400)
 * - rgba(0, 0, 0, 0.05) → var(--hula-shadow-sm)
 * - rgba(0, 0, 0, 0.1) → var(--hula-shadow-md)
 * - #eee → var(--hula-gray-200) (边框)
 * - #eeeeee → var(--hula-gray-200)
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  srcDir: path.join(process.cwd(), 'src'),
  dryRun: false,
  maxFiles: 200, // 第四阶段处理200个文件
};

// 颜色映射表
const COLOR_MAP = {
  // 白色
  '#fff': 'var(--hula-white)',
  '#ffffff': 'var(--hula-white)',
  'rgba(255, 255, 255,': 'rgba(var(--hula-white-rgb),',

  // 黑色
  '#000': 'var(--hula-black)',
  '#000000': 'var(--hula-black)',
  'rgba(0, 0, 0,': 'rgba(var(--hula-black-rgb),',

  // 灰色文字
  '#333': 'var(--hula-gray-900)',
  '#333333': 'var(--hula-gray-900)',
  '#666': 'var(--hula-gray-700)',
  '#666666': 'var(--hula-gray-700)',
  '#999': 'var(--hula-gray-400)',
  '#999999': 'var(--hula-gray-400)',

  // 灰色背景/边框
  '#eee': 'var(--hula-gray-200)',
  '#eeeeee': 'var(--hula-gray-200)',
  '#f3f3f3': 'var(--hula-gray-100)',
  '#f5f5f5': 'var(--hula-gray-50)',

  // 阴影
  'rgba(0, 0, 0, 0.05)': 'var(--hula-shadow-sm)',
  'rgba(0, 0, 0, 0.1)': 'var(--hula-shadow-md)',

  // 品牌色 (如果需要)
  '#13987f': 'var(--hula-brand-primary)',
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
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
        traverse(fullPath);
      } else if (/\.(vue|scss|css)$/.test(item)) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * 迁移文件中的颜色
 */
function migrateColors(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let replacements = 0;

  // 记录原始内容
  const originalContent = content;

  // 应用颜色映射
  for (const [oldColor, newToken] of Object.entries(COLOR_MAP)) {
    const regex = new RegExp(escapeRegExp(oldColor), 'g');
    const matches = content.match(regex);

    if (matches) {
      content = content.replace(regex, newToken);
      replacements += matches.length;
      modified = true;
    }
  }

  // 如果有修改
  if (modified) {
    stats.modified++;
    stats.totalReplacements += replacements;

    console.log(`\n📝 ${relativePath}`);
    console.log(`   替换: ${replacements} 处`);

    if (CONFIG.dryRun) {
      console.log(`   [DRY-RUN] 将进行修改`);
    } else {
      // 写回文件
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`   ✅ 已应用修改`);
    }

    return true;
  }

  return false;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 主函数
 */
function main() {
  console.log('🎨 HuLa 颜色迁移工具 - 第一阶段\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

示例:
  node scripts/migrate-colors.cjs          # 执行颜色迁移
  node scripts/migrate-colors.cjs --dry-run # 预览修改

第一阶段迁移规则:
  #fff → var(--hula-white)
  #333 → var(--hula-gray-900)
  #999 → var(--hula-gray-400)
  #eee → var(--hula-gray-200)
  rgba(0, 0, 0, 0.05) → var(--hula-shadow-sm)
    `);
    process.exit(0);
  }

  // 获取文件列表
  const files = getSourceFiles(CONFIG.srcDir);
  console.log(`📁 找到 ${files.length} 个源文件`);
  console.log(`📊 第一阶段处理: 最多 ${CONFIG.maxFiles} 个文件\n`);

  console.log('🎨 颜色映射规则:');
  for (const [old, new_] of Object.entries(COLOR_MAP)) {
    console.log(`   ${old} → ${new_}`);
  }
  console.log('');

  // 处理文件
  console.log('开始处理...\n');
  console.log('─'.repeat(80) + '\n');

  let processed = 0;
  for (const file of files) {
    if (processed >= CONFIG.maxFiles) break;

    try {
      migrateColors(file);
      processed++;
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
  console.log('   2. 运行测试: pnpm test:run');
  console.log('   3. 提交修改: git add . && git commit -m "feat(uiux): migrate colors to design tokens - phase 1"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

// 运行
main();
