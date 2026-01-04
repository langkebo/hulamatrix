#!/usr/bin/env node

/**
 * 自动修复常见类型问题脚本
 * 修复一些可以自动处理的类型问题
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始自动修复常见类型问题...\n');

let fixedCount = 0;

// 1. 修复 parseInt 缺少 radix 参数的问题
console.log('1️⃣ 修复 parseInt radix 参数...');
const filesToFix = [
  'src/hooks/useChatMain.ts',
  'src/components/common/VirtualList.vue',
  'src/hooks/useTimerManager.ts'
];

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // 修复 parseInt 缺少 radix
    content = content.replace(/parseInt\s*\(\s*([^,)]+)\s*\)/g, 'parseInt($1, 10)');

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      fixedCount++;
      console.log(`  ✅ 修复 ${filePath}`);
    }
  }
});

// 2. 添加必要的 Vue 导入
console.log('\n2️⃣ 检查并添加必要的 Vue 导入...');
const vueFiles = [
  'src/App.vue',
  'src/components/common/DynamicList.vue',
  'src/components/common/InfoPopover.vue',
  'src/components/common/NaiveProvider.vue',
  'src/components/rightBox/chatBox/ChatSidebar.vue'
];

vueFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // 检查是否使用了 Vue API 但没有导入
    const hasComputed = content.includes('computed(') && !content.includes('import { computed }');
    const hasRef = content.includes('ref(') && !content.includes('import { ref }');
    const hasWatch = content.includes('watch(') && !content.includes('import { watch }');
    const hasOnMounted = content.includes('onMounted(') && !content.includes('import { onMounted }');
    const hasOnUnmounted = content.includes('onUnmounted(') && !content.includes('import { onUnmounted }');
    const hasWatchEffect = content.includes('watchEffect(') && !content.includes('import { watchEffect }');
    const hasNextTick = content.includes('nextTick(') && !content.includes('import { nextTick }');

    if (hasComputed || hasRef || hasWatch || hasOnMounted || hasOnUnmounted || hasWatchEffect || hasNextTick) {
      const neededImports = [];
      if (hasRef) neededImports.push('ref');
      if (hasComputed) neededImports.push('computed');
      if (hasWatch) neededImports.push('watch');
      if (hasWatchEffect) neededImports.push('watchEffect');
      if (hasOnMounted) neededImports.push('onMounted');
      if (hasOnUnmounted) neededImports.push('onUnmounted');
      if (hasNextTick) neededImports.push('nextTick');

      const importLine = neededImports.length > 0
        ? `import { ${neededImports.join(', ')} } from 'vue'\n`
        : '';

      // 查找 script 标签
      const scriptMatch = content.match(/<script[^>]*setup[^>]*>([\s\S]*?)<\/script>/);
      if (scriptMatch) {
        let scriptContent = scriptMatch[1];

        // 如果已经有 Vue 相关导入，添加到现有导入中
        if (scriptContent.includes("import {")) {
          scriptContent = scriptContent.replace(
            /(import {[^}]*})([^}\n]*})/g,
            (match, imports, rest) => {
              if (imports.includes('vue')) {
                return imports; // 已经有 Vue 导入
              }
              // 在其他导入后添加 Vue 导入
              return imports + '}\n' + importLine;
            }
          );
        } else {
          // 在开头添加 Vue 导入
          scriptContent = importLine + scriptContent;
        }

        content = content.replace(scriptMatch[0], `<script${scriptMatch[1]}>${scriptContent}</script>`);
      }
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      fixedCount++;
      console.log(`  ✅ 修复 ${filePath}`);
    }
  }
});

// 3. 修复 optional 属性类型
console.log('\n3️⃣ 修复可选属性类型问题...');
const optionalPropFiles = [
  'src/components/rightBox/renderMessage/Text.vue',
  'src/components/rightBox/renderMessage/index.vue'
];

optionalPropFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // 修复 ? 可选操作符后的类型断言
    content = content.replace(/(\w+)\?\s*:\s*[^,\n}]+/g, (match) => {
      return match.replace('?', '?:');
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      fixedCount++;
      console.log(`  ✅ 修复 ${filePath}`);
    }
  }
});

// 4. 创建类型定义文件
console.log('\n4️⃣ 创建缺失的类型定义...');
const typeDefDir = 'src/types';
if (!fs.existsSync(typeDefDir)) {
  fs.mkdirSync(typeDefDir, { recursive: true });
}

// 创建 vue-cropper 类型定义
const vueCropperTypes = `
declare module 'vue-cropper' {
  import { DefineComponent } from 'vue';

  interface VueCropperOptions {
    img?: string;
    outputSize?: number;
    outputType?: string;
    info?: boolean;
    full?: boolean;
    canMove?: boolean;
    canMoveBox?: boolean;
    original?: boolean;
    autoCrop?: boolean;
    autoCropWidth?: number;
    autoCropHeight?: number;
    fixedBox?: boolean;
    fixed?: boolean;
    fixedNumber?: [number, number];
    centerBox?: boolean;
    infoTrue?: boolean;
    maxImgSize?: number;
    enlarge?: number;
    mode?: string;
  }

  const VueCropper: DefineComponent<VueCropperOptions>;

  export default VueCropper;
}
`;

fs.writeFileSync(path.join(typeDefDir, 'vue-cropper.d.ts'), vueCropperTypes);
console.log('  ✅ 创建 vue-cropper.d.ts');

// 5. 修复 null/undefined 检查
console.log('\n5️⃣ 添加 null 检查提示...');
const nullCheckFiles = [
  'src/components/common/VirtualList.vue',
  'src/components/e2ee/DeviceManager.vue'
];

nullCheckFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // 添加可选链操作符
    content = content.replace(/(\w+)\.([\w]+)(?!\?)/g, '$1?.$2');

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      fixedCount++;
      console.log(`  ✅ 修复 ${filePath}`);
    }
  }
});

console.log(`\n🎉 完成！共修复了 ${fixedCount} 个文件。`);
console.log('\n📝 后续建议：');
console.log('1. 运行 pnpm run typecheck 验证修复效果');
console.log('2. 手动检查并修复剩余的类型问题');
console.log('3. 考虑启用更严格的类型检查选项');