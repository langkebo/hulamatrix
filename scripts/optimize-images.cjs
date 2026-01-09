#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONFIG = {
  publicDir: path.join(process.cwd(), 'public'),
  dryRun: false,
  backup: true,
};

const stats = {
  processed: 0,
  optimized: 0,
  originalSize: 0,
  optimizedSize: 0,
  saved: 0,
  errors: 0,
};

function getImageFiles(dir) {
  const files = [];
  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(item)) {
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

async function optimizeImage(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const originalSize = fs.statSync(filePath).size;
  stats.originalSize += originalSize;

  try {
    const sharp = require('sharp');
    const image = sharp(filePath);
    const metadata = await image.metadata();

    let optimized;

    if (metadata.format === 'png') {
      optimized = await image.png({
        quality: 80,
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
      }).toBuffer();
    } else if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      optimized = await image.jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true,
      }).toBuffer();
    } else if (metadata.format === 'webp') {
      optimized = await image.webp({
        quality: 85,
        nearLossless: true,
      }).toBuffer();
    } else {
      return false;
    }

    const optimizedSize = optimized.length;
    const saved = originalSize - optimizedSize;
    const savedPercent = ((saved / originalSize) * 100).toFixed(2);

    if (saved > 0) {
      if (CONFIG.backup) {
        fs.copyFileSync(filePath, filePath + '.bak');
      }

      if (CONFIG.dryRun) {
        console.log('\n📝 ' + relativePath);
        console.log('   原始: ' + formatBytes(originalSize));
        console.log('   优化后: ' + formatBytes(optimizedSize));
        console.log('   节省: ' + formatBytes(saved) + ' (' + savedPercent + '%)');
        console.log('   [DRY-RUN] 将进行修改');
      } else {
        fs.writeFileSync(filePath, optimized);
        console.log('\n📝 ' + relativePath);
        console.log('   原始: ' + formatBytes(originalSize));
        console.log('   优化后: ' + formatBytes(optimizedSize));
        console.log('   节省: ' + formatBytes(saved) + ' (' + savedPercent + '%)');
        console.log('   ✅ 已优化');
      }

      stats.optimized++;
      stats.optimizedSize += optimizedSize;
      stats.saved += saved;

      return true;
    }

    return false;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('\n❌ 错误: sharp 库未安装');
      console.error('   请运行: pnpm add -D sharp');
      process.exit(1);
    }
    console.error('\n✗ 错误: ' + relativePath);
    console.error('   ' + error.message);
    stats.errors++;
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  console.log('🖼️  HuLa 图片优化工具\n');

  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }

  if (args.includes('--no-backup')) {
    CONFIG.backup = false;
    console.log('⚠️  不备份原文件\n');
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法: node scripts/optimize-images.cjs [选项]\n');
    console.log('选项:');
    console.log('  --dry-run     仅查看会进行哪些优化，不实际修改文件');
    console.log('  --no-backup   不备份原文件（默认会备份）');
    console.log('  --help, -h    显示此帮助信息\n');
    console.log('优化策略:');
    console.log('  - PNG: quality=80, compressionLevel=9');
    console.log('  - JPEG: quality=85, progressive');
    console.log('  - WebP: quality=85\n');
    process.exit(0);
  }

  console.log('🔧 配置:\n');
  console.log('   备份原文件: ' + (CONFIG.backup ? '是' : '否'));
  console.log('   目标目录: public/\n');

  const files = getImageFiles(CONFIG.publicDir);
  console.log('📁 找到 ' + files.length + ' 个图片文件\n');

  if (files.length === 0) {
    console.log('✅ 没有需要优化的图片');
    process.exit(0);
  }

  console.log('开始处理...\n');
  console.log('─'.repeat(80) + '\n');

  for (const file of files) {
    try {
      await optimizeImage(file);
      stats.processed++;
    } catch (error) {
      console.error('✗ 错误: ' + file);
      console.error('  ' + error.message + '\n');
      stats.errors++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 优化统计\n');

  console.log('处理文件:     ' + stats.processed);
  console.log('优化文件:     ' + stats.optimized);
  console.log('原始大小:     ' + formatBytes(stats.originalSize));
  console.log('优化后大小:   ' + formatBytes(stats.optimizedSize));
  console.log('节省空间:     ' + formatBytes(stats.saved) + ' (' + ((stats.saved / stats.originalSize) * 100).toFixed(2) + '%)');
  console.log('错误:         ' + stats.errors);

  if (CONFIG.dryRun) {
    console.log('\n💡 这是 dry-run 模式。运行不带 --dry-run 的命令来实际应用修改。');
  } else {
    if (CONFIG.backup) {
      console.log('\n💡 备份文件已保存为 *.bak');
      console.log('   确认无误后，可运行: find public -name "*.bak" -delete');
    }
    console.log('\n💡 提示: 运行 git diff 查看修改，git add . 添加更改。');
  }

  console.log('\n✅ 完成!\n');

  if (!CONFIG.dryRun && stats.optimized > 0) {
    console.log('📌 下一步:');
    console.log('   1. 测试应用: pnpm run dev');
    console.log('   2. 确认图片显示正常');
    console.log('   3. 删除备份: find public -name "*.bak" -delete');
    console.log('   4. 提交修改: git add . && git commit -m "chore(images): optimize images"');
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
