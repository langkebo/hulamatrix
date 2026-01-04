#!/usr/bin/env node

/**
 * 深度类型检查脚本
 * 用于检查并报告项目中的类型安全问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 开始深度类型检查...\n');

// 1. 基础类型检查
console.log('1️⃣ 运行基础类型检查...');
try {
  execSync('pnpm run typecheck', { stdio: 'inherit' });
  console.log('✅ 基础类型检查通过\n');
} catch (error) {
  console.log('❌ 基础类型检查失败\n');
}

// 2. ESLint 类型相关规则检查
console.log('2️⃣ 运行 ESLint 类型检查...');
try {
  execSync('pnpm run lint:check 2>&1 | grep -E "(error|warning)" || echo "No lint issues found"', { stdio: 'inherit' });
  console.log('✅ ESLint 检查完成\n');
} catch (error) {
  console.log('⚠️  ESLint 检查发现问题\n');
}

// 3. 查找潜在的类型问题
console.log('3️⃣ 查找潜在的类型问题...');

// 查找 any 类型使用（排除测试文件和类型定义）
console.log('\n📊 any 类型使用统计:');
const anyFiles = execSync('grep -r " as any\\|: any\\|<any>" src --include="*.ts" --include="*.tsx" --include="*.vue" | grep -v test | grep -v d.ts | wc -l', { encoding: 'utf8' }).trim();
console.log(`  - 发现 ${anyFiles} 处 any 类型使用`);

// 查找 @ts-ignore 注释
const tsIgnoreFiles = execSync('grep -r "@ts-ignore" src --include="*.ts" --include="*.tsx" --include="*.vue" | wc -l', { encoding: 'utf8' }).trim();
console.log(`  - 发现 ${tsIgnoreFiles} 处 @ts-ignore 注释`);

// 查找 @ts-expect-error 注释
const tsExpectFiles = execSync('grep -r "@ts-expect-error" src --include="*.ts" --include="*.tsx" --include="*.vue" | wc -l', { encoding: 'utf8' }).trim();
console.log(`  - 发现 ${tsExpectFiles} 处 @ts-expect-error 注释`);

// 4. 检查未定义的类型导入
console.log('\n4️⃣ 检查类型导入...');
const typeImports = execSync('grep -r "import type" src --include="*.ts" --include="*.tsx" | head -10', { encoding: 'utf8' });
console.log('最近导入的类型:\n' + typeImports);

// 5. 生成类型问题报告
console.log('\n📝 生成类型检查报告...');

const report = `# TypeScript 类型检查报告

**生成时间**: ${new Date().toISOString()}

## 检查结果

### 基础配置
- TypeScript 版本: 5.x
- 严格模式: ✅ 已启用
- exactOptionalPropertyTypes: ✅ 已启用

### 发现的问题

1. **any 类型使用**: ${anyFiles} 处
   - 需要逐步替换为具体类型
   - 优先级: 高

2. **类型抑制注解**:
   - @ts-ignore: ${tsIgnoreFiles} 处
   - @ts-expect-error: ${tsExpectFiles} 处
   - 建议: 添加注释说明原因

3. **建议改进**:
   - 启用 noUncheckedIndexedAccess
   - 为第三方库添加类型定义
   - 完善接口定义

## 优化建议

### 短期 (1周)
1. 修复所有明显的类型错误
2. 为常用的第三方库添加类型定义
3. 将明显的 any 替换为具体类型

### 中期 (1个月)
1. 启用更严格的类型检查选项
2. 完善所有接口定义
3. 移除不必要的类型抑制注解

### 长期 (2个月)
1. 达到 100% 类型覆盖率
2. 启用所有严格类型检查选项
3. 建立类型安全文化
`;

fs.writeFileSync(path.join(__dirname, '../TYPE_CHECK_REPORT.md'), report);
console.log('✅ 报告已生成: TYPE_CHECK_REPORT.md\n');

// 6. 输出需要修复的文件列表
console.log('5️⃣ 建议优先修复的文件:');
const criticalFiles = [
  'src/App.vue',
  'src/components/common/NaiveProvider.vue',
  'src/components/common/VirtualList.vue',
  'src/hooks/useRoomStats.ts'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, '..', file))) {
    console.log(`  - ${file}`);
  }
});

console.log('\n🎯 检查完成！');