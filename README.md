<p align="center">
  <img width="350px" height="150px" src="public/hula.png"/>
</p>

<p align="center">一款基于 Tauri 2.0、Vite 7、Vue 3 和 TypeScript 构建的跨平台即时通讯应用</p>

<br>

<!-- 技术栈 -->
<div align="center">
  <p>
    <img src="https://img.shields.io/badge/Vue3-35495E?logo=vue.js&logoColor=4FC08D">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff">
    <img src="https://img.shields.io/badge/Vite7-646CFF?logo=vite&logoColor=fff">
    <img src="https://img.shields.io/badge/Tauri2.0-24C8DB?logo=tauri&logoColor=FFC131">
    <img src="https://img.shields.io/badge/Rust-c57c54?logo=rust&logoColor=E34F26">
    <img src="https://img.shields.io/badge/UnoCSS-333333?logo=unocss&logoColor=fff">
    <img src="https://img.shields.io/badge/Sass-CC6699?logo=sass&logoColor=fff">
    <img src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=fff">
  </p>
</div>

<br>

<!-- 快速链接 -->
<div align="center">
  <h3>🔗 快速链接</h3>

  <p>
    📝 <strong>开发文档：</strong><a href="CLAUDE.md">开发者指南</a> / <a href="docs/PROJECT_OPTIMIZATION_PLAN_V2.md">优化计划</a>
  </p>
  <p>
    📦 <strong>GitHub：</strong><a href="https://github.com/langkebo/hulamatrix">仓库地址</a>
  </p>
</div>

<p align="center">
  中文 |
  <a href="README.en.md">English</a>
</p>

> [!NOTE]
> 本项目是一个基于 Tauri 2.0 构建的跨平台即时通讯应用，集成 Matrix 协议实现联邦通信。采用单一代码库，支持 Windows、macOS、Linux、iOS 和 Android 六大平台。

## 🌐 支持平台

| 平台 | 支持版本 | 构建状态 | 说明 |
|------|----------|----------|------|
| **Windows** | Windows 10/11 | ✅ 完全支持 | 原生性能体验 |
| **macOS** | macOS 10.15+ | ✅ 完全支持 | Intel + Apple Silicon |
| **Linux** | Ubuntu 22.04+ | ✅ 完全支持 | 主要发行版支持 |
| **iOS** | iOS 12.0+ | ✅ 完全支持 | 需要 macOS 开发环境 |
| **Android** | Android 12+ (SDK 30+) | ✅ 完全支持 | 64 位设备 |

### iOS 支持详情

✅ **完整功能支持**:
- ✅ iOS 原生应用打包（.ipa）
- ✅ 推送通知支持
- ✅ 安全区域适配 (Safe Area Insets)
- ✅ 相机/相册访问
- ✅ 麦克风录音
- ✅ 文件选择器
- ✅ 二维码扫描
- ✅ 震动反馈
- ✅ 触摸手势优化
- ✅ 移动端专用 UI 组件

⚙️ **开发要求**:
- macOS 12+ (Monterey 或更高版本)
- Xcode 15+
- iOS 12.0+ 部署目标
- CocoaPods (依赖管理)

## 📝 项目介绍

HuLa 是一款基于 Tauri 2.0 构建的现代化跨平台即时通讯应用。项目采用 Rust 作为后端，Vue 3 + TypeScript 作为前端，通过单一代码库实现桌面端和移动端的完整功能。

### 核心特性

- **🎯 单一代码库**: 一套代码同时支持桌面端 (Windows/macOS/Linux) 和移动端 (iOS/Android)
- **🌐 Matrix 联邦**: 集成 Matrix 协议，支持跨服务器去中心化通信
- **💾 本地优先**: SQLite 本地数据库 + Sea-ORM，支持离线消息队列
- **🔒 端到端加密**: 支持 Matrix E2EE (可选功能，渐进式启用)
- **⚡ 原生性能**: Tauri 2.0 + Rust 后端，内存占用低，启动速度快
- **🎨 现代化 UI**: Naive UI + UnoCSS，支持深色/浅色主题切换

## 🛠️ 技术栈

### 前端技术

