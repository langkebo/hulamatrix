<p align="center">
  <img width="350px" height="150px" src="public/hula.png"/>
</p>

<p align="center">一款基于 Tauri、Vite 7、Vue 3 和 TypeScript 构建的跨平台即时通讯应用</p>

<br>

<!-- 技术栈 -->
<div align="center">
  <p>
    <img src="https://img.shields.io/badge/Vue3-35495E?logo=vue.js&logoColor=4FC08D">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff">
    <img src="https://img.shields.io/badge/Vite7-646CFF?logo=vite&logoColor=fff">
    <img src="https://img.shields.io/badge/Tauri-24C8DB?logo=tauri&logoColor=FFC131">
    <img src="https://img.shields.io/badge/Rust-c57c54?logo=rust&logoColor=E34F26">
    <img src="https://img.shields.io/badge/UnoCss-333333?logo=unocss&logoColor=fff">
    <img src="https://img.shields.io/badge/Sass-CC6699?logo=sass&logoColor=fff">
    <img src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=fff">
  </p>
</div>

<br>

<!-- 快速链接 -->
<div align="center">
  <h3>🔗 快速链接</h3>

  <p>
    📝 <strong>开发文档：</strong><a href="CLAUDE.md">开发者指南</a> / <a href="docs/PROJECT_ANALYSIS_AND_OPTIMIZATION_PLAN.md">项目分析</a>
  </p>
</div>

<p align="center">
  中文 |
  <a href="README.en.md">English</a>
</p>

> [!NOTE]
> 本项目是一个个人二开项目，基于 Matrix 协议实现联邦通信，支持 Windows、macOS、Linux、iOS 和 Android 平台。

## 🌐 支持平台

| 平台    | 支持版本                             |
| ------- | ------------------------------------ |
| Windows | Windows 10, Windows 11               |
| macOS   | macOS 10.15+ (已支持 Intel 和 Apple Silicon) |
| Linux   | Ubuntu 22.04+                        |
| iOS     | iOS 12.0+ (真机已支持)               |
| Android | Android 12+ (SDK30+)                 |

## 📝 项目介绍

HuLa 是一款基于 Tauri、Vite 7、Vue 3 和 TypeScript 构建的跨平台即时通讯应用。项目集成了 Matrix 协议，实现去中心化的联邦通信，同时支持自定义 WebSocket 协议以保证向后兼容。

### 核心特性

- **跨平台支持**：一套代码，支持 Windows、macOS、Linux、iOS、Android
- **Matrix 联邦**：集成 Matrix 协议，支持跨服务器通信
- **本地优先**：使用 SQLite 本地数据库，支持离线消息
- **端到端加密**：支持 Matrix E2EE（可选功能）
- **原生性能**：基于 Tauri 和 Rust，提供接近原生的性能体验

## 🛠️ 技术栈

### 前端技术

- **Vue 3**：渐进式 JavaScript 框架，使用 Composition API
- **TypeScript**：类型安全的 JavaScript 超集
- **Vite 7**：新一代前端构建工具
- **Naive UI**：Vue 3 组件库
- **UnoCSS**：原子化 CSS 引擎
- **Pinia**：Vue 3 状态管理

### 后端技术

- **Tauri**：跨平台桌面应用框架
- **Rust**：系统级性能的编程语言
- **Sea-ORM**：Rust 异步 ORM 框架
- **SQLite**：嵌入式关系数据库
- **Tokio**：Rust 异步运行时

### 通信协议

- **Matrix SDK**：去中心化通信协议
- **WebSocket**：实时双向通信
- **HTTP/HTTPS**：RESTful API

## 🖼️ 项目预览

<div align="center">
  <h4>PC端界面展示</h4>
</div>

<div align="center">
  <img src="preview/img.png" alt="主界面" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img_1.png" alt="聊天对话" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img_2.png" alt="联系人" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
  <img src="preview/img_3.png" alt="设置界面" width="280" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 8px;">
</div>

