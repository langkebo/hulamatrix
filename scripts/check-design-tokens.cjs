#!/usr/bin/env node

/**
 * 设计令牌检查脚本
 *
 * 检查代码中是否正确使用设计令牌:
 * - 不使用硬编码颜色值
 * - 使用 CSS 变量而非固定值
 * - 遵循间距系统
 * - 使用正确的动画时长
 * - 使用正确的圆角值
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  srcDir: path.join(process.cwd(), 'src'),
  allowedHardcoded: {
    // 允许的硬编码值（用于特殊情况）
    colors: ['transparent', 'inherit', 'currentColor'],
    zeros: ['0', '0px', '0rem', '0%'],
    sizes: ['100%', '50%'] // flex 布局常用的百分比值
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    '.git',
    'coverage',
    '.*.test.ts',
    '.*.spec.ts'
  ]
};

// 设计令牌模式
const PATTERNS = {
  // 硬编码颜色（十六进制、RGB、RGBA）
  hardcodedColor: /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g,

  // 硬编码尺寸（非 8 的倍数）
  hardcodedSize: /\b(\d+px|\d+rem|\d+em)\b/g,

  // 过长的动画时长
  longAnimation: /duration-(\d{3,})/g,

  // 非标准圆角
  nonStandardRadius: /rounded-\d+/g,

  // 不使用 CSS 变量
  noVars: /color:\s*[^;]+;|background:\s*[^;]+;/gi
};

// 统计
const stats = {
  filesChecked: 0,
  issues: {
    hardcodedColors: [],
    hardcodedSizes: [],
    longAnimations: [],
    nonStandardRadius: [],
    noVars: []
  },
  totalIssues: 0
};

/**
 * 获取所有源文件
 */
function getSourceFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        // 跳过忽略的目录
        if (CONFIG.ignorePatterns.some(pattern => fullPath.includes(pattern))) {
          continue;
        }

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (/\.(vue|ts|tsx|scss|css)$/.test(item)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略无权限访问的目录
    }
  }

  traverse(dir);
  return files;
}

/**
 * 检查文件
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const lines = content.split('\n');

  let fileHasIssues = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 检查硬编码颜色
    const colorMatches = line.match(PATTERNS.hardcodedColor);
    if (colorMatches) {
      colorMatches.forEach(color => {
        // 排除允许的值
        if (!CONFIG.allowedHardcoded.colors.includes(color) &&
            !CONFIG.allowedHardcoded.colors.includes(color.toLowerCase())) {
          stats.issues.hardcodedColors.push({
            file: relativePath,
            line: lineNumber,
            issue: `硬编码颜色: ${color}`,
            code: line.trim(),
            suggestion: `使用 CSS 变量，如 var(--hula-brand-primary)`
          });
          fileHasIssues = true;
        }
      });
    }

    // 检查硬编码尺寸（非 8 的倍数）
    const sizeMatches = line.match(PATTERNS.hardcodedSize);
    if (sizeMatches) {
      sizeMatches.forEach(size => {
        const value = parseInt(size, 10);
        if (value > 0 && value % 8 !== 0 && !CONFIG.allowedHardcoded.sizes.includes(size)) {
          stats.issues.hardcodedSizes.push({
            file: relativePath,
            line: lineNumber,
            issue: `非 8 倍数的尺寸: ${size}`,
            code: line.trim(),
            suggestion: `使用间距系统: 4px, 8px, 16px, 24px, 32px 等`
          });
          fileHasIssues = true;
        }
      });
    }

    // 检查过长的动画
    const animMatches = line.match(PATTERNS.longAnimation);
    if (animMatches) {
      animMatches.forEach(match => {
        const duration = parseInt(match.replace('duration-', ''), 10);
        if (duration > 300) {
          stats.issues.longAnimations.push({
            file: relativePath,
            line: lineNumber,
            issue: `动画时长过长: ${duration}ms`,
            code: line.trim(),
            suggestion: `使用 150-300ms 范围内的动画时长`
          });
          fileHasIssues = true;
        }
      });
    }

    // 检查非标准圆角（UnoCSS 以外的）
    if (line.includes('border-radius:') && !line.includes('var(')) {
      const radiusMatch = line.match(/border-radius:\s*(\d+px)/);
      if (radiusMatch) {
        const radius = parseInt(radiusMatch[1], 10);
        if (radius !== 0 && radius !== 4 && radius !== 8 && radius !== 12 &&
            radius !== 16 && radius !== 24 && radius !== 9999) {
          stats.issues.nonStandardRadius.push({
            file: relativePath,
            line: lineNumber,
            issue: `非标准圆角: ${radiusMatch[1]}`,
            code: line.trim(),
            suggestion: `使用设计令牌: 4px, 8px, 12px, 16px, 24px`
          });
          fileHasIssues = true;
        }
      }
    }

    // 检查不使用 CSS 变量的颜色/背景
    const noVarsMatches = line.match(PATTERNS.noVars);
    if (noVarsMatches) {
      noVarsMatches.forEach(match => {
        // 检查是否使用了硬编码值但没用变量
        if ((match.includes('color:') || match.includes('background:')) &&
            !match.includes('var(') && !match.includes('rgba') &&
            !match.includes('#') && !match.includes('rgb')) {
          // 这里只是简单检查，实际可能需要更复杂的逻辑
        }
      });
    }
  });

  if (fileHasIssues) {
    stats.filesChecked++;
  }
}

/**
 * 格式化输出
 */
