#!/usr/bin/env node

/**
 * 高级颜色迁移脚本 - 处理复杂的颜色模式
 *
 * 处理以下模式:
 * - rgba(var(--hula-xxx-rgb)) → 完整形式
 * - rgba(r, g, b, a) → 使用设计令牌的rgb
 * - 复杂的rgba颜色值
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

// 高级颜色修复规则
const ADVANCED_FIXES = [
  // 修复不完整的 rgba 调用
  {
    pattern: /rgba\(var\(--hula-black-rgb\)\s*\)/g,
    replacement: 'rgba(var(--hula-black-rgb), 0.1)',
    description: '修复不完整的黑色 rgba',
  },
  {
    pattern: /rgba\(var\(--hula-white-rgb\)\s*\)/g,
    replacement: 'rgba(var(--hula-white-rgb), 0.1)',
    description: '修复不完整的白色 rgba',
  },
  {
    pattern: /rgba\(var\(--hula-brand-rgb\)\s*\)/g,
    replacement: 'rgba(var(--hula-brand-rgb), 0.1)',
    description: '修复不完整的品牌色 rgba',
  },
  {
    pattern: /rgba\(var\(--hula-gray-([0-9]+)-rgb\)\s*\)/g,
    replacement: 'rgba(var(--hula-gray-$1-rgb), 0.1)',
    description: '修复不完整的灰色 rgba',
  },

  // rgba 颜色值替换
  {
    pattern: /rgba\(\s*19\s*,\s*152\s*,\s*127\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-brand-rgb), $1)',
    description: '品牌色 rgba(19, 152, 127, a)',
  },
  {
    pattern: /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-white-rgb), $1)',
    description: '白色 rgba(255, 255, 255, a)',
  },
  {
    pattern: /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-black-rgb), $1)',
    description: '黑色 rgba(0, 0, 0, a)',
  },
  {
    pattern: /rgba\(\s*33\s*,\s*33\s*,\s*33\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-800-rgb), $1)',
    description: '深灰 rgba(33, 33, 33, a)',
  },
  {
    pattern: /rgba\(\s*51\s*,\s*51\s*,\s*51\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-700-rgb), $1)',
    description: '深灰 rgba(51, 51, 51, a)',
  },
  {
    pattern: /rgba\(\s*90\s*,\s*90\s*,\s*90\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-500-rgb), $1)',
    description: '中灰 rgba(90, 90, 90, a)',
  },
  {
    pattern: /rgba\(\s*102\s*,\s*102\s*,\s*102\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-500-rgb), $1)',
    description: '中灰 rgba(102, 102, 102, a)',
  },
  {
    pattern: /rgba\(\s*144\s*,\s*144\s*,\s*144\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-400-rgb), $1)',
    description: '浅灰 rgba(144, 144, 144, a)',
  },
  {
    pattern: /rgba\(\s*217\s*,\s*217\s*,\s*217\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-300-rgb), $1)',
    description: '浅灰 rgba(217, 217, 217, a)',
  },
  {
    pattern: /rgba\(\s*239\s*,\s*239\s*,\s*239\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-200-rgb), $1)',
    description: '浅灰 rgba(239, 239, 239, a)',
  },

  // 十六进制颜色
  {
    pattern: /#222/gi,
    replacement: 'var(--hula-gray-800)',
    description: '深灰 #222',
  },
  {
    pattern: /#ccc/gi,
    replacement: 'var(--hula-gray-300)',
    description: '浅灰 #ccc',
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
        const relativePath = path.relative(process.cwd(), fullPath);

        // 检查是否在排除列表中
        const shouldExclude = CONFIG.excludePatterns.some(pattern =>
          pattern.test(relativePath) || pattern.test(fullPath) || pattern.test(item)
        );

        if (shouldExclude) {
          continue;
        }

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
 * 修复文件中的颜色问题
 */
function fixFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fixes = 0;

  // 记录原始内容
  const originalContent = content;

  // 应用所有修复
  for (const fix of ADVANCED_FIXES) {
    const matches = content.match(fix.pattern);
    if (matches) {
      content = content.replace(fix.pattern, fix.replacement);
      fixes += matches.length;
      modified = true;
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
  console.log('🔧 HuLa 高级颜色迁移工具\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors-advanced.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

示例:
  node scripts/migrate-colors-advanced.cjs          # 执行修复
  node scripts/migrate-colors-advanced.cjs --dry-run # 预览修复

修复的问题:
  - 不完整的 rgba 调用
  - rgba(r,g,b,a) → rgba(var(--xxx-rgb), a)
  - 复杂颜色值替换
    `);
    process.exit(0);
  }

  console.log('🔧 高级修复规则:\n');
  ADVANCED_FIXES.forEach((fix, i) => {
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
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): advanced color migration fixes"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

// 运行
main();