- **Vue 3.5+**: Composition API + `<script setup>`
- **TypeScript 5.8+**: 严格类型检查
- **Vite 7**: 新一代前端构建工具，极快的 HMR
- **Naive UI**: Vue 3 组件库，桌面端 UI
- **Vant 4**: 移动端 UI 组件库
- **UnoCSS**: 原子化 CSS 引擎
- **Pinia**: Vue 3 状态管理，支持持久化
- **Vue Router 4**: 路由管理

### 后端技术

- **Tauri 2.0**: 跨平台应用框架 (支持移动端)
- **Rust 1.80+**: 系统级性能
- **Sea-ORM**: 异步 ORM 框架
- **SQLite**: 嵌入式数据库
- **Tokio**: 异步运行时
- **Serde**: 序列化/反序列化
- **Tauri Plugin**:
  - Barcode Scanner (二维码扫描)
  - Notification (推送通知)
  - Safe Area Insets (安全区域适配)
  - Haptics (震动反馈)

### 通信协议

- **Matrix SDK**: 联邦通信协议
- **WebSocket**: 自定义实时双向通信
- **HTTP/HTTPS**: RESTful API

## 🖼️ 项目预览

<div align="center">
  <h4>桌面端界面 (macOS)</h4>
</div>

<div align="center">
  <img src="preview/img.png" alt="主界面" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img_1.png" alt="聊天对话" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img_2.png" alt="联系人" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img_3.png" alt="设置界面" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
</div>

<div align="center">
  <h4>移动端界面 (iOS/Android)</h4>
</div>

<div align="center">
  <img src="preview/img3-1.webp" alt="移动端1" width="220" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img3-2.webp" alt="移动端2" width="220" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img3-3.webp" alt="移动端3" width="220" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img3-4.webp" alt="移动端4" width="220" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
</div>

## ✨ 功能特性

### 🔐 用户认证

| 功能 | 描述 | 状态 |
| ---- | ---- | ---- |
| 🔑 | 账号密码登录 | ✅ 完成 |
| 📱 | 二维码扫码登录 | ✅ 完成 |
| 💻 | 多设备登录管理 | ✅ 完成 |
| 🔒 | 端到端加密 | 🟧 开发中 |

### 💬 消息通信

| 功能 | 描述 | 状态 |
| ---- | ---- | ---- |
| 👤 | 一对一私聊 | ✅ 完成 |
| 👥 | 群组聊天 | ✅ 完成 |
| ↩️ | 消息撤回 | ✅ 完成 |
| 📢 | @提醒、回复功能 | ✅ 完成 |
| 👁️ | 消息已读状态 | ✅ 完成 |
| 😊 | 表情包功能 | ✅ 完成 |
| 🖱️ | 消息右键菜单 | ✅ 完成 |
| 🔗 | 链接预览卡片 | ✅ 完成 |
| 👍 | 消息点赞互动 | ✅ 完成 |
| 📔 | 历史记录管理 | ✅ 完成 |
| 📎 | 文件传输 | ✅ 完成 |
| 📍 | 位置共享 | ✅ 完成 |
| 🔊 | 语音消息 | ✅ 完成 |

### 🤝 社交管理

| 功能 | 描述 | 状态 |
| ---- | ---- | ---- |
| ➕ | 好友添加与删除 | ✅ 完成 |
| 🔍 | 好友搜索 | ✅ 完成 |
| 🏢 | 群组创建与管理 | ✅ 完成 |
| 🟢 | 好友在线状态 | ✅ 完成 |
| 🏷️ | 备注昵称管理 | ✅ 完成 |
| 🚫 | 屏蔽拉黑免打扰 | ✅ 完成 |
| 📤 | 消息转发 | ✅ 完成 |
| 📋 | 群公告功能 | ✅ 完成 |
| 🔥 | 扫码进群 | ✅ 完成 |

### 🎨 界面体验

| 功能 | 描述 | 状态 |
| ---- | ---- | ---- |
| 🖼️ | 现代化界面设计 | ✅ 完成 |
| 🌙 | 深色浅色主题 | ✅ 完成 |
| 🎭 | 皮肤主题切换 | ✅ 完成 |
| 🌍 | i18n 国际化 | 🟧 98% |
| 📱 | 响应式设计 | ✅ 完成 |

### 🛠️ 桌面端功能

