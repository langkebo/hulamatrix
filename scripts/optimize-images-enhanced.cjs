#!/usr/bin/env node

/**
 * HuLa 图片优化脚本 (Node.js 版本)
 *
 * 使用 sharp 库进行图片优化:
 * - PNG → WebP 转换
 * - WebP 质量优化
 * - 自动调整到目标文件大小
 *
 * 依赖安装: pnpm add -D sharp @img/sharp-libvips
 */

const fs = require('fs');
const path = require('path');

// 尝试导入 sharp，如果不存在则提供安装提示
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ sharp 库未安装\n');
  console.error('请运行以下命令安装依赖:\n');
  console.error('  pnpm add -D sharp\n');
  console.error('或者使用系统工具:\n');
  console.error('  macOS:   brew install ffmpeg');
  console.error('  Ubuntu:  sudo apt install ffmpeg');
  console.error('  Windows: winget install ffmpeg\n');
  process.exit(1);
}

// ============= 配置 =============
const CONFIG = {
  publicDir: path.join(process.cwd(), 'public'),
  backupDir: path.join(process.cwd(), `public.backup.${Date.now()}`),
  dryRun: false,
  quality: {
    webp: 85,          // WebP 质量 (0-100)
    pngToWebp: 85,     // PNG 转 WebP 质量
  },
  targets: {
    msgAction: {
      maxSize: 100 * 1024,  // 100KB
      pattern: /\/public\/msgAction\//,
    },
    emoji: {
      maxSize: 50 * 1024,   // 50KB
      pattern: /\/public\/emoji\//,
    },
  },
};

// ============= 统计 =============
const stats = {
  totalFiles: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  originalSize: 0,
  optimizedSize: 0,
};

// ============= 工具函数 =============

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * 获取目标配置
 */
function getTargetConfig(filePath) {
  if (filePath.includes('/msgAction/')) return CONFIG.targets.msgAction;
  if (filePath.includes('/emoji/')) return CONFIG.targets.emoji;
  return null;
}

/**
 * 检查是否需要优化
 */
function needsOptimization(filePath, stat) {
  const targetConfig = getTargetConfig(filePath);

  // 如果没有目标配置，跳过
  if (!targetConfig) return false;

  // 如果文件小于目标大小，跳过
  if (stat.size < targetConfig.maxSize) return false;

  return true;
}

/**
 * 优化单个图片文件
 */
