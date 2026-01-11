# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HuLa is a cross-platform instant messaging application built with Tauri, Vue 3, TypeScript, and Rust. It supports Windows, macOS, Linux, iOS, and Android with a single codebase. The app integrates with Matrix for federation while maintaining a custom WebSocket protocol for legacy compatibility.

## Essential Development Commands

### Environment Setup
```bash
# Install dependencies (pnpm is required - enforced by preinstall hook)
pnpm install

# Check all dependencies and environment
pnpm run preinstall

# Rust checks
pnpm run rust:check      # Check Rust code (cargo check)
pnpm run rust:clippy     # Lint Rust code
pnpm run rust:test       # Run Rust tests
```

### Development
```bash
# Start desktop application (primary development command)
pnpm run tauri:dev   # or: pnpm run td

# Start Android development
pnpm run tauri:android:dev   # or: pnpm run adev
# Windows: pnpm run adev:win (web-only with android platform env)

# Start iOS development (macOS only)
pnpm run tauri:ios:dev   # or: pnpm run idev
# macOS: pnpm run idev:mac (web-only with ios platform env)

# Web-only development (for UI testing)
pnpm run dev
```

### Code Quality
```bash
# Check code issues (read-only)
pnpm run check

# Fix code issues automatically
pnpm run check:write

# Format all files including Vue components
pnpm run format:all   # Runs check:write + format:vue
pnpm run format:vue   # Prettier for Vue files

# Type checking
pnpm run typecheck             # Vue TypeScript check
pnpm run typecheck:module      # Module type check
pnpm run typecheck:strict      # Strict mode check
pnpm run typecheck:deep        # Deep type check (custom script)
pnpm run typecheck:fix         # Fix common type issues

# Run tests
pnpm run test:run    # Run vitest tests
pnpm run test:ui     # Vitest with UI and coverage
pnpm run coverage    # Test coverage report

# Quality gates
pnpm run quality:gate      # Run quality gate checks
pnpm run analyze:type      # Scan typecheck issues

# UI/UX checks (via ui-ux-pro-max)
pnpm run uiux:check        # Check UI/UX issues
pnpm run uiux:fix          # Fix UI/UX issues
pnpm run uiux:audit        # Full UI/UX audit
```

### Building
```bash
# Build desktop application interactively
pnpm run tauri:build   # or: pnpm run tb

# Build Vue app only
pnpm run build

# Generate Tauri icon
pnpm run tauri:icon
```

### Git Operations
```bash
# Commit with conventional format (uses git-cz)
pnpm run commit

# Run pre-commit checks
pnpm run lint:staged   # or: pnpm run lint:s
pnpm run lint:msg      # Check commit message format

# Add changes to previous commit
pnpm run addition-commit
```

## Architecture Overview

### Technology Stack
- **Frontend**: Vue 3 + TypeScript + Vite 7
- **Backend**: Tauri (Rust) for native capabilities
- **State Management**: Pinia with persistence (`pinia-plugin-persistedstate`)
- **UI Framework**: Naive UI + UnoCSS + SCSS
- **Database**: SQLite with Sea-ORM (Rust)
- **Communication**: Dual protocol - Custom WebSocket (Rust) + Matrix SDK integration

### Key Directory Structure

```
src/
├── components/              # Vue components
│   ├── common/             # Shared reusable components
│   ├── matrix/             # Matrix-specific components (rooms, spaces, etc.)
│   ├── rtc/                # WebRTC/call components
│   ├── chat/               # Chat interface components
│   ├── mobile/             # Mobile-specific components
│   └── [feature]/          # Feature-specific components
├── stores/                  # Pinia state management
│   ├── core/               # Core store implementations (migration target)
│   └── [feature]/          # Feature stores (chat, user, settings, etc.)
├── hooks/                   # Vue 3 composables (use* prefix)
├── services/                # API service layer
│   ├── matrix*.ts          # Matrix integration services
│   ├── e2eeService.ts      # End-to-end encryption
│   ├── mediaService.ts     # Media upload/download
│   └── tauriCommand.ts     # Tauri command wrappers
├── utils/                   # Utility functions
├── matrix/                  # Matrix SDK integration layer
├── mobile/                  # Mobile-specific views and layout
│   ├── components/         # Mobile-specific components
│   ├── layout/             # Mobile layout components
│   └── views/              # Mobile page views
├── views/                   # Desktop window views
├── types/                   # TypeScript type definitions
├── typings/                 # Global type declarations
├── adapters/                # Protocol adapters (Matrix, etc.)
├── composables/             # Shared composables
└── integrations/            # Third-party integrations

src-tauri/
├── src/
│   ├── command/            # Tauri command handlers (exposed to frontend)
│   │   ├── app_state_command.rs
│   │   ├── error_log_command.rs
│   │   ├── media/
│   │   └── setting_command.rs
│   ├── common/             # Shared utilities
│   ├── common_cmd/         # Desktop-specific commands
│   ├── desktops/           # Desktop-specific code (tray, windows, etc.)
│   ├── mobiles/            # Mobile-specific code (splash, keyboard, etc.)
│   ├── pojo/               # Plain old Java objects (data transfer)
│   ├── vo/                 # View objects (API responses)
│   ├── configuration/      # YAML-based configuration loader
│   ├── migration/          # Database migrations
│   ├── state.rs            # Global application state
│   ├── lib.rs              # Main entry point, invoke handlers
│   └── error.rs            # Error types
├── capabilities/            # Tauri permission configs
│   ├── default.json        # Default permissions
│   ├── desktop.json        # Desktop-specific permissions
│   └── mobile.json         # Mobile-specific permissions
└── configuration/
    ├── base.yaml           # Base configuration template
    ├── local.yaml          # Local development (auto-created, gitignored)
    └── production.yaml     # Production settings
```