| 功能 | 描述 | 状态 |
| ---- | ---- | ---- |
| 🪟 | 多窗口管理 | ✅ 完成 |
| 🔔 | 系统托盘通知 | ✅ 完成 |
| 📷 | 图片查看器 | ✅ 完成 |
| ✂️ | 截图功能 | ✅ 完成 |
| 🎙️ | 语音通话 | 🟧 部分完成 |
| 🎥 | 视频通话 | 🟧 部分完成 |
| ⌨️ | 全局快捷键管理 | ✅ 完成 |
| 📺 | 独立媒体查看器 | ✅ 完成 |
| 📁 | 文件管理器 | ✅ 完成 |
| 🔄 | 自动更新系统 | ✅ 完成 |
| 📊 | 目录扫描统计 | ✅ 完成 |
| 🎬 | 视频缩略图生成 | ✅ 完成 |
| 🔊 | 音频录制与播放 | ✅ 完成 |

### 📱 移动端功能 (iOS/Android)

| 功能 | 描述 | 状态 |
| ---- | ---- | ---- |
| 📲 | 原生应用打包 | ✅ 完成 |
| 📳 | 推送通知 | ✅ 完成 |
| 📸 | 相机/相册访问 | ✅ 完成 |
| 🎤 | 麦克风录音 | ✅ 完成 |
| 📁 | 文件选择器 | ✅ 完成 |
| 📷 | 二维码扫描 | ✅ 完成 |
| 📳 | 震动反馈 | ✅ 完成 |
| 📐 | 安全区域适配 | ✅ 完成 |
| 👆 | 触摸手势优化 | ✅ 完成 |
| 📱 | 移动端专用 UI | ✅ 完成 |

### 🌐 Matrix 联邦功能

| 功能 | 描述 | 状态 |
| ---- | ---- | ---- |
| 🏠 | 房间创建与加入 | ✅ 完成 |
| 👥 | 成员管理 | ✅ 完成 |
| 🔍 | 消息搜索 | ✅ 完成 |
| 😀 | 消息反应 | ✅ 完成 |
| 📜 | 线程讨论 | ✅ 完成 |
| 🌌 | Spaces 空间 | ✅ 完成 |

## 📥 安装与运行

### 环境要求

- **Node.js**: ^20.19.0 或 >=22.12.0
- **pnpm**: >=10.x (强制要求，有 preinstall hook)
- **Rust**: 最新稳定版
- **平台特定要求**:
  - **Windows**: Windows 10 以上，WebView2
  - **macOS**:
    - 桌面开发: Xcode 命令行工具
    - **iOS 开发**: Xcode 15+, macOS 12+ (Monterey)
  - **Linux**: WebView2 或 WebKitGTK
  - **Android**: Android SDK API 30+, Android Studio
  - **iOS**: Xcode 15+, CocoaPods (仅 macOS)

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/langkebo/hulamatrix.git
cd HuLa

# 2. 安装依赖 (必须使用 pnpm)
pnpm install

# 3. 复制环境变量配置
cp .env.example .env

# 4. 编辑 .env 文件，配置必要的环境变量
# 至少需要配置：
# VITE_MATRIX_SERVER_NAME=your-server.com
```

### 开发运行

#### 桌面端开发

```bash
# macOS / Windows / Linux
pnpm run tauri:dev
# 或使用简化命令
pnpm run td
```

#### Android 开发

```bash
# 启动 Android 开发服务器
pnpm run tauri:android:dev
# 或使用简化命令
pnpm run adev

# Windows 下模拟 Android 环境 (仅 web)
pnpm run adev:win
```

#### iOS 开发 (仅限 macOS)

```bash
# 启动 iOS 开发服务器
pnpm run tauri:ios:dev
# 或使用简化命令
pnpm run idev

# macOS 下启动 iOS 纯前端 (无 Rust 后端)
pnpm run idev:mac
```

#### Web 端开发 (仅 UI)

```bash
# 桌面端 web 开发 (端口 6130)
pnpm run dev

# 移动端 web 开发 (端口 5210)
# 需要先设置环境变量
TAURI_ENV_PLATFORM=android pnpm run dev
```

### 生产构建

#### 桌面端构建

```bash
# 交互式构建脚本
pnpm run tauri:build
# 或使用简化命令
pnpm run tb

