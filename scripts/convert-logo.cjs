#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CONFIG = {
  publicDir: path.join(process.cwd(), 'public'),
  targetSize: 256,
  borderRadius: 48, // 圆角半径
};

async function convertLogo() {
  const sharp = require('sharp');

  const logoPath = path.join(CONFIG.publicDir, 'logo.png');
  const logo1Path = path.join(CONFIG.publicDir, 'logo1.png');
  const outputPath = path.join(CONFIG.publicDir, 'logo.png');

  console.log('🔄 Logo 转换工具\n');

  // 创建备份
  const backupPath = logoPath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(logoPath, backupPath);
    console.log('✅ 已创建备份: logo.png.bak\n');
  }

  try {
    // 读取 logo1.png 获取圆角参考
    const logo1Info = await sharp(logo1Path).metadata();
    console.log('📐 logo1.png 参考信息:');
    console.log('   尺寸: ' + logo1Info.width + 'x' + logo1Info.height);
    console.log('   格式: ' + logo1Info.format);
    console.log('');

    // 读取当前 logo.png
    const logoInfo = await sharp(logoPath).metadata();
    console.log('📐 logo.png 原始信息:');
    console.log('   尺寸: ' + logoInfo.width + 'x' + logoInfo.height);
    console.log('   格式: ' + logoInfo.format);
    console.log('');

    // 创建圆角蒙版
    const roundedCorner = Buffer.from(
      `<svg width="${CONFIG.targetSize}" height="${CONFIG.targetSize}">
        <rect x="0" y="0" width="${CONFIG.targetSize}" height="${CONFIG.targetSize}" rx="${CONFIG.borderRadius}" ry="${CONFIG.borderRadius}"/>
      </svg>`
    );

    // 处理 logo.png
    console.log('🔧 开始处理...\n');

    const processedImage = await sharp(logoPath)
      .resize(CONFIG.targetSize, CONFIG.targetSize, {
        fit: 'cover',
        position: 'center'
      })
      .composite([
        {
          input: roundedCorner,
          blend: 'dest-in'
        }
      ])
      .png({
        quality: 90,
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toBuffer();

    // 保存处理后的图片
    fs.writeFileSync(outputPath, processedImage);

    // 获取处理后的信息
    const outputInfo = await sharp(outputPath).metadata();
    const originalSize = fs.statSync(backupPath).size;
    const outputSize = fs.statSync(outputPath).size;
    const saved = originalSize - outputSize;
    const savedPercent = ((saved / originalSize) * 100).toFixed(2);

    console.log('✅ 处理完成!\n');
    console.log('📊 处理结果:');
    console.log('   输出尺寸: ' + outputInfo.width + 'x' + outputInfo.height);
    console.log('   输出格式: ' + outputInfo.format);
    console.log('   原始大小: ' + formatBytes(originalSize));
    console.log('   输出大小: ' + formatBytes(outputSize));
    if (saved > 0) {
      console.log('   节省: ' + formatBytes(saved) + ' (' + savedPercent + '%)');
    } else {
      console.log('   增加: ' + formatBytes(-saved) + ' (' + Math.abs(savedPercent) + '%)');
    }
    console.log('');
    console.log('💡 提示:');
    console.log('   1. 测试应用: pnpm run dev');
    console.log('   2. 确认 logo 显示正常');
    console.log('   3. 如需恢复: cp public/logo.png.bak public/logo.png');
    console.log('   4. 删除备份: rm public/logo.png.bak');

    return true;
  } catch (error) {
    console.error('✗ 错误: ' + error.message);
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法: node scripts/convert-logo.cjs\n');
    console.log('功能:');
    console.log('  - 将 public/logo.png 调整为 256x256 尺寸');
    console.log('  - 添加圆角效果 (半径 48px)');
    console.log('  - 转换为 PNG 格式');
    console.log('  - 自动创建备份文件\n');
    console.log('注意: 运行前会自动创建 logo.png.bak 备份\n');
    process.exit(0);
  }

  await convertLogo();
}

main();