### Communication Pattern (Vue <-> Rust)

The app uses a type-safe command pattern:
1. Frontend calls TypeScript wrappers in `src/services/tauriCommand.ts`
2. These invoke Tauri commands defined in `src-tauri/src/command/*.rs`
3. All commands are registered in `src-tauri/src/lib.rs:get_invoke_handlers()`
4. Commands return structured responses (Result<T, CommonError>)

Key commands (see `src-tauri/src/lib.rs:get_invoke_handlers()`):
- `save_error_log`, `clear_error_log`, `read_error_log` - Error logging
- `get_settings`, `update_settings` - Settings management
- `download_media`, `delete_cached_media`, `clear_media_cache`, `get_media_cache_stats`, `preload_media` - Media operations
- Desktop-only: `default_window_icon`, `screenshot`, `audio`, `set_height`, `get_video_thumbnail`, `set_badge_count`
- macOS-only: `hide_title_bar_buttons`, `show_title_bar_buttons`, `set_window_level_above_menubar`, `set_window_movable`
- Windows-only: `get_windows_scale_info`
- Mobile-only: `set_complete`, `hide_splash_screen`
- iOS-only: `set_webview_keyboard_adjustment`
- `is_app_state_ready` - App state check

### State Management

- **Pinia stores** organized by feature (chat, user, settings, etc.)
- **Persistence** via `pinia-plugin-persistedstate`
- **Cross-tab state** sharing via `pinia-shared-state`
- **Store migration** from legacy stores to new core stores in `src/stores/core/`
- **Core stores** (`HuLaStore`, `useCacheStore`, `useNotificationStore`) provide unified state management

### Component Architecture

- **Responsive design** with mobile/desktop adaptations
- **Vue 3 Composition API** throughout (`<script setup>`)
- **Async component loading** for performance
- **Three-column layout** (desktop): Left (navigation) - Center (content) - Right (chat/actions)
- **Mobile layout**: Tab bar with stacked navigation

### Platform Detection

Use `import.meta.env.TAURI_ENV_PLATFORM` to detect:
- `windows`, `darwin`, `linux` - Desktop platforms
- `android`, `ios` - Mobile platforms

Path aliases (tsconfig.json):
- `@/*` → `src/*`
- `#/*` → `src/mobile/*`
- `~/*` → Root directory
- `@@/*` → `src-tauri/*`
- `~~/*` → `tauri-plugin-hula/*`

## Configuration

### Environment Variables

Create `.env` from `.env.example`. Key switches:
```bash
# Matrix integration
VITE_MATRIX_ENABLED=on                    # Main toggle
VITE_MATRIX_ROOMS_ENABLED=on              # Room/message module
VITE_MATRIX_MEDIA_ENABLED=on              # Media upload (enabled)
VITE_MATRIX_E2EE_ENABLED=on               # End-to-end encryption (enabled)
VITE_MATRIX_RTC_ENABLED=on                # WebRTC/calling (enabled)
VITE_MATRIX_ADMIN_ENABLED=on              # Admin API (enabled)

# Matrix server (uses .well-known discovery)
VITE_MATRIX_SERVER_NAME=cjystx.top        # Server domain for discovery

# Phase 1 migration settings
VITE_DISABLE_WEBSOCKET=true               # Disable custom WebSocket, use Matrix
VITE_MIGRATE_MESSAGING=true               # Migrate to Matrix SDK messaging
VITE_REQUIRE_MATRIX_LOGIN=false           # Allow legacy-only login during migration
```

**Important**: Do not set `VITE_MATRIX_BASE_URL`. The app uses `.well-known` service discovery with `VITE_MATRIX_SERVER_NAME` to automatically find the homeserver URL.

### YAML Configuration

Rust backend uses YAML configs in `src-tauri/configuration/`:
- `base.yaml` - Template with all available options
- `local.yaml` - Local overrides (auto-created from base, gitignored)
- `production.yaml` - Production settings

Configure: backend URL, database path, ICE servers, API keys (Youdao, Tencent Maps, etc.)

### Vite Configuration