# 选择目标平台:
# - Windows (仅 Windows)
# - macOS (仅 macOS)
# - Linux (仅 Linux)
```

#### Android 构建

```bash
# 构建 APK
pnpm run tauri:android:build

# 构建 APK 并签名
# 需要在 .env 中配置签名信息
```

#### iOS 构建 (仅限 macOS)

```bash
# 构建 iOS 应用
pnpm run tauri:ios:build

# 生成 .ipa 文件
# 需要 Apple Developer 账号进行签名
```

## ⚙️ 配置说明

### 环境变量 (.env)

```bash
# ============= Matrix 集成配置 =============
VITE_MATRIX_ENABLED=on                    # 总开关
VITE_MATRIX_ROOMS_ENABLED=on              # 房间/消息模块
VITE_MATRIX_MEDIA_ENABLED=off             # 媒体上传 (灰度)
VITE_MATRIX_E2EE_ENABLED=off              # 端到端加密 (灰度)
VITE_MATRIX_RTC_ENABLED=off               # WebRTC 通话 (灰度)
VITE_MATRIX_ADMIN_ENABLED=off             # 管理 API (灰度)

# ============= Matrix 服务器配置 =============
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top
VITE_MATRIX_SERVER_NAME=your-server.com    # 服务器域名
VITE_MATRIX_DEV_SYNC=false                # 开发时自动同步

# ============= 应用配置 =============
VITE_APP_NAME="HuLa"
VITE_APP_VERSION=3.0.5

# ============= 功能开关 =============
VITE_MOBILE_FEATURES_ENABLED=off          # 移动端高级特性
VITE_SYNAPSE_FRIENDS_ENABLED=on           # Synapse 好友扩展
```

### YAML 配置 (Rust 后端)

配置文件位于 `src-tauri/configuration/`:

- **base.yaml**: 配置模板 (包含所有可用选项)
- **local.yaml**: 本地覆盖 (自动创建，已 gitignore)
- **production.yaml**: 生产环境设置

主要配置项:
```yaml
# 服务器地址
backend:
  base_url: "https://api.example.com"

# 数据库
database:
  path: "hula.db"

# 日志级别
log:
  level: "info"  # debug, info, warn, error

# ICE 服务器 (WebRTC)
ice_servers:
  - urls: "stun:stun.l.google.com:19302"
```

## 🏗️ 项目结构

```
HuLa/
├── src/                      # 前端源代码
│   ├── components/           # Vue 组件
│   │   ├── common/          # 通用组件
│   │   ├── matrix/          # Matrix 相关组件
│   │   ├── rtc/             # WebRTC 通话组件
│   │   ├── chat/            # 聊天组件
│   │   ├── mobile/          # 移动端专用组件
│   │   └── ...
│   ├── stores/              # Pinia 状态管理
│   │   └── core/            # 核心 Store
│   ├── services/            # API 服务层
│   │   ├── matrix*          # Matrix 集成服务
│   │   └── tauriCommand.ts  # Tauri 命令封装
│   ├── hooks/               # Vue 3 Composables
│   ├── utils/               # 工具函数
│   ├── mobile/              # 移动端专用代码
│   │   ├── components/      # 移动端组件
│   │   ├── layout/          # 移动端布局
│   │   └── views/           # 移动端视图
│   └── views/               # 桌面端视图
├── src-tauri/               # Rust 后端
│   ├── src/
│   │   ├── command/         # Tauri 命令 (暴露给前端)
│   │   ├── entity/          # 数据库实体 (Sea-ORM)
│   │   ├── repository/      # 数据访问层
│   │   ├── websocket/       # WebSocket 客户端
│   │   ├── desktops/        # 桌面端专用代码
│   │   ├── mobiles/         # 移动端专用代码
│   │   │   ├── init.rs      # 移动端初始化
│   │   │   ├── splash.rs    # 启动屏
│   │   │   └── keyboard.rs  # 键盘处理
│   │   └── configuration/   # YAML 配置加载器
│   ├── capabilities/        # Tauri 权限配置
│   │   ├── default.json     # 默认权限
│   │   ├── desktop.json     # 桌面端权限
│   │   └── mobile.json      # 移动端权限 (iOS + Android)
│   └── gen/                 # 生成的平台代码
├── locales/                 # 国际化文件
├── public/                  # 静态资源
├── preview/                 # 预览图片
├── docs/                    # 项目文档
│   ├── PROJECT_OPTIMIZATION_PLAN_V2.md
│   └── ...
├── CLAUDE.md                # 开发者指南
└── README.md                # 本文件
```

## 🧪 测试

```bash
# 运行测试
pnpm run test:run

