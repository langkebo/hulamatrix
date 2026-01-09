#!/usr/bin/env node

/**
 * 图片优化脚本
 *
 * 功能:
 * - 压缩图片文件大小
 * - 转换为现代格式 (WebP/AVIF)
 * - 生成多种尺寸的响应式图片
 * - 分析图片优化潜力
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  publicDir: path.join(process.cwd(), 'public'),
  targets: {
    emoji: {
      dir: 'emoji',
      maxSize: 50 * 1024, // 50KB
      formats: ['webp'],
      sizes: [] // 表情包不需要多尺寸
    },
    avatar: {
      dir: 'avatar',
      maxSize: 30 * 1024, // 30KB
      formats: ['webp'],
      sizes: [32, 64, 128, 256]
    },
    file: {
      dir: 'file',
      maxSize: 5 * 1024, // 5KB
      formats: ['svg'], // 图标保持 SVG
      sizes: []
    }
  },
  dryRun: false,
  verbose: false
};

// 统计
const stats = {
  analyzed: 0,
  optimized: 0,
  skipped: 0,
  errors: 0,
  totalOriginalSize: 0,
  totalOptimizedSize: 0,
  saved: 0
};

/**
 * 检查是否安装了图片优化工具
 */
function checkTools() {
  const tools = [];

  try {
    execSync('which ffmpeg', { stdio: 'ignore' });
    tools.push('ffmpeg');
  } catch (e) {}

  try {
    execSync('which optipng', { stdio: 'ignore' });
    tools.push('optipng');
  } catch (e) {}

  try {
    execSync('which jpegoptim', { stdio: 'ignore' });
    tools.push('jpegoptim');
  } catch (e) {}

  try {
    execSync('which cwebp', { stdio: 'ignore' });
    tools.push('cwebp');
  } catch (e) {}

  return tools;
}

/**
 * 获取文件大小
 */
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * 格式化文件大小
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 分析图片文件
 */
function analyzeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const size = getFileSize(filePath);
  const relativePath = path.relative(process.cwd(), filePath);

  return {
    path: relativePath,
    ext,
    size,
    formattedSize: formatBytes(size),
    needsOptimization: false,
    recommendedAction: 'none'
  };
}

/**
 * 使用 ffmpeg 压缩 WebP 图片
 */
function optimizeWebP(inputPath, outputPath, quality = 85) {
  try {
    const cmd = `ffmpeg -i "${inputPath}" -c:v libwebp -quality ${quality} -quiet "${outputPath}"`;
    if (CONFIG.verbose) {
      console.log(`执行: ${cmd}`);
    }
    if (!CONFIG.dryRun) {
      execSync(cmd, { stdio: CONFIG.verbose ? 'inherit' : 'ignore' });
    }
    return true;
  } catch (error) {
    console.error(`压缩失败: ${error.message}`);
    return false;
  }
}

/**
 * 优化图片目录
 */