- **Development server**: Runs on port 6130 (desktop) or 5210 (mobile)
- **Host detection**: Auto-detects local IP for mobile development
- **Proxy**: Matrix API proxied via `/_matrix` and `/_synapse` paths
- **Build**: Terser minification in production, esbuild in dev
- **Code splitting**: Matrix SDK, Tauri, Vue, UI libraries split into separate chunks
- **Mobile alias**: Custom plugin resolves `#/` imports to `src/mobile/`

## Development Guidelines

### Adding New Features

1. **State**: Create feature store in `src/stores/` or extend core stores in `src/stores/core/`
2. **UI Components**: Add to appropriate `src/components/` subdirectory
3. **Composables**: Extract reusable logic to `src/hooks/`
4. **Backend Access**: Add Tauri commands in `src-tauri/src/command/`
5. **Types**: Update `src/typings/` or `src/types/`
6. **Mobile Support**: Use `src/mobile/` for mobile-specific UI

### Matrix Integration

The app integrates with Matrix for federation:
- **Client service**: `src/services/matrixClientService.ts`
- **E2EE**: `src/services/e2eeService.ts` (when enabled)
- **Room management**: `src/services/roomService.ts`, `src/services/rooms.ts`
- **Message handling**: `src/services/messageService.ts`, `src/services/messages.ts`
- **Sync optimization**: Custom sync loop with lazy loading
- **Feature flags**: Use `VITE_MATRIX_*` env vars for gradual rollout

### WebSocket Communication

Custom Rust WebSocket client (`src-tauri/src/websocket/`):
- **Connection management**: Auto-reconnect with backoff
- **Message queuing**: Offline message queue
- **Event emission**: Real-time events to frontend via Tauri events
- **Health monitoring**: Connection state tracking

### Testing

- **Unit tests**: Vitest with `@vitest/coverage-v8` and `istanbul` provider
- **Component tests**: Vue Test Utils + Happy DOM
- **E2E**: Playwright (configured, tests to be written)
- **Test location**: Co-locate in `__tests__/` directories next to source
- **Test configuration**: `vitest.config.ts` with happy-dom environment
- **Coverage thresholds**: 70% for branches, functions, lines, statements
- **Test settings**: `maxConcurrency: 1`, `isolate: false` to reduce mock overhead
- **Run single test**: `pnpm run test:run -- path/to/test.spec.ts`

### Code Style

- **Biome**: Primary linter/formatter (replaces ESLint/Prettier)
- **TypeScript**: Strict mode enabled, ES2022 target
- **Vue 3**: Composition API with `<script setup>`
- **SCSS**: Global variables auto-imported via `@use`
- **UnoCSS**: Utility-first CSS (Wind preset)
- **Commit**: Conventional commits via `pnpm run commit` (cz-git)

## Important Notes

- **Package manager**: Must use `pnpm` (enforced by preinstall hook)
- **Config changes**: Restart dev server after modifying `.env` or YAML files
- **Matrix-first**: App now prioritizes Matrix SDK over custom WebSocket (Phase 1 migration)
- **Shared codebase**: Mobile and desktop share Vue code with adaptive UI via platform detection
- **Type safety**: All Tauri commands must be type-safe with proper error handling
- **Node version**: Requires Node.js ^20.19.0 or >=22.12.0, pnpm >=10.x
- **Platform-specific code**: Use `#[cfg(desktop)]`, `#[cfg(mobile)]` in Rust and platform detection in TypeScript
- **Service discovery**: Matrix homeserver URL is auto-discovered via `.well-known/matrix/client` - do not hardcode
- **Local Matrix SDK**: The app uses a local copy of matrix-js-sdk at `../matrix-js-sdk-39.1.3` (sibling directory)

## Key File Locations

| Purpose | File Location |
|---------|---------------|
| Tauri commands | `src-tauri/src/command/*.rs` |
| Tauri invoke handler registration | `src-tauri/src/lib.rs:get_invoke_handlers()` |
| Matrix client service | `src/services/matrixClientService.ts` |
| E2EE service | `src/services/e2eeService.ts` |
| Room management | `src/services/roomService.ts`, `src/services/rooms.ts` |
| Message handling | `src/services/messageService.ts`, `src/services/messages.ts` |
| Tauri command wrappers | `src/services/tauriCommand.ts` |
| Core Pinia stores | `src/stores/core/` |
| Mobile components | `src/mobile/components/` |
| Platform capabilities | `src-tauri/capabilities/{default,desktop,mobile}.json` |

## UI/UX Development

This project includes the `ui-ux-pro-max` skill for UI/UX design intelligence. When working on UI components, layouts, or visual design, use the skill to access:
- 50 UI styles (glassmorphism, minimalism, dark mode, etc.)
- 21 color palettes by product type
- 50 font pairings with Google Fonts
- 20 chart types and library recommendations
- Stack-specific best practices for Vue, React, Next.js, etc.

Invoke via `/uiux:check` and `/uiux:fix` commands, or use the Skill tool directly for design guidance.
