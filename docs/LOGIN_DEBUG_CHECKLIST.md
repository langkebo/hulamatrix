# 登录页面调试检查清单

**日期**: 2026-01-03
**问题**: 登录页面只显示按钮，看不到输入框和logo

---

## 请执行以下检查步骤并反馈结果

### 1. 检查 Tauri 桌面窗口

**操作**: 等待 Rust 编译完成后，查看自动打开的 Tauri 桌面窗口

**请确认**:
- [ ] Tauri 窗口是否自动打开？
- [ ] 窗口中是否显示了登录页面？
- [ ] 能看到哪些元素？（例如：只有按钮、只有顶部栏、完全空白等）

### 2. 检查浏览器控制台

**操作**:
1. 在 Tauri 窗口中按 `F12` 或 `Cmd+Option+I` (Mac) 打开开发者工具
2. 切换到 Console 标签页
3. 刷新页面 (Cmd+R 或 F5)
4. 复制所有**红色错误信息**

**请提供**:
- 所有的 ERROR 日志（特别是包含 `VueErrorHandler` 的）
- 是否有新的更详细的错误信息？（现在应该包含 `errorMessage`、`componentName` 等字段）

### 3. 检查元素面板

**操作**:
1. 在开发者工具中切换到 Elements 标签页
2. 查看页面结构

**请确认**:
- [ ] `<body>` 标签内是否有内容？
- [ ] 能否找到 `<div class="login-box">` 元素？
- [ ] 能否找到 `<n-input>` 或 `<input>` 元素？
- [ ] 截图当前的 Elements 树结构

### 4. 检查网络请求

**操作**:
1. 切换到 Network 标签页
2. 刷新页面
3. 查看是否有红色的请求（失败的状态码）

**请确认**:
- [ ] `main.ts` 是否加载成功？
- [ ] `Login.vue` 是否加载成功？
- [ ] 是否有 404 或 500 错误？

---

## 临时解决方案

### 方案 1: 使用浏览器直接访问

如果 Tauri 窗口有问题，可以先用浏览器测试：

```bash
# 在浏览器中访问
open http://localhost:6130/login
```

### 方案 2: 检查是否有 CSS 隐藏问题

在浏览器控制台中运行：

```javascript
// 检查登录框是否存在
const loginBox = document.querySelector('.login-box')
console.log('Login box:', loginBox)

// 检查输入框是否存在
const inputs = document.querySelectorAll('input[type="text"], input[type="password"]')
console.log('Inputs found:', inputs.length)

// 检查显示状态
console.log('Login box styles:', window.getComputedStyle(loginBox))
```

### 方案 3: 禁用 useDriver

如果 useDriver 导致问题，已在 Login.vue:585 添加了警告信息。

---

## 已完成的修复

✅ 1. 添加了 ActionBar 的显式导入
✅ 2. 改进了错误处理器，现在会输出详细的错误信息
✅ 3. 清除了所有缓存并重新启动
✅ 4. 修复了备份文件中的旧路径引用

---

## 需要的信息

为了进一步诊断，请提供：

1. **完整的错误日志** - 特别是新的包含 `errorMessage` 的错误
2. **截图** - Tauri 窗口的实际显示效果
3. **Elements 树结构** - 开发者工具中显示的 DOM 结构
4. **控制台的所有输出** - 包括 INFO、WARN、ERROR

---

**请执行上述检查并提供反馈，我会根据具体信息继续修复问题。**
