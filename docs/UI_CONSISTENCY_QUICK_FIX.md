# UI 一致性问题快速修复指南

**日期**: 2026-01-03
**优先级**: 🚨 高
**预计时间**: 30 分钟

---

## ⚡ 立即执行

### 1. 检查并安装 Vant 依赖

```bash
# 步骤 1: 检查 Vant 是否已安装
pnpm list vant

# 步骤 2: 如果未安装，执行安装
pnpm add vant

# 步骤 3: 验证安装
pnpm typecheck
```

### 2. 创建 Vant 主题配置

**文件**: `src/mobile/styles/vant-theme.scss`

```scss
/* Vant 主题覆盖 - 匹配 HuLa 品牌色 */
:root {
  /* 主要颜色 - 匹配 --hula-accent */
  --van-primary-color: #13987f;
  --van-success-color: #13987f;
  --van-warning-color: #ff976a;
  --van-danger-color: #ee0a24;

  /* 文字颜色 */
  --van-text-color: #18212c;
  --van-text-color-2: #576b95;
  --van-text-color-3: #9fa1a9;

  /* 背景颜色 */
  --van-background-color: #f7f8fa;
  --van-background-2: #fafafa;

  /* 边框颜色 */
  --van-border-color: #ebedf0;
  --van-active-color: #f2f3f5;
}

/* 深色模式 */
html[data-theme='dark'] {
  --van-primary-color: #82b2ac;
  --van-text-color: #ffffff;
  --van-text-color-2: rgba(255, 255, 255, 0.7);
  --van-text-color-3: rgba(255, 255, 255, 0.5);
  --van-background-color: #1a1a1a;
  --van-background-2: #242424;
  --van-border-color: #3a3a3a;
}
```

**文件**: `src/mobile/main.ts` (在入口文件引入)

```typescript
// 引入 Vant 主题样式
import './styles/vant-theme.scss'

// 其他导入...
import { createApp } from 'vue'
import { ConfigProvider } from 'vant'
// ...
```

### 3. 统一 Toast 和 Dialog 使用

**创建**: `src/mobile/utils/feedback.ts`

```typescript
import { showToast as vantShowToast, showLoadingToast as vantShowLoadingToast, closeToast } from 'vant'
import { useMessage, useDialog } from 'naive-ui'

// 统一的 Toast
export function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
  // 移动端使用 Vant
  vantShowToast({
    message,
    type: type === 'error' ? 'fail' : type,
  })
}

// 统一的 Loading
export function showLoading(message: string = '加载中...') {
  vantShowLoadingToast({
    message,
    forbidClick: true,
    duration: 0,
  })
}

export function hideLoading() {
  closeToast()
}

// 统一的确认对话框
export async function showConfirm(options: {
  title: string
  message: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = useDialog()
    dialog.warning({
      title: options.title,
      content: options.message,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
    })
  })
}
```

**使用方式**:
```typescript
import { showToast, showLoading, hideLoading, showConfirm } from '@/mobile/utils/feedback'

// 替换原有的 showToast
showToast('操作成功')

// 替换原有的 showLoading
showLoading('加载中...')
// ... 执行操作
hideLoading()

// 替换原有的 showConfirmDialog
const confirmed = await showConfirm({
  title: '确认删除',
  message: '此操作不可撤销，确定继续吗？'
})
if (confirmed) {
  // 执行删除
}
```

---

## 🔧 验证修复

### 检查清单

- [ ] Vant 依赖已安装
- [ ] 主题配置文件已创建
- [ ] 主题样式已引入
- [ ] Toast/Dialog 已统一
- [ ] TypeScript 编译通过
- [ ] 应用可正常启动

### 测试命令

```bash
# 类型检查
pnpm typecheck

# 构建
pnpm build

# 运行移动端
pnpm run dev:mobile
```

---

## 📋 后续优化建议

### 短期（本周完成）

1. **审查所有移动端组件**
   - 检查 Vant 和 Naive UI 混用情况
   - 标记需要迁移的组件

2. **创建组件映射表**
   ```
   Vant 组件 → Naive UI 组件
   van-button → n-button
   van-popup → n-drawer
   van-field → n-input
   van-cell → n-list-item
   ```

### 中期（本月完成）

1. **制定迁移计划**
   - 确定统一使用 Naive UI
   - 制定分阶段迁移方案

2. **实施组件迁移**
   - 按优先级迁移组件
   - 每迁移一个组件就测试

---

## 🚨 如果遇到问题

### 问题 1: Vant 安装失败

```bash
# 清理缓存后重试
pnpm store prune
pnpm install
pnpm add vant
```

### 问题 2: 主题不生效

```scss
// 确保 vant-theme.scss 在其他样式之后引入
// main.ts 中的顺序很重要
import './styles/vant-theme.scss'  // 最后引入
```

### 问题 3: TypeScript 错误

```bash
# 安装 Vant 类型定义
pnpm add -D @vant/auto-import-resolver
```

---

## 📞 需要帮助？

- 📖 查看完整报告: `docs/PC_MOBILE_UI_CONSISTENCY_ANALYSIS.md`
- 💬 提交问题: GitHub Issues
- 📧 联系团队: HuLaMatrix Team

---

**创建时间**: 2026-01-03
**预计完成时间**: 30 分钟
**难度**: ⭐⭐☆☆☆