function optimizeDirectory(targetKey) {
  const target = CONFIG.targets[targetKey];
  const dirPath = path.join(CONFIG.publicDir, target.dir);

  if (!fs.existsSync(dirPath)) {
    console.log(`⊘ 跳过: ${target.dir}/ (目录不存在)`);
    return;
  }

  console.log(`\n📁 分析 ${target.dir}/ 目录...\n`);

  const files = fs.readdirSync(dirPath)
    .filter(f => /\.(webp|png|jpg|jpeg|gif)$/i.test(f))
    .map(f => path.join(dirPath, f));

  console.log(`找到 ${files.length} 个图片文件\n`);
  console.log('─'.repeat(80) + '\n');

  files.forEach(filePath => {
    const originalSize = getFileSize(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    const ext = path.extname(filePath).toLowerCase();

    stats.analyzed++;
    stats.totalOriginalSize += originalSize;

    // 判断是否需要优化
    let needsOptimization = false;
    let action = 'skip';
    let potentialSaving = 0;

    if (ext === '.webp' && originalSize > target.maxSize) {
      needsOptimization = true;
      action = 'compress';
      potentialSaving = originalSize - target.maxSize;
    }

    // 显示分析结果
    if (needsOptimization || CONFIG.verbose) {
      console.log(`📊 ${relativePath}`);
      console.log(`   当前大小: ${formatBytes(originalSize)}`);

      if (needsOptimization) {
        console.log(`   目标大小: ${formatBytes(target.maxSize)}`);
        console.log(`   预计节省: ${formatBytes(potentialSaving)} (${Math.round(potentialSaving / originalSize * 100)}%)`);
        console.log(`   操作: ${action}`);

        // 执行优化
        if (action === 'compress') {
          const tempPath = filePath + '.tmp.webp';

          if (optimizeWebP(filePath, tempPath, 80)) {
            const newSize = getFileSize(tempPath);
            stats.totalOptimizedSize += newSize;
            stats.saved += (originalSize - newSize);

            if (!CONFIG.dryRun) {
              fs.unlinkSync(filePath);
              fs.renameSync(tempPath, filePath);
            } else {
              fs.unlinkSync(tempPath);
            }

            console.log(`   ✅ 已优化: ${formatBytes(originalSize)} → ${formatBytes(newSize)}`);
            stats.optimized++;
          } else {
            stats.errors++;
          }
        }
      } else {
        console.log(`   ⊘ 无需优化`);
        stats.skipped++;
      }

      console.log('');
    } else {
      stats.skipped++;
    }
  });
}

/**
 * 生成优化报告
 */
function generateReport() {
  console.log('─'.repeat(80));
  console.log('\n📊 优化报告\n');

  console.log(`分析文件数: ${stats.analyzed}`);
  console.log(`已优化:     ${stats.optimized}`);
  console.log(`跳过:       ${stats.skipped}`);
  if (stats.errors > 0) {
    console.log(`错误:       ${stats.errors}`);
  }

  console.log('\n' + '─'.repeat(80) + '\n');

  console.log(`原始总大小: ${formatBytes(stats.totalOriginalSize)}`);
  if (stats.totalOptimizedSize > 0) {
    console.log(`优化后大小: ${formatBytes(stats.totalOptimizedSize)}`);
    console.log(`节省空间:   ${formatBytes(stats.saved)} (${Math.round(stats.saved / stats.totalOriginalSize * 100)}%)`);
  }

  console.log('\n' + '─'.repeat(80) + '\n');

  if (stats.saved > 0) {
    console.log('💡 优化建议:\n');
    console.log('1. 考虑为不同设备生成多种尺寸的响应式图片');
    console.log('2. 实施图片懒加载以减少初始加载时间');
    console.log('3. 使用 CDN 加速图片交付');
    console.log('4. 考虑使用 AVIF 格式以获得更好的压缩率');
  }

  console.log('');
}

/**
 * 主函数
 */
function main() {
  console.log('🖼️  图片优化工具\n');

  // 解析命令行参数
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
  }
  if (args.includes('--verbose') || args.includes('-v')) {
    CONFIG.verbose = true;
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
用法: node scripts/optimize-images.cjs [选项]

选项:
  --dry-run       预览模式，不实际修改文件
  --verbose, -v   显示详细输出
  --help, -h      显示此帮助信息

示例:
  node scripts/optimize-images.cjs              # 优化所有图片
  node scripts/optimize-images.cjs --dry-run    # 预览优化结果
  node scripts/optimize-images.cjs --verbose    # 显示详细输出

依赖工具 (可选):
  - ffmpeg    # 用于 WebP 压缩
  - cwebp     # 用于 WebP 编码
  - optipng   # 用于 PNG 优化
  - jpegoptim # 用于 JPEG 优化

安装依赖:
  brew install ffmpeg optipng jpegoptim  # macOS
  apt install ffmpeg optipng jpegoptim   # Ubuntu
    `);
    process.exit(0);
  }

  if (CONFIG.dryRun) {
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n\n');
  }

  // 检查工具
  const tools = checkTools();
  if (tools.length === 0) {
    console.log('⚠️  警告: 未检测到图片优化工具');
    console.log('   仅进行分析，不会执行实际优化\n');
    console.log('   安装推荐: brew install ffmpeg optipng jpegoptim\n');
  } else {
    console.log(`✓ 已安装工具: ${tools.join(', ')}\n`);
  }

  console.log('开始优化...\n');

  // 优化各个目标目录
  Object.keys(CONFIG.targets).forEach(key => {
    optimizeDirectory(key);
  });

  // 生成报告
  generateReport();

  if (CONFIG.dryRun) {
    console.log('💡 这是 dry-run 模式。运行不带 --dry-run 的命令来实际应用优化。');
  } else {
    console.log('✅ 优化完成!\n');
    console.log('💡 提示: 运行 `git add .` 添加优化的图片。');
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

// 运行
main();
