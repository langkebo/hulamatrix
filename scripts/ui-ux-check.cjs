#!/usr/bin/env node

/**
 * UI/UX 优化检查脚本
 *
 * 自动检测项目中的常见 UI/UX 问题:
 * - 过长的动画时长 (>300ms)
 * - hover:scale 导致的布局偏移
 * - 缺少 alt 属性的图片
 * - 可点击元素缺少 cursor-pointer
 * - 过时的 className 模式
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  srcDir: path.join(process.cwd(), 'src'),
  maxAnimationDuration: 300, // 毫秒
  ignorePatterns: ['node_modules', 'dist', '.git', 'coverage']
};

// 问题类型
const IssueTypes = {
  LONG_ANIMATION: 'long-animation',
  HOVER_SCALE: 'hover-scale',
  MISSING_ALT: 'missing-alt',
  MISSING_CURSOR: 'missing-cursor',
  EMPTY_ALT: 'empty-alt',
  OLD_CLASSNAME: 'old-classname'
};

// 问题统计
const issues = {
  [IssueTypes.LONG_ANIMATION]: [],
  [IssueTypes.HOVER_SCALE]: [],
  [IssueTypes.MISSING_ALT]: [],
  [IssueTypes.MISSING_CURSOR]: [],
  [IssueTypes.EMPTY_ALT]: [],
  [IssueTypes.OLD_CLASSNAME]: []
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

      // 跳过忽略的目录
      if (CONFIG.ignorePatterns.some(pattern => fullPath.includes(pattern))) {
        continue;
      }

      if (stat.isDirectory()) {
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
 * 检查文件中的 UI/UX 问题
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 检查过长的动画时长
    const durationMatch = line.match(/duration-(\d+)/);
    if (durationMatch) {
      const duration = parseInt(durationMatch[1], 10);
      if (duration > CONFIG.maxAnimationDuration) {
        issues[IssueTypes.LONG_ANIMATION].push({
          file: relativePath,
          line: lineNumber,
          issue: `动画时长过长: ${duration}ms (建议: ${CONFIG.maxAnimationDuration}ms以内)`,
          code: line.trim()
        });
      }
    }

    // 检查 hover:scale 导致的布局偏移
    if (line.includes('hover:scale-') && !line.includes('hover:scale-100')) {
      issues[IssueTypes.HOVER_SCALE].push({
        file: relativePath,
        line: lineNumber,
        issue: 'hover:scale 会导致布局偏移，建议使用颜色/透明度变化',
        code: line.trim()
      });
    }

    // 检查缺少 alt 属性的 img 标签
    const imgMatch = line.match(/<img[^>]*>/);
    if (imgMatch) {
      const imgTag = imgMatch[0];
      // 检查是否有 alt 属性
      if (!imgTag.includes('alt=')) {
        issues[IssueTypes.MISSING_ALT].push({
          file: relativePath,
          line: lineNumber,
          issue: '图片缺少 alt 属性',
          code: line.trim()
        });
      }
      // 检查空 alt 属性
      else if (imgTag.includes('alt=""')) {
        issues[IssueTypes.EMPTY_ALT].push({
          file: relativePath,
          line: lineNumber,
          issue: '图片 alt 属性为空，建议提供描述性文本',
          code: line.trim()
        });
      }
    }

    // 检查可点击元素是否缺少 cursor-pointer
    if ((line.includes('@click=') || line.includes('onclick=')) &&
        !line.includes('cursor-pointer') &&
        !line.includes('cursor:')) {
      // 排除一些特殊情况
      if (!line.includes('n-button') && !line.includes('n-icon')) {
        issues[IssueTypes.MISSING_CURSOR].push({
          file: relativePath,
          line: lineNumber,
          issue: '可点击元素缺少 cursor-pointer 样式',
          code: line.trim()
        });
      }
    }

    // 检查过时的 className 模式
    if (line.includes('className=') && line.includes('[')) {
      issues[IssueTypes.OLD_CLASSNAME].push({
        file: relativePath,
        line: lineNumber,
        issue: '使用过时的 className 模式，建议使用 :class',
        code: line.trim()
      });
    }
  });
}

/**
 * 格式化输出
 */
function formatOutput() {
  console.log('\n🎨 UI/UX 优化检查报告\n');
  console.log('=' .repeat(80));

  let totalIssues = 0;

  // 输出各类问题
  Object.entries(issues).forEach(([type, typeIssues]) => {
    if (typeIssues.length > 0) {
      totalIssues += typeIssues.length;

      const titles = {
        [IssueTypes.LONG_ANIMATION]: '⏰ 过长的动画时长',
        [IssueTypes.HOVER_SCALE]: '📐 Hover 悬停布局偏移',
        [IssueTypes.MISSING_ALT]: '🖼️  缺少 alt 属性',
        [IssueTypes.MISSING_CURSOR]: '👆 缺少 cursor-pointer',
        [IssueTypes.EMPTY_ALT]: '📝 空 alt 属性',
        [IssueTypes.OLD_CLASSNAME]: '🔄 过时的 className 模式'
      };

      console.log(`\n${titles[type]} (${typeIssues.length} 个)\n`);
      console.log('-'.repeat(80));

      typeIssues.slice(0, 10).forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.file}:${issue.line}`);
        console.log(`   ${issue.issue}`);
        console.log(`   代码: ${issue.code.substring(0, 80)}${issue.code.length > 80 ? '...' : ''}`);
      });

      if (typeIssues.length > 10) {
        console.log(`\n   ... 还有 ${typeIssues.length - 10} 个问题未显示`);
      }
    }
  });

  // 总结
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 总计: ${totalIssues} 个问题\n`);

  // 优先级建议
  console.log('🎯 修复优先级建议:\n');

  const priority = [
    {
      level: '🔴 高优先级',
      types: [IssueTypes.LONG_ANIMATION, IssueTypes.HOVER_SCALE],
      reason: '严重影响用户体验'
    },
    {
      level: '🟡 中优先级',
      types: [IssueTypes.MISSING_ALT, IssueTypes.EMPTY_ALT],
      reason: '影响可访问性'
    },
    {
      level: '🟢 低优先级',
      types: [IssueTypes.MISSING_CURSOR, IssueTypes.OLD_CLASSNAME],
      reason: '代码质量和一致性'
    }
  ];

  priority.forEach(({ level, types, reason }) => {
    const count = types.reduce((sum, type) => sum + issues[type].length, 0);
    if (count > 0) {
      console.log(`${level}: ${count} 个问题 - ${reason}`);
    }
  });

  console.log('\n💡 提示: 运行 `npm run fix:ui-ux` 自动修复部分问题\n');
}

/**
 * 生成 JSON 报告
 */
function generateJsonReport() {
  const reportPath = path.join(process.cwd(), 'ui-ux-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
  console.log(`📄 JSON 报告已生成: ${reportPath}\n`);
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查 UI/UX 问题...\n');

  const files = getSourceFiles(CONFIG.srcDir);
  console.log(`📁 找到 ${files.length} 个源文件`);

  files.forEach(file => {
    checkFile(file);
  });

  formatOutput();
  generateJsonReport();

  // 返回退出码
  const totalIssues = Object.values(issues).reduce((sum, typeIssues) => sum + typeIssues.length, 0);
  process.exit(totalIssues > 0 ? 1 : 0);
}

// 运行
main();