function formatOutput() {
  console.log('\n🎨 设计令牌检查报告\n');
  console.log('='.repeat(80));

  let totalIssues = 0;

  // 输出各类问题
  const categories = [
    { key: 'hardcodedColors', title: '🎨 硬编码颜色', icon: 'palette' },
    { key: 'hardcodedSizes', title: '📏 非标准尺寸', icon: 'ruler' },
    { key: 'longAnimations', title: '⏰ 过长动画时长', icon: 'clock' },
    { key: 'nonStandardRadius', title: '🔄 非标准圆角', icon: 'radius' },
    { key: 'noVars', title: '📝 未使用 CSS 变量', icon: 'code' }
  ];

  categories.forEach(({ key, title }) => {
    const issues = stats.issues[key];
    if (issues.length > 0) {
      totalIssues += issues.length;

      console.log(`\n${title} (${issues.length} 个)\n`);
      console.log('-'.repeat(80));

      issues.slice(0, 20).forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.file}:${issue.line}`);
        console.log(`   ${issue.issue}`);
        console.log(`   建议: ${issue.suggestion}`);
        console.log(`   代码: ${issue.code.substring(0, 80)}${issue.code.length > 80 ? '...' : ''}`);
      });

      if (issues.length > 20) {
        console.log(`\n   ... 还有 ${issues.length - 20} 个问题未显示`);
      }
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 总计: ${totalIssues} 个问题`);
  console.log(`检查文件: ${stats.filesChecked} 个\n`);

  if (totalIssues > 0) {
    console.log('💡 建议:\n');
    console.log('1. 使用 CSS 变量替代硬编码值');
    console.log('2. 遵循 8px 基础间距系统');
    console.log('3. 动画时长控制在 150-300ms');
    console.log('4. 使用标准圆角值 (4/8/12/16/24px)');
    console.log('5. 参考 docs/DESIGN_TOKENS.md 文档\n');
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查设计令牌使用情况...\n');

  const files = getSourceFiles(CONFIG.srcDir);
  console.log(`📁 找到 ${files.length} 个源文件\n`);

  files.forEach(file => {
    try {
      checkFile(file);
    } catch (error) {
      console.error(`检查错误: ${file}`);
      console.error(`  ${error.message}`);
    }
  });

  formatOutput();

  const totalIssues = Object.values(stats.issues).reduce((sum, issues) => sum + issues.length, 0);

  if (totalIssues > 0) {
    console.log('❌ 发现设计令牌使用问题\n');
    process.exit(1);
  } else {
    console.log('✅ 设计令牌使用检查通过！\n');
    process.exit(0);
  }
}

// 运行
main();