<div align="center">
  <h4>移动端界面展示</h4>
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

### 🛠️ 本地功能（Tauri SDK）

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
- **pnpm**: >=10.x
- **Rust**: 最新稳定版
- **平台特定要求**:
  - Windows: Windows 10 以上
  - macOS: Xcode 命令行工具
  - Linux: WebView2 或WebKitGTK
  - iOS: Xcode 15+
  - Android: Android SDK API 30+

### 安装步骤

```bash
# 安装依赖
pnpm install

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，配置必要的环境变量
# 至少需要配置：
# VITE_MATRIX_SERVER_NAME=your-server.com
```

### 开发运行

```bash
# 桌面端开发
pnpm run tauri:dev

# Android 开发
pnpm run tauri:android:dev

# iOS 开发 (仅 macOS)
pnpm run tauri:ios:dev

# Web 端开发（仅 UI）
pnpm run dev
```

### 生产构建

```bash
# 桌面端构建
pnpm run tauri:build

# Android 构建
pnpm run tauri:android:build

# iOS 构建 (仅 macOS)
pnpm run tauri:ios:build
```

## ⚙️ 配置说明

### 环境变量

主要环境变量配置（见 `.env.example`）：

```bash
# Matrix 集成
VITE_MATRIX_ENABLED=on                    # 总开关
VITE_MATRIX_ROOMS_ENABLED=on              # 房间/消息模块
VITE_MATRIX_SERVER_NAME=your-server.com   # 服务器域名
VITE_MATRIX_DEV_SYNC=false                # 开发同步

# 应用配置
VITE_APP_NAME="HuLa"
VITE_APP_VERSION=3.0.5

# 功能开关
VITE_MOBILE_FEATURES_ENABLED=off          # 移动端高级特性
VITE_SYNAPSE_FRIENDS_ENABLED=on           # Synapse 好友扩展
```

### YAML 配置

Rust 后端使用 YAML 配置（位于 `src-tauri/configuration/`）：

- `base.yaml` - 配置模板
- `local.yaml` - 本地覆盖（自动创建，gitignore）
- `production.yaml` - 生产设置

## 📋 提交规范

执行以下命令进行代码提交：

```bash
pnpm run commit
```

按照交互式提示选择提交类型和填写描述。

## ⚠️ 注意事项

### macOS 用户

下载的安装包可能提示"已损坏"，执行以下命令解决：

```bash
# 安装前执行
sudo xattr -rd com.apple.quarantine /path/to/installer.dmg

# 如果已安装
sudo xattr -r -d com.apple.quarantine /Applications/HuLa.app
```

### 开发提示

- 必须使用 `pnpm` 作为包管理器（有 preinstall hook 强制要求）
- 修改 `.env` 或 YAML 配置后需重启开发服务器
- 首次运行会自动创建 `local.yaml` 配置文件

## 🏗️ 项目结构

```
HuLa/
├── src/                    # 前端源代码
│   ├── components/         # Vue 组件
│   │   ├── common/        # 通用组件
│   │   ├── matrix/        # Matrix 相关组件
│   │   ├── rtc/           # WebRTC 通话组件
│   └── ...
│   ├── stores/            # Pinia 状态管理
│   │   └── core/          # 核心 Store
│   ├── services/          # API 服务层
│   │   ├── matrix*        # Matrix 集成服务
│   ├── hooks/             # Vue 3 Composables
│   ├── utils/             # 工具函数
│   ├── mobile/            # 移动端代码
│   └── views/             # 桌面端视图
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── command/       # Tauri 命令
│   │   ├── entity/        # 数据库实体
│   │   ├── repository/    # 数据访问层
│   │   ├── websocket/     # WebSocket 客户端
│   │   ├── desktops/      # 桌面端代码
│   │   ├── mobiles/       # 移动端代码
│   │   └── configuration/ # YAML 配置
│   └── gen/               # 生成的平台代码
├── locales/               # 国际化文件
├── public/                # 静态资源
└── docs/                  # 项目文档
```

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
