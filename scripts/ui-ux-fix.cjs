#!/usr/bin/env node

/**
 * UI/UX 自动修复脚本
 *
 * 自动修复常见的 UI/UX 问题:
 * - 添加图片 alt 属性
 * - 修复过长的动画时长
 * - 修复 hover:scale 导致的布局偏移
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  srcDir: path.join(process.cwd(), 'src'),
  maxAnimationDuration: 300,
  dryRun: false // 设置为 true 仅查看会进行哪些修改
};

// 统计
const stats = {
  fixed: 0,
  skipped: 0,
  errors: 0
};

/**
 * 获取所有 Vue/TS 文件
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
      } else if (/\.(vue|ts|tsx|jsx)$/.test(item)) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * 修复文件中的问题
 */
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const relativePath = path.relative(process.cwd(), filePath);

  // 修复 1: 过长的动画时长
  const durationMatches = content.match(/duration-(\d+)/g);
  if (durationMatches) {
    durationMatches.forEach(match => {
      const duration = parseInt(match.replace('duration-', ''), 10);
      if (duration > CONFIG.maxAnimationDuration) {
        const newDuration = `duration-${Math.min(duration, 200)}`;
        content = content.replace(match, newDuration);
        modified = true;
        console.log(`✓ ${relativePath}: 修复动画时长 ${duration}ms → ${Math.min(duration, 200)}ms`);
      }
    });
  }

  // 修复 2: hover:scale → hover:opacity
  const scaleMatches = content.match(/hover:scale-(\d+)/g);
  if (scaleMatches) {
    scaleMatches.forEach(match => {
      if (match !== 'hover:scale-100') {
        content = content.replace(match, 'hover:opacity-90');
        modified = true;
        console.log(`✓ ${relativePath}: 修复 hover:scale → hover:opacity-90`);
      }
    });
  }

  // 修复 3: 为 img 标签添加 alt 属性 (如果缺少)
  const imgRegex = /<img([^>]*?)>/g;
  content = content.replace(imgRegex, (match, attrs) => {
    // 如果已有 alt 属性，跳过
    if (attrs.includes('alt=')) {
      return match;
    }

    // 检查是否是 SVG 图标或装饰性图片
    if (attrs.includes('loading-one.svg') || attrs.includes('loading.svg')) {
      return match.replace('>', ' alt="加载中..." >');
    }

    // 检查是否有 src 属性
    const srcMatch = attrs.match(/:src="([^"]+)"|src="([^"]+)"/);
    if (srcMatch) {
      const srcValue = srcMatch[1] || srcMatch[2];

      // 如果是表情包图片
      if (srcValue.includes('/emoji/')) {
        const emojiName = srcValue.split('/').pop().replace('.webp', '').replace('.png', '');
        return match.replace('>', ` :alt="表情: ${emojiName}" >`);
      }

      // 如果是头像
      if (attrs.includes('avatar') || attrs.includes('rounded-full')) {
        return match.replace('>', ' alt="用户头像" >');
      }

      // 如果是消息图片
      if (attrs.includes('message') || attrs.includes('imageUrl')) {
        return match.replace('>', ' alt="消息图片" >');
      }

      // 默认情况
      return match.replace('>', ' alt="图片" >');
    }

    return match;
  });

  // 修复 4: 为可点击元素添加 cursor-pointer
  const clickRegex = /(@click|onclick)="([^"]+)"([^>]*)>/g;
  content = content.replace(clickRegex, (match, eventAttr, handler, rest) => {
    // 如果已有 cursor-pointer 或是 button/n-button，跳过
    if (rest.includes('cursor-pointer') || rest.includes('cursor: pointer')) {
      return match;
    }

    if (rest.includes('<button') || rest.includes('n-button') || rest.includes('NButton')) {
      return match;
    }

    // 添加 cursor-pointer
    const newRest = rest.includes('class=')
      ? rest.replace(/class="([^"]*)"/, 'class="$1 cursor-pointer"')
      : rest + ' class="cursor-pointer"';

    return `${eventAttr}="${handler}"${newRest}>`;
  });

  // 如果有修改，写回文件
  if (modified) {
    if (!CONFIG.dryRun) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    stats.fixed++;
    return true;
  }

  stats.skipped++;
  return false;
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 UI/UX 自动修复工具\n');

  // 检查命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/ui-ux-fix.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些修改，不实际修改文件
  --help, -h  显示此帮助信息

示例:
  node scripts/ui-ux-fix.cjs          # 自动修复所有问题
  node scripts/ui-ux-fix.cjs --dry-run # 查看会进行哪些修改
    `);
    process.exit(0);
  }

  console.log('开始扫描文件...\n');

  const files = getSourceFiles(CONFIG.srcDir);
  console.log(`📁 找到 ${files.length} 个源文件\n`);

  console.log('开始修复...\n');
  console.log('─'.repeat(80) + '\n');

  files.forEach(file => {
    try {
      fixFile(file);
    } catch (error) {
      console.error(`✗ 错误: ${file}`);
      console.error(`  ${error.message}\n`);
      stats.errors++;
    }
  });

  console.log('─'.repeat(80) + '\n');
  console.log('📊 修复统计:\n');
  console.log(`  ✓ 已修复: ${stats.fixed} 个文件`);
  console.log(`  ⊘ 跳过:   ${stats.skipped} 个文件`);
  if (stats.errors > 0) {
    console.log(`  ✗ 错误:  ${stats.errors} 个文件`);
  }

  if (CONFIG.dryRun) {
    console.log('\n💡 这是 dry-run 模式。运行不带 --dry-run 的命令来实际应用修复。');
  } else {
    console.log('\n💡 提示: 运行 `git diff` 查看修改，`git add .` 添加更改。');
  }

  console.log('\n✅ 完成!\n');

  process.exit(stats.errors > 0 ? 1 : 0);
}

// 运行
main();
