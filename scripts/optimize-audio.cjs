#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
  publicDir: path.join(process.cwd(), 'public'),
  dryRun: false,
  backup: true,
  targetBitrate: '64k',  // 64 kbps for notification sounds
  targetSampleRate: 44100,  // Standard sample rate
  mono: true,  // Convert to mono for notification sounds
};

const stats = {
  processed: 0,
  optimized: 0,
  originalSize: 0,
  optimizedSize: 0,
  saved: 0,
  errors: 0,
};

function getAudioFiles(dir) {
  const files = [];
  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(item)) {
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getAudioInfo(filePath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=size,duration,bit_rate -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    const lines = output.trim().split('\n');
    // ffprobe outputs: duration, size, bit_rate
    const duration = parseFloat(lines[0]) || 0;
    const size = parseInt(lines[1]) || 0;
    const bitrate = parseInt(lines[2]) || 0;
    return { size, duration, bitrate };
  } catch (error) {
    return null;
  }
}

async function optimizeAudio(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const audioInfo = getAudioInfo(filePath);

  if (!audioInfo) {
    console.error('\n✗ 错误: 无法读取 ' + relativePath);
    stats.errors++;
    return false;
  }

  const originalSize = audioInfo.size;
  stats.originalSize += originalSize;

  // Skip if file is already small (< 10 KB)
  if (originalSize < 10240) {
    return false;
  }

  try {
    const tempPath = filePath + '.tmp.mp3';

    // Build ffmpeg command
    let ffmpegCmd = `ffmpeg -y -i "${filePath}" -c:a libmp3lame`;

    // Set bitrate
    ffmpegCmd += ` -b:a ${CONFIG.targetBitrate}`;

    // Set sample rate
    ffmpegCmd += ` -ar ${CONFIG.targetSampleRate}`;

    // Convert to mono if enabled
    if (CONFIG.mono) {
      ffmpegCmd += ' -ac 1';
    }

    ffmpegCmd += ` "${tempPath}"`;

    if (CONFIG.dryRun) {
      // Estimate optimized size
      const duration = audioInfo.duration;
      const targetBitrateBps = parseInt(CONFIG.targetBitrate) * 1000 / 8;  // Convert to bytes per second
      const estimatedSize = Math.floor(duration * targetBitrateBps);
      const saved = originalSize - estimatedSize;
      const savedPercent = ((saved / originalSize) * 100).toFixed(2);

      console.log('\n📝 ' + relativePath);
      console.log('   原始: ' + formatBytes(originalSize));
      console.log('   预估优化后: ' + formatBytes(estimatedSize));
      console.log('   预估节省: ' + formatBytes(saved) + ' (' + savedPercent + '%)');
      console.log('   [DRY-RUN] 将进行转换');

      stats.optimized++;
      stats.optimizedSize += estimatedSize;
      stats.saved += saved;

      return true;
    }

    // Create backup
    if (CONFIG.backup) {
      fs.copyFileSync(filePath, filePath + '.bak');
    }

    // Execute ffmpeg
    execSync(ffmpegCmd, { stdio: 'ignore' });

    // Get optimized file size
    const optimizedSize = fs.statSync(tempPath).size;
    const saved = originalSize - optimizedSize;
    const savedPercent = ((saved / originalSize) * 100).toFixed(2);

    // Only replace if optimization actually saved space
    if (saved > 0) {
      fs.copyFileSync(tempPath, filePath);
      fs.unlinkSync(tempPath);

      console.log('\n📝 ' + relativePath);
      console.log('   原始: ' + formatBytes(originalSize));
      console.log('   优化后: ' + formatBytes(optimizedSize));
      console.log('   节省: ' + formatBytes(saved) + ' (' + savedPercent + '%)');
      console.log('   ✅ 已优化');

      stats.optimized++;
      stats.optimizedSize += optimizedSize;
      stats.saved += saved;

      return true;
    } else {
      // Optimization didn't help, remove temp file
      fs.unlinkSync(tempPath);

      if (CONFIG.backup) {
        fs.unlinkSync(filePath + '.bak');
      }

      return false;
    }
  } catch (error) {
    console.error('\n✗ 错误: ' + relativePath);
    console.error('   ' + error.message);
    stats.errors++;

    // Clean up temp file if exists
    try {
      if (fs.existsSync(filePath + '.tmp.mp3')) {
        fs.unlinkSync(filePath + '.tmp.mp3');
      }
    } catch (e) {
      // Ignore
    }

    return false;
  }
}

async function main() {
  console.log('🎵 HuLa 音频优化工具\n');

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
    console.log('用法: node scripts/optimize-audio.cjs [选项]\n');
    console.log('选项:');
    console.log('  --dry-run     仅查看会进行哪些优化，不实际修改文件');
    console.log('  --no-backup   不备份原文件（默认会备份）');
    console.log('  --help, -h    显示此帮助信息\n');
    console.log('优化策略:');
    console.log('  - 降低比特率到 64 kbps（适合提示音）');
    console.log('  - 转换为单声道（提示音不需要立体声）');
    console.log('  - 标准化采样率到 44.1 kHz\n');
    console.log('注意: 小于 10 KB 的文件将被跳过\n');
    process.exit(0);
  }

  console.log('🔧 配置:\n');
  console.log('   目标比特率: ' + CONFIG.targetBitrate);
  console.log('   目标采样率: ' + CONFIG.targetSampleRate + ' Hz');
  console.log('   单声道: ' + (CONFIG.mono ? '是' : '否'));
  console.log('   备份原文件: ' + (CONFIG.backup ? '是' : '否'));
  console.log('   目标目录: public/\n');

  const files = getAudioFiles(CONFIG.publicDir);
  console.log('📁 找到 ' + files.length + ' 个音频文件\n');

  if (files.length === 0) {
    console.log('✅ 没有需要优化的音频');
    process.exit(0);
  }

  console.log('开始处理...\n');
  console.log('─'.repeat(80) + '\n');

  for (const file of files) {
    try {
      await optimizeAudio(file);
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
    console.log('   2. 确认音频播放正常');
    console.log('   3. 删除备份: find public -name "*.bak" -delete');
    console.log('   4. 提交修改: git add . && git commit -m "chore(audio): optimize audio files"');
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main();
