# HuLa 统一主题实施清单

**预计时间**: 10 分钟
**难度**: ⭐☆☆☆☆
**优先级**: 高

---

## ⚡ 5 步完成统一主题

### 第 1 步: 安装 Vant 依赖（移动端）

```bash
pnpm add vant
```

### 第 2 步: 更新 PC 端主入口

**文件**: `src/main.ts`

```typescript
// 在文件开头添加
import './styles/scss/global/theme-variables.scss'
```

### 第 3 步: 更新移动端主入口

**文件**: `src/mobile/main.ts`

```typescript
// 在文件开头添加
import '../../styles/scss/global/theme-variables.scss'
import './styles/vant-theme.scss'
```

### 第 4 步: 更新 PC 端 NaiveProvider

**文件**: `src/components/NaiveProvider.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { darkTheme } from 'naive-ui'
// 添加这行
import { hulaThemeOverrides, getNaiveUITheme } from '@/styles/theme/naive-theme'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const naiveTheme = computed(() => {
  const isDark = themeStore.isDark
  // 修改为使用 HuLa 主题
  return getNaiveUITheme(isDark)
})
</script>

<template>
  <n-config-provider
    :theme="naiveTheme"
    :theme-overrides="hulaThemeOverrides"  <!-- 使用 HuLa 主题覆盖 -->
    abstract
    inline-theme-disabled
  >
    <slot />
  </n-config-provider>
</template>
```

### 第 5 步: 验证效果

```bash
# 运行项目
pnpm dev

# 检查以下几点
# ✅ PC 端按钮是青绿色 (#13987f)
# ✅ 移动端按钮是青绿色 (#13987f)
# ✅ 深色模式切换正常
# ✅ 无报错
```

---

## 🎨 颜色对比

### 之前

| 组件库 | 主色 | 说明 |
|--------|------|------|
| Naive UI (PC) | #18a058 | 默认绿色 |
| Vant (移动) | #07c160 | Vant 默认绿色 |
| 一致性 | ❌ 不一致 | 两个不同的绿色 |

### 之后

| 组件库 | 主色 | 说明 |
|--------|------|------|
| Naive UI (PC) | #13987f | HuLa 强调色 ✅ |
| Vant (移动) | #13987f | HuLa 强调色 ✅ |
| 一致性 | ✅ 完全一致 | 统一的品牌色 |

---

## 📸 预期效果

### PC 端

```
按钮: [🟢 确认] - #13987f (青绿色)
输入框焦点: ━━━━━━━━ - #13987f (青绿色边框)
选中状态: ☑️ - #13987f (青绿色)
```

### 移动端

```
按钮: [🟢 确认] - #13987f (青绿色)
输入框焦点: ━━━━━━━━ - #13987f (青绿色边框)
选中状态: ☑️ - #13987f (青绿色)
```

### 深色模式

```
背景: 深色 (自动切换)
文字: 白色 (自动切换)
主色: 提亮的青绿色 (自动切换)
```

---

## ✅ 验证清单

运行项目后检查：

- [ ] PC 端按钮颜色是 `#13987f`
- [ ] 移动端按钮颜色是 `#13987f`
- [ ] 输入框焦点颜色是 `#13987f`
- [ ] 深色模式切换正常
- [ ] 无控制台错误
- [ ] 滚动条是青绿色
- [ ] 所有组件颜色统一

---

## 🚨 如果遇到问题

### 问题: 移动端颜色没变化

```bash
# 确保引入顺序正确
# main.ts 中应该是这样：
import '../../styles/scss/global/theme-variables.scss'  # 先
import './styles/vant-theme.scss'  # 后
```

### 问题: TypeScript 报错

```bash
# 确保 naive-theme.ts 文件存在
ls src/styles/theme/naive-theme.ts

# 如果不存在，说明前面的步骤没完成
```

### 问题: 深色模式不生效

```typescript
// 确保正确设置了 data-theme 属性
// 在主题切换时执行
document.documentElement.setAttribute('data-theme', 'dark')
```

---

## 🎯 完成！

完成后，您的应用将拥有：

- ✅ PC 端和移动端完全统一的主题
- ✅ HuLa 品牌色（青绿色 #13987f）
- ✅ 深色/浅色模式自动切换
- ✅ 所有组件颜色一致
- ✅ 专业的视觉体验

---

**下一步**: 查看完整文档 `docs/HULA_THEME_UNIFIED_GUIDE.md`

**需要帮助**: 查看 `docs/PC_MOBILE_UI_CONSISTENCY_ANALYSIS.md`
