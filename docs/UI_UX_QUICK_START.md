# HuLa UI/UX 优化快速使用指南

> 🎯 快速上手 UI/UX 优化工具和最佳实践

---

## 📋 目录

- [快速检查](#快速检查)
- [自动修复](#自动修复)
- [图片优化](#图片优化)
- [CI/CD 集成](#cicd-集成)
- [常见问题](#常见问题)

---

## 🚀 快速检查

### 1. 完整 UI/UX 审计

```bash
pnpm uiux:audit
```

这将依次执行：
- ✅ UI/UX 问题检查（动画、hover、alt 属性等）
- ✅ 设计令牌验证（硬编码值检查）
- ✅ 图片优化分析（dry-run 模式）

### 2. 单独检查项

```bash
# 只检查 UI/UX 问题
pnpm uiux:check

# 只检查设计令牌
pnpm uiux:tokens

# 只分析图片（不修改）
pnpm uiux:images:dry
```

---

## 🔧 自动修复

### 修复 UI/UX 问题

```bash
# 预览将进行的修复（安全模式）
pnpm uiux:fix:dry

# 执行自动修复
pnpm uiux:fix
```

**自动修复内容包括**：
- 过长的动画时长 → 200ms
- `hover:scale` → `hover:opacity-90`
- 为图片添加 `alt` 属性
- 为可点击元素添加 `cursor-pointer`

### 查看修复结果

```bash
# 查看修改的文件
git status

# 查看具体修改
git diff

# 添加并提交
git add .
git commit -m "fix(ui/ux): apply automated fixes"
```

---

## 🖼️ 图片优化

### 分析优化潜力

```bash
pnpm uiux:images:dry
```

**输出示例**：
```
📊 public/emoji/party-popper.webp
   当前大小: 198K
   目标大小: 50K
   预计节省: 148K (75%)
   操作: compress
   ✅ 已优化: 198K → 52K
```

### 执行图片优化

```bash
# 确保已安装 ffmpeg
# macOS: brew install ffmpeg
# Ubuntu: apt install ffmpeg

# 执行优化
pnpm uiux:images
```

**优化目标**：
- 表情包：< 50KB/个
- 头像：< 30KB/个
- 文件图标：< 5KB/个

**预计效果**：
- 表情包总大小：1.1MB → ~400KB（节省 64%）

---

## 🔄 CI/CD 集成

### GitHub Actions 工作流

文件：`.github/workflows/ui-ux-quality.yml`

**触发条件**：
- Push 到 `master/main/develop`
- 创建 Pull Request
- 每天凌晨 2 点

**检查内容**：
1. UI/UX Audit
2. Design Tokens Check
3. Lighthouse CI（性能 + 可访问性）
4. Pa11y 测试
5. 图片优化检查

### 本地运行 CI 检查

```bash
# 安装 Pa11y（可访问性测试工具）
npm install -g pa11y

# 构建项目
pnpm build

# 启动开发服务器（后台）
pnpm dev &
SERVER_PID=$!

# 等待服务器启动
sleep 30

# 运行 Pa11y 测试
pa11y http://localhost:6130

# 停止服务器
kill $SERVER_PID
```

---

## 📊 优化报告

### 生成报告

运行检查后会自动生成报告：

```bash
pnpm uiux:check

# 报告文件
cat ui-ux-report.json
```

### 报告内容

```json
{
  "long-animation": [...],
  "hover-scale": [...],
  "missing-alt": [...],
  "missing-cursor": [...],
  "empty-alt": [...]
}
```

---

## 💡 最佳实践

### 1. 开发前检查

```bash
# 每天开始工作前运行
pnpm uiux:audit
```

### 2. 提交前检查

```bash
# 提交代码前自动修复问题
pnpm uiux:fix
git add .
git commit
```

### 3. 定期优化

```bash
# 每周执行一次图片优化
pnpm uiux:images:dry
```

### 4. PR 前检查

```bash
# 创建 PR 前运行完整检查
pnpm uiux:audit
```

---

## 🛠️ 使用 LazyImage 组件

### 基础用法

```vue
<script setup>
import LazyImage from '@/components/common/LazyImage.vue'

const imageUrl = ref('mxc://example.com/abc123')
</script>

<template>
  <LazyImage
    :mxc-url="imageUrl"
    alt="用户头像"
    :width="256"
    :height="256"
    @loaded="handleLoad"
    @error="handleError"
  />
</template>
```

### 高级用法

```vue
<template>
  <LazyImage
    :mxc-url="imageUrl"
    alt="产品图片"
    :width="800"
    :height="600"
    method="crop"
    :size="400"
    :lazy-options="{ rootMargin: '100px', threshold: 0.1 }"
    placeholder="/placeholder.jpg"
    :fade-in-duration="300"
    fit="cover"
    @in-view="handleInView"
    @cached="handleCached"
  >
    <template #placeholder>
      <div class="custom-placeholder">
        <span>加载中...</span>
      </div>
    </template>

    <template #error>
      <div class="custom-error">
        <span>加载失败</span>
        <button @click="$refs.imageRef.retry()">重试</button>
      </div>
    </template>
  </LazyImage>
</template>
```

---

## 🎨 设计令牌使用

### 颜色

```css
/* ✅ 正确：使用 CSS 变量 */
.button {
  background: var(--hula-brand-primary);
  color: var(--hula-gray-900);
}

/* ❌ 错误：硬编码颜色 */
.button {
  background: #00BFA5;
  color: #1a1a1a;
}
```

### 间距

```css
/* ✅ 正确：使用 8px 基础单位 */
.container {
  padding: var(--padding-md);  /* 16px */
  gap: var(--spacing-sm);       /* 8px */
}

/* ❌ 错误：非 8 的倍数 */
.container {
  padding: 14px;
  gap: 7px;
}
```

### 动画

```css
/* ✅ 正确：150-300ms */
.fade-in {
  transition: opacity var(--duration-base) var(--ease-out);
}

/* ❌ 错误：过长动画 */
.fade-in {
  transition: opacity 1000ms ease;
}
```

### 圆角

```css
/* ✅ 正确：标准圆角值 */
.card {
  border-radius: var(--radius-lg);  /* 12px */
}

/* ❌ 错误：非标准值 */
.card {
  border-radius: 13px;
}
```

---

## ❓ 常见问题

### Q1: 自动修复会破坏我的代码吗？

**A**: 不会。修复脚本只修复明确的反模式：
- 将过长的动画改为 200ms
- 将 hover:scale 改为 hover:opacity
- 添加缺失的 alt 属性
- 添加 cursor-pointer

建议先用 `--dry-run` 预览。

### Q2: 图片优化会降低质量吗？

**A**: 不会明显降低。使用 80% 质量（WebP），在保持视觉质量的同时大幅减小文件大小。建议先用 `--dry-run` 查看。

### Q3: CI 检查失败怎么办？

**A**:
1. 查看详细报告
2. 运行 `pnpm uiux:fix` 自动修复
3. 提交修复
4. 等待 CI 重新运行

### Q4: 如何忽略某些检查？

**A**: 编辑脚本中的 `CONFIG` 部分：
```javascript
// scripts/ui-ux-check.cjs
ignorePatterns: [
  'your-specific-file.vue'
]
```

### Q5: 硬编码颜色太多怎么办？

**A**:
1. 运行 `pnpm uiux:tokens` 查看所有问题
2. 优先修复高频使用的组件
3. 逐步迁移到设计令牌
4. 参考 `docs/DESIGN_TOKENS.md`

---

## 📚 相关文档

- [UI/UX 审计报告](./UI_UX_AUDIT_REPORT.md)
- [设计令牌指南](./DESIGN_TOKENS.md)
- [Phase 3 总结](./PHASE_3_SUMMARY.md)
- [组件开发指南](./COMPONENT_DEVELOPMENT_GUIDELINES.md)

---

## 🚀 下一步

1. **立即检查**: `pnpm uiux:audit`
2. **自动修复**: `pnpm uiux:fix`
3. **优化图片**: `pnpm uiux:images:dry`
4. **学习最佳实践**: 阅读 `docs/DESIGN_TOKENS.md`
5. **监控 CI**: 查看 GitHub Actions 结果

---

**需要帮助？**
- 查看项目 Issues
- 联系维护团队
- 阅读详细文档

**版本**: 1.0.0
**更新日期**: 2026-01-09
