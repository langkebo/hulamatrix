#!/usr/bin/env node

/**
 * 全面颜色迁移脚本 - 处理 CSS 变量和主题色
 *
 * Phase 8: 处理 CSS 变量中的硬编码 rgba 值
 * - 主题相关颜色变量
 * - 灰度色阶
 * - 功能色（成功、警告、错误、信息）
 * - box-shadow 中的颜色
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

// 全面颜色修复规则
const COMPREHENSIVE_FIXES = [
  // ==================== 灰度色 rgba ====================
  {
    pattern: /rgba\(\s*99\s*,\s*99\s*,\s*99\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-600-rgb), $1)',
    description: '灰色 rgba(99, 99, 99, a)',
  },
  {
    pattern: /rgba\(\s*133\s*,\s*133\s*,\s*133\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-500-rgb), $1)',
    description: '灰色 rgba(133, 133, 133, a)',
  },
  {
    pattern: /rgba\(\s*166\s*,\s*166\s*,\s*166\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-400-rgb), $1)',
    description: '灰色 rgba(166, 166, 166, a)',
  },
  {
    pattern: /rgba\(\s*193\s*,\s*193\s*,\s*193\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-300-rgb), $1)',
    description: '灰色 rgba(193, 193, 193, a)',
  },
  {
    pattern: /rgba\(\s*222\s*,\s*222\s*,\s*222\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-200-rgb), $1)',
    description: '灰色 rgba(222, 222, 222, a)',
  },
  {
    pattern: /rgba\(\s*229\s*,\s*229\s*,\s*229\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-200-rgb), $1)',
    description: '灰色 rgba(229, 229, 229, a)',
  },
  {
    pattern: /rgba\(\s*244\s*,\s*244\s*,\s*244\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-100-rgb), $1)',
    description: '灰色 rgba(244, 244, 244, a)',
  },

  // ==================== 冷灰色 (Slate) ====================
  {
    pattern: /rgba\(\s*148\s*,\s*163\s*,\s*184\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(148, 163, 184, $1)', // 保留原值，或使用 slate-400
    description: '冷灰色 rgba(148, 163, 184, a)',
    skip: true, // 跳过，使用特殊变量
  },

  // ==================== 品牌色变体 ====================
  {
    pattern: /rgba\(\s*0\s*,\s*191\s*,\s*165\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-success-rgb), $1)',
    description: '青绿色 rgba(0, 191, 165, a)',
  },
  {
    pattern: /rgba\(\s*26\s*,\s*178\s*,\s*146\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-brand-rgb), $1)',
    description: '品牌色变体 rgba(26, 178, 146, a)',
  },
  {
    pattern: /rgba\(\s*62\s*,\s*101\s*,\s*100\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(62, 101, 100, $1)', // 深绿色背景
    description: '深绿色 rgba(62, 101, 100, a)',
    skip: true, // 保留为特殊背景色
  },
  {
    pattern: /rgba\(\s*105\s*,\s*187\s*,\s*157\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-success-rgb), $1)',
    description: '浅绿色 rgba(105, 187, 157, a)',
  },
  {
    pattern: /rgba\(\s*130\s*,\s*193\s*,\s*187\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(130, 193, 187, $1)', // 青色渐变
    description: '青色 rgba(130, 193, 187, a)',
    skip: true, // 保留为渐变色
  },

  // ==================== 功能色 ====================
  // 成功色
  {
    pattern: /rgba\(\s*16\s*,\s*185\s*,\s*129\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-success-rgb), $1)',
    description: '成功色 rgba(16, 185, 129, a)',
  },

  // 警告色
  {
    pattern: /rgba\(\s*245\s*,\s*158\s*,\s*11\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-warning-rgb), $1)',
    description: '警告色 rgba(245, 158, 11, a)',
  },

  // 错误/危险色
  {
    pattern: /rgba\(\s*193\s*,\s*64\s*,\s*83\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-error-rgb), $1)',
    description: '错误色 rgba(193, 64, 83, a)',
  },
  {
    pattern: /rgba\(\s*220\s*,\s*38\s*,\s*38\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-error-rgb), $1)',
    description: '危险色 rgba(220, 38, 38, a)',
  },
  {
    pattern: /rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-error-rgb), $1)',
    description: '错误色 rgba(239, 68, 68, a)',
  },

  // 信息色
  {
    pattern: /rgba\(\s*59\s*,\s*130\s*,\s*246\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-info-rgb), $1)',
    description: '信息色 rgba(59, 130, 246, a)',
  },
  {
    pattern: /rgba\(\s*96\s*,\s*165\s*,\s*250\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(96, 165, 250, $1)', // 蓝色渐变
    description: '浅蓝色 rgba(96, 165, 250, a)',
    skip: true, // 保留为渐变色
  },
  {
    pattern: /rgba\(\s*147\s*,\s*197\s*,\s*253\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(147, 197, 253, $1)', // 蓝色渐变
    description: '浅蓝色 rgba(147, 197, 253, a)',
    skip: true, // 保留为渐变色
  },

  // ==================== 紫色主题 ====================
  {
    pattern: /rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(139, 92, 246, $1)', // 紫色主题
    description: '紫色 rgba(139, 92, 246, a)',
    skip: true, // 保留为紫色主题色
  },
  {
    pattern: /rgba\(\s*167\s*,\s*139\s*,\s*250\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(167, 139, 250, $1)',
    description: '浅紫色 rgba(167, 139, 250, a)',
    skip: true,
  },
  {
    pattern: /rgba\(\s*196\s*,\s*181\s*,\s*253\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(196, 181, 253, $1)',
    description: '浅紫色 rgba(196, 181, 253, a)',
    skip: true,
  },

  // ==================== 特殊颜色 ====================
  {
    pattern: /rgba\(\s*255\s*,\s*209\s*,\s*255\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(255, 209, 255, $1)', // 粉色渐变
    description: '粉色 rgba(255, 209, 255, a)',
    skip: true, // 保留为渐变色
  },

  // ==================== 深色背景 ====================
  {
    pattern: /rgba\(\s*20\s*,\s*30\s*,\s*60\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(20, 30, 60, $1)',
    description: '深蓝背景 rgba(20, 30, 60, a)',
    skip: true,
  },
  {
    pattern: /rgba\(\s*30\s*,\s*20\s*,\s*50\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(30, 20, 50, $1)',
    description: '深紫背景 rgba(30, 20, 50, a)',
    skip: true,
  },
  {
    pattern: /rgba\(\s*24\s*,\s*24\s*,\s*28\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-900-rgb), $1)',
    description: '深灰背景 rgba(24, 24, 28, a)',
  },
  {
    pattern: /rgba\(\s*30\s*,\s*41\s*,\s*59\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-800-rgb), $1)',
    description: '深蓝灰 rgba(30, 41, 59, a)',
  },
  {
    pattern: /rgba\(\s*38\s*,\s*38\s*,\s*38\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-800-rgb), $1)',
    description: '深灰 rgba(38, 38, 38, a)',
  },
  {
    pattern: /rgba\(\s*44\s*,\s*55\s*,\s*66\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-700-rgb), $1)',
    description: '深灰蓝 rgba(44, 55, 66, a)',
  },
  {
    pattern: /rgba\(\s*15\s*,\s*23\s*,\s*42\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-gray-900-rgb), $1)',
    description: '深色 rgba(15, 23, 42, a)',
  },

  // ==================== 其他颜色 ====================
  {
    pattern: /rgba\(\s*98\s*,\s*147\s*,\s*151\s*,\s*([\d.]+)\s*\)/gi,
    replacement: 'rgba(var(--hula-brand-rgb), $1)',
    description: '青绿色 rgba(98, 147, 151, a)',
  },
];

// 过滤出实际应用的规则
const ACTIVE_FIXES = COMPREHENSIVE_FIXES.filter(fix => !fix.skip);

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
  for (const fix of ACTIVE_FIXES) {
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
  console.log('🔧 HuLa 全面颜色迁移工具 - Phase 8\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/migrate-colors-comprehensive.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

示例:
  node scripts/migrate-colors-comprehensive.cjs          # 执行修复
  node scripts/migrate-colors-comprehensive.cjs --dry-run # 预览修复

Phase 8 修复规则:
  - CSS 变量中的灰度 rgba 值
  - 品牌色变体 rgba(26, 178, 146, a)
  - 功能色 rgba (成功/警告/错误/信息)
  - 深色背景 rgba 值
  - 特殊渐变色（保留原值）
    `);
    process.exit(0);
  }

  console.log('🔧 Phase 8 修复规则:\n');
  ACTIVE_FIXES.forEach((fix, i) => {
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
  console.log('   2. 提交修改: git add . && git commit -m "fix(uiux): comprehensive color migration - phase 8"');

  process.exit(stats.errors > 0 ? 1 : 0);
}

// 运行
main();