# 测试覆盖率
pnpm run coverage

# Vitest UI 模式
pnpm run test:ui
```

## 📋 提交规范

本项目使用 Commitlint 进行提交规范检查：

```bash
# 使用交互式提交
pnpm run commit

# 按照提示选择:
# - feat: 新功能
# - fix: 修复
# - docs: 文档
# - style: 格式
# - refactor: 重构
# - perf: 性能优化
# - test: 测试
# - chore: 构建/工具
```

## ⚠️ 注意事项

### macOS 用户

#### 安装"已损坏"的应用

下载的安装包可能提示"已损坏"，执行以下命令解决：

```bash
# 安装前执行
sudo xattr -rd com.apple.quarantine /path/to/installer.dmg

# 如果已安装
sudo xattr -r -d com.apple.quarantine /Applications/HuLa.app
```

#### iOS 开发

iOS 开发和构建 **只能在 macOS 上进行**：

1. 确保安装 Xcode 15+
2. 安装 CocoaPods: `sudo gem install cocoapods`
3. 首次运行时，Tauri 会自动配置 iOS 项目
4. 真机调试需要 Apple Developer 账号

### Android 开发

1. 安装 Android Studio
2. 配置 Android SDK API 30+
3. 启用 USB 调试 (真机测试)
4. 首次运行时，Tauri 会自动 Gradle 同步

### 开发提示

- **必须使用 `pnpm`**: 项目有 preinstall hook 强制要求
- **配置修改后重启**: 修改 `.env` 或 YAML 后需重启开发服务器
- **自动配置**: 首次运行会自动创建 `local.yaml`
- **平台检测**: 使用 `import.meta.env.TAURI_ENV_PLATFORM` 检测平台

## 🚀 性能优化

项目已进行多轮性能优化：

- ✅ **内存泄漏修复**: 所有事件监听器正确清理
- ✅ **v-for key 优化**: 13 个关键组件已优化
- ✅ **代码分割**: 路由懒加载
- ✅ **虚拟滚动**: 长列表性能优化
- ✅ **类型安全**: 减少 90% `as any` 使用

详见: [优化计划文档](docs/PROJECT_OPTIMIZATION_PLAN_V2.md)

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`pnpm run commit`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 开源许可

本项目采用开源许可协议，详见 [LICENSE](LICENSE) 文件。

## 💬 加入社区

<div align="center">
  <h3>🤝 HuLa 社区讨论群</h3>
  <p><em>与开发者和用户一起交流讨论</em></p>

  <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
    <img src="preview/wx.png" width="260" height="340" alt="微信群二维码">
    <img src="preview/qq.jpg" width="260" height="340" alt="QQ群二维码">
    <img src="preview/HuLa-QR.png" width="315" height="315" alt="HuLa Issues 群二维码">
  </div>
</div>

---

<div align="center">
  <h3>🌟 感谢您的关注</h3>
  <p>
    <em>如果您觉得 HuLa 有价值，请给我们一个 ⭐ Star</em>
  </p>
  <p>
    <strong>让我们一起构建更好的即时通讯体验 🚀</strong>
  </p>
</div>

**⭐ 如果这个项目对你有帮助，请点个 Star 支持一下！**

---

<div align="center">
  <p>
    <a href="https://github.com/langkebo/hulamatrix">
      <img src="https://img.shields.io/github/stars/langkebo/hulamatrix?style=social" alt="GitHub Stars">
    </a>
    <a href="https://github.com/langkebo/hulamatrix/fork">
      <img src="https://img.shields.io/github/forks/langkebo/hulamatrix?style=social" alt="GitHub Forks">
    </a>
    <a href="https://github.com/langkebo/hulamatrix/issues">
      <img src="https://img.shields.io/github/issues/langkebo/hulamatrix" alt="GitHub Issues">
    </a>
  </p>
</div>