async function optimizeImage(inputPath) {
  const relativePath = path.relative(process.cwd(), inputPath);
  const stat = fs.statSync(inputPath);
  const ext = path.extname(inputPath).toLowerCase();
  const targetConfig = getTargetConfig(relativePath);

  // 检查是否需要优化
  if (!needsOptimization(relativePath, stat)) {
    stats.skipped++;
    return null;
  }

  stats.totalFiles++;
  stats.originalSize += stat.size;

  let outputPath = inputPath;
  let shouldConvert = false;

  // PNG 转 WebP
  if (ext === '.png' && relativePath.includes('/msgAction/')) {
    outputPath = inputPath.replace('.png', '.webp');
    shouldConvert = true;
  }

  // 计算目标质量
  const qualityStep = 5;
  let quality = CONFIG.quality.webp;
  let resultSize = stat.size;
  let optimized = false;

  console.log(`\n📸 ${relativePath}`);
  console.log(`   原始: ${formatSize(stat.size)}`);

  if (CONFIG.dryRun) {
    console.log(`   目标: < ${formatSize(targetConfig.maxSize)}`);
    console.log(`   [DRY-RUN] 将进行优化`);
    stats.processed++;
    stats.optimizedSize += stat.size; // dry-run 假设优化后相同
    return outputPath;
  }

  // 二分查找最佳质量
  while (quality >= 50 && resultSize > targetConfig.maxSize) {
    try {
      const tempPath = inputPath + '.temp.webp';

      if (shouldConvert) {
        await sharp(inputPath)
          .webp({ quality, effort: 6 })
          .toFile(tempPath);
      } else {
        await sharp(inputPath)
          .webp({ quality, effort: 6 })
          .toFile(tempPath);
      }

      const tempStat = fs.statSync(tempPath);
      resultSize = tempStat.size;

      // 如果结果足够小，使用这个质量
      if (resultSize <= targetConfig.maxSize) {
        // 备份原文件
        const backupPath = inputPath.replace(
          /\/public\//,
          `/public.backup.${Date.now()}/`
        );
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(inputPath, backupPath);

        // 替换原文件
        fs.unlinkSync(inputPath);
        fs.renameSync(tempPath, outputPath);

        // 如果是转换，需要更新引用（提示用户）
        if (shouldConvert) {
          console.log(`   ⚠️  已转换为 WebP: ${path.basename(outputPath)}`);
          console.log(`   ⚠️  请更新代码中的文件引用`);
        }

        optimized = true;
        break;
      }

      // 清理临时文件
      fs.unlinkSync(tempPath);

      // 降低质量重试
      quality -= qualityStep;
    } catch (error) {
      console.error(`   ❌ 错误: ${error.message}`);
      stats.errors++;
      return null;
    }
  }

  if (optimized) {
    const finalStat = fs.statSync(outputPath);
    stats.processed++;
    stats.optimizedSize += finalStat.size;
    const saved = stat.size - finalStat.size;
    const savedPercent = ((saved / stat.size) * 100).toFixed(1);
    console.log(`   ✅ 优化后: ${formatSize(finalStat.size)} (-${savedPercent}%)`);
  } else {
    console.log(`   ⚠️  无法优化到目标大小 ${formatSize(targetConfig.maxSize)}`);
    stats.skipped++;
  }

  return outputPath;
}

/**
 * 扫描并优化图片
 */
async function optimizeImages() {
  const dirs = [
    path.join(CONFIG.publicDir, 'msgAction'),
    path.join(CONFIG.publicDir, 'emoji'),
  ];

  const files = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && /\.(png|webp|jpg|jpeg)$/i.test(item)) {
        files.push(fullPath);
      }
    }
  }

  console.log(`📁 找到 ${files.length} 个图片文件\n`);

  for (const file of files) {
    await optimizeImage(file);
  }
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 优化报告\n');

  console.log(`总文件数:     ${stats.totalFiles}`);
  console.log(`已处理:       ${stats.processed}`);
  console.log(`跳过:         ${stats.skipped}`);
  console.log(`错误:         ${stats.errors}`);

  if (stats.originalSize > 0) {
    const saved = stats.originalSize - stats.optimizedSize;
    const savedPercent = ((saved / stats.originalSize) * 100).toFixed(1);

    console.log(`\n原始大小:     ${formatSize(stats.originalSize)}`);
    console.log(`优化后大小:   ${formatSize(stats.optimizedSize)}`);
    console.log(`节省空间:     ${formatSize(saved)} (${savedPercent}%)`);
  }

  if (CONFIG.dryRun) {
    console.log('\n💡 这是 dry-run 模式。运行不带 --dry-run 的命令来实际优化。');
  } else {
    console.log('\n💡 备份文件保存在: public.backup.*');
  }

  console.log('\n✅ 完成!\n');
}

/**
 * 主函数
 */
async function main() {
  console.log('🖼️  HuLa 图片优化工具\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/optimize-images-enhanced.cjs [选项]

选项:
  --dry-run   仅查看会进行哪些优化，不实际修改文件
  --help, -h  显示此帮助信息

示例:
  node scripts/optimize-images-enhanced.cjs          # 执行优化
  node scripts/optimize-images-enhanced.cjs --dry-run # 预览优化

依赖:
  需要安装 sharp 库: pnpm add -D sharp
    `);
    process.exit(0);
  }

  await optimizeImages();
  generateReport();

  process.exit(stats.errors > 0 ? 1 : 0);
}

// 运行
main().catch((error) => {
  console.error('❌ 发生错误:', error);
  process.exit(1);
});
