#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  publicDir: path.join(process.cwd(), 'public'),
  dryRun: false,
};

async function convertGifToWebp(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const originalSize = fs.statSync(filePath).size;
  
  try {
    const sharp = require('sharp');
    const image = sharp(filePath);
    
    const webpBuffer = await image.webp({
      quality: 85,
      nearLossless: true,
      effort: 6,
    }).toBuffer();
    
    const webpPath = filePath.replace(/\.(png|gif)$/i, '.webp');
    const saved = originalSize - webpBuffer.length;
    const savedPercent = ((saved / originalSize) * 100).toFixed(2);
    
    if (CONFIG.dryRun) {
      console.log('\n📝 ' + relativePath);
      console.log('   原始: ' + formatBytes(originalSize) + ' (GIF)');
      console.log('   转换后: ' + formatBytes(webpBuffer.length) + ' (WebP)');
      console.log('   节省: ' + formatBytes(saved) + ' (' + savedPercent + '%)');
      console.log('   目标: ' + path.relative(process.cwd(), webpPath));
      console.log('   [DRY-RUN] 将进行转换');
    } else {
      fs.copyFileSync(filePath, filePath + '.bak');
      fs.writeFileSync(webpPath, webpBuffer);
      
      console.log('\n📝 ' + relativePath);
      console.log('   原始: ' + formatBytes(originalSize) + ' (GIF)');
      console.log('   转换后: ' + formatBytes(webpBuffer.length) + ' (WebP)');
      console.log('   节省: ' + formatBytes(saved) + ' (' + savedPercent + '%)');
      console.log('   目标: ' + path.relative(process.cwd(), webpPath));
      console.log('   ✅ 已转换');
    }
    
    return {
      original: originalSize,
      optimized: webpBuffer.length,
      saved: saved,
    };
  } catch (error) {
    console.error('\n✗ 错误: ' + relativePath);
    console.error('   ' + error.message);
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function findGifFiles() {
  const files = [];
  
  try {
    const items = fs.readdirSync(CONFIG.publicDir);
    
    for (const item of items) {
      const fullPath = path.join(CONFIG.publicDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 递归搜索子目录
        try {
          const subItems = fs.readdirSync(fullPath);
          for (const subItem of subItems) {
            const subPath = path.join(fullPath, subItem);
            if (fs.statSync(subPath).isFile() && /\.(png|gif)$/i.test(subItem)) {
              // 检查是否是 GIF
              try {
                const buffer = fs.readFileSync(subPath);
                if (buffer.length > 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
                  files.push(subPath);
                }
              } catch (e) {
                // Skip
              }
            }
          }
        } catch (e) {
          // Skip
        }
      }
    }
  } catch (e) {
    // Skip
  }
  
  return files;
}

async function main() {
  console.log('🔄 GIF 转 WebP 转换工具\n');
  
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    CONFIG.dryRun = true;
    console.log('🔍 Dry-run 模式: 不会实际修改文件\n');
  }
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法: node scripts/convert-gif-to-webp.cjs [选项]\n');
    console.log('选项:');
    console.log('  --dry-run     仅查看会进行哪些转换');
    console.log('  --help, -h    显示此帮助信息\n');
    process.exit(0);
  }
  
  const gifFiles = findGifFiles();
  
  if (gifFiles.length === 0) {
    console.log('✅ 没有找到 GIF 文件');
    process.exit(0);
  }
  
  console.log('📁 找到 ' + gifFiles.length + ' 个 GIF 文件\n');
  console.log('开始处理...\n');
  console.log('─'.repeat(80) + '\n');
  
  let stats = {
    processed: 0,
    converted: 0,
    originalSize: 0,
    convertedSize: 0,
    saved: 0,
  };
  
  for (const file of gifFiles) {
    const result = await convertGifToWebp(file);
    if (result) {
      stats.converted++;
      stats.originalSize += result.original;
      stats.convertedSize += result.optimized;
      stats.saved += result.saved;
    }
    stats.processed++;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 转换统计\n');
  
  console.log('处理文件:     ' + stats.processed);
  console.log('转换文件:     ' + stats.converted);
  console.log('原始大小:     ' + formatBytes(stats.originalSize));
  console.log('转换后大小:   ' + formatBytes(stats.convertedSize));
  console.log('节省空间:     ' + formatBytes(stats.saved) + ' (' + (stats.saved / stats.originalSize * 100).toFixed(2) + '%)');
  
  if (!CONFIG.dryRun && stats.converted > 0) {
    console.log('\n💡 提示:');
    console.log('   1. 测试应用: pnpm run dev');
    console.log('   2. 更新代码中的引用（将 .png 改为 .webp）');
    console.log('   3. 确认无误后删除原文件和备份');
  }
  
  console.log('\n✅ 完成!\n');
  
  process.exit(0);
}

main();
