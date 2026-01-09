#!/usr/bin/env node

/**
 * 颜色迁移修复脚本 - 修复迁移产生的问题模式
 *
 * 修复以下问题:
 * - rgba(var(--hula-black-rgb) → rgba(var(--hula-black-rgb), 0.05)
 * - rgba(var(--hula-white-rgb) → rgba(var(--hula-white-rgb), 0.5)
 * - #444 → var(--hula-gray-700)
 * - #666 → var(--hula-gray-600)
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  srcDir: path.join(process.cwd(), 'src'),
  dryRun: false,
};

// 问题模式修复映射
const FIXES = [
  {
    pattern: /rgba\(var\(--hula-black-rgb\)\)/g,
    replacement: 'rgba(var(--hula-black-rgb), 0.1)',
    description: '不完整的 rgba 调用 (black)',
  },
  {
    pattern: /rgba\(var\(--hula-white-rgb\)\)/g,
    replacement: 'rgba(var(--hula-white-rgb), 0.1)',
    description: '不完整的 rgba 调用 (white)',
  },
  {
    pattern: /var\(--hula-white\)fff/g,
    replacement: 'var(--hula-white)',
    description: '错误的白色变量',
  },
  {
    pattern: /var\(--hula-black\)000/g,
    replacement: 'var(--hula-black)',
    description: '错误的黑色变量',
  },
  {
    pattern: /var\(--hula-gray-900\)333/g,
    replacement: 'var(--hula-gray-800)',
    description: '错误的灰色变量',
  },
  {
    pattern: /#444/g,
    replacement: 'var(--hula-gray-700)',
    description: '硬编码颜色 #444',
  },
  {
    pattern: /#666/g,
    replacement: 'var(--hula-gray-600)',
    description: '硬编码颜色 #666',
  },
  {
    pattern: /#777/g,
    replacement: 'var(--hula-gray-500)',
    description: '硬编码颜色 #777',
  },
  {
    pattern: /#888/g,
    replacement: 'var(--hula-gray-400)',
    description: '硬编码颜色 #888',
  },
];

// 统计
const stats = {
  processed: 0,
  modified: 0,
  totalFixes: 0,
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
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
          traverse(fullPath);
        } else if (/\.(vue|scss|css)$/.test(item)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // 跳过无法访问的目录
    }
  }

  traverse(dir);
  return files;
}

/**
 * 修复文件中的问题模式
 */
function fixFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fixes = 0;

  // 记录原始内容
  const originalContent = content;

  // 应用所有修复
  for (const fix of FIXES) {
    const matches = content.match(fix.pattern);
    if (matches) {
      content = content.replace(fix.pattern, fix.replacement);
      fixes += matches.length;
      modified = true;
      console.log(`  ✓ ${fix.description}: ${matches.length} 处`);
    }
  }

  // 如果有修改
  if (modified) {
    stats.modified++;
    stats.totalFixes += fixes;

    console.log(`\n📝 ${relativePath}`);
    console.log(`   修复: ${fixes} 处`);

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
 * 主函数
 */
function main() {
  console.log('🔧 HuLa 颜色迁移修复工具\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/fix-color-migration.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

示例:
  node scripts/fix-color-migration.cjs          # 执行修复
  node scripts/fix-color-migration.cjs --dry-run # 预览修复

修复的问题:
  - rgba(var(--hula-black-rgb)) → rgba(var(--hula-black-rgb), 0.1)
  - rgba(var(--hula-white-rgb)) → rgba(var(--hula-white-rgb), 0.1)
  - var(--hula-white)fff → var(--hula-white)
  - var(--hula-black)000 → var(--hula-black)
  - var(--hula-gray-900)333 → var(--hula-gray-800)
  - #444 → var(--hula-gray-700)
  - #666 → var(--hula-gray-600)
  - #777 → var(--hula-gray-500)
    `);
    process.exit(0);
  }

  console.log('🔧 修复规则:\n');
  FIXES.forEach((fix, i) => {
    console.log(`   ${i + 1}. ${fix.description}`);
  });
  console.log('\n' + '─'.repeat(80) + '\n');

  // 获取文件列表
  const files = getSourceFiles(CONFIG.srcDir);
  console.log(`📁 找到 ${files.length} 个源文件\n`);

  console.log('开始处理...\n');
  console.log('─'.repeat(80) + '\n');

  // 处理文件
  for (const file of files) {
    try {
      fixFile(file);
      stats.processed++;
    } catch (error) {
      console.error(`✗ 错误: ${file}`);
      console.error(`  ${error.message}\n`);
      stats.errors++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 修复统计\n');

  console.log(`处理文件:     ${stats.processed}`);
  console.log(`修改文件:     ${stats.modified}`);
  console.log(`修复次数:     ${stats.totalFixes}`);
  console.log(`错误:         ${stats.errors}`);

  if (CONFIG.dryRun) {
    console.log('\n💡 这是 dry-run 模式。运行不带 --dry-run 的命令来实际应用修改。');
  } else {
    console.log('\n💡 提示: 运行 `git diff` 查看修改，`git add .` 添加更改。');
  }

  console.log('\n✅ 完成!\n');

  console.log('📌 下一步:');
  console.log('   1. 检查修改: pnpm run dev');
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): fix color migration issues"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

// 运行
main();
