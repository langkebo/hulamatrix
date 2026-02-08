# HuLa Project Rules - Matrix Synapse Integration

## Overview
HuLa is a modern, cross-platform Instant Messaging (IM) system that integrates with **Matrix Synapse** homeserver. It leverages **Tauri v2** for application container, **Vite 7** for fast frontend tooling, **Vue 3** for user interface, and **TypeScript** for type safety. The backend logic is implemented in **Rust**. The project uses the local **matrix-js-sdk v39.1.3** for Matrix protocol integration.

The project supports:
- **Desktop:** Windows, macOS, Linux
- **Mobile:** Android, iOS

## Tech Stack

### Frontend
- **Framework:** Vue 3 (Composition API)
- **Language:** TypeScript
- **Build Tool:** Vite 7
- **State Management:** Pinia (with persistence plugins)
- **Routing:** Vue Router
- **Styling:** UnoCSS, Sass
- **UI Libraries:** Naive UI (Desktop), Vant (Mobile)
- **I18n:** vue-i18n
- **Matrix SDK:** @vmuser232922/matrix-js-sdk v39.1.3 (local)

### Backend (Rust / Tauri)
- **Core:** Tauri v2
- **Database:** SQLite (managed via SeaORM with SQLCipher support)
- **Async Runtime:** Tokio
- **HTTP Client:** Reqwest
- **Audio:** Rodio

### Matrix Integration
- **Homeserver:** Matrix Synapse (self-hosted)
- **Protocol:** Matrix Client-Server API v1.11+
- **SDK:** matrix-js-sdk v39.1.3 (local package at `e:\hula\matrix-js-sdk-39.1.3`)
- **Encryption:** Rust WebAssembly crypto stack
- **Sync:** Long-polling via `/sync` endpoint
- **Storage:** IndexedDB (crypto store) + SQLite (local cache)

## Development Workflow

### Prerequisites
- Node.js (v20+ recommended)
- pnpm (v10+ recommended)
- Rust (latest stable)
- Android Studio / Xcode (for mobile development)
- Matrix Synapse homeserver (self-hosted or public)

### Key Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Install Dependencies** | `pnpm install` | Installs Node.js dependencies. |
| **Start Desktop Dev** | `pnpm tauri:dev` | Starts Tauri development server for desktop. |
| **Build Desktop** | `pnpm tauri:build` | Builds production application for desktop (interactive). |
| **Commit Changes** | `pnpm commit` | Interactive git commit using Commitizen. |
| **Lint/Format** | `pnpm check` | Checks code using Biome. |
| **Run Tests** | `pnpm test:run` | Runs unit tests with Vitest. |

### Directory Structure

- **`src/`**: Frontend source code.
    - **`views/`**: Page components (desktop and mobile layouts).
    - **`stores/`**: Pinia stores (including Matrix-specific stores).
    - **`services/`**: API and service layers.
        - **`matrix/`**: Matrix SDK integration services.
    - **`components/`**: Reusable Vue components.
    - **`layout/`**: App layout structures (desktop/mobile).
    - **`utils/`**: Utility functions (Matrix helpers, platform detection).
    - **`types/`**: TypeScript type definitions (Matrix types).
- **`src-tauri/`**: Rust backend source code.
    - **`src/`**: Main Rust application logic.
    - **`configuration/`**: Tauri configuration files.
- **`matrix-js-sdk-39.1.3/`**: Local Matrix JS SDK package.

## Coding Style & Naming Conventions

- Indent 2 spaces, LF endings, trim whitespace (see `.editorconfig`).
- Format/lint with Biome: `pnpm check` (read-only) / `pnpm check:write` (fixes). Vue templates also use Prettier: `pnpm format:vue` or `pnpm format:all`.
- Prefer import aliases: `@/` → `src/`, `~/` → repo root.
- Naming: components `PascalCase.vue`, composables `useXxx.ts`, Pinia stores in `src/stores/`, Matrix services `MatrixXxxService.ts`.
- **Commits:** Use `pnpm commit` to enforce Conventional Commits.
- **Styling:** Use UnoCSS utility classes where possible.
- **State:** Use Pinia for global state; prefer Composition API `<script setup>`.
- **Database:** Use SeaORM entities for database interactions.
- **Matrix:** Use Matrix SDK services for all Matrix protocol operations.

## Architecture Notes

### Matrix Integration Architecture

```
HuLa Frontend (Vue 3)
    ↓
Matrix Services Layer (TypeScript)
    ├─ MatrixClientService (client lifecycle)
    ├─ MatrixAuthService (authentication)
    ├─ MatrixSyncService (sync management)
    ├─ MatrixMessageService (message handling)
    ├─ MatrixRoomService (room management)
    └─ MatrixEventService (event handling)
    ↓
Matrix JS SDK v39.1.3
    ↓
Matrix Synapse Homeserver
```

### Communication Flow
- **Real-time:** Matrix `/sync` endpoint (long-polling)
- **Message Sending:** Matrix SDK `sendEvent()` with local echo
- **Event Handling:** Matrix SDK event listeners → Pinia stores → Vue components
- **Storage:** IndexedDB (crypto) + SQLite (local cache) + Memory (runtime)

### State Management Integration

**Matrix-Specific Stores:**
- **`stores/matrix.ts`**: Matrix client state (connection, sync state, user info)
- **`stores/matrixRoom.ts`**: Room and member management
- **`stores/matrixMessage.ts`**: Message storage and status

**Integration with Existing Stores:**
- **`stores/chat.ts`**: Session list and message display (adapted for Matrix rooms)
- **`stores/user.ts`**: User profile and authentication (adapted for Matrix user)
- **`stores/global.ts`**: Global app state (current session, theme, etc.)

### Multi-Platform Adaptation

**Desktop vs Mobile:**
- **Desktop:** Naive UI components, full keyboard shortcuts, window management
- **Mobile:** Vant components, touch gestures, safe area handling
- **Platform Detection:** Use `import.meta.env.TAURI_ENV_PLATFORM` to detect platform
- **Responsive Design:** CSS media queries + conditional component rendering

**Storage Adaptation:**
- **Desktop:** IndexedDB + SQLite for crypto store
- **Mobile:** IndexedDB via Tauri plugin + SQLite for cache
- **Configuration:** Platform-specific settings in `src-tauri/capabilities/`

## Matrix SDK Integration Guidelines

### Installation
```bash
cd e:\hula\HuLa
pnpm add file:../matrix-js-sdk-39.1.3/matrix-js-sdk-39.1.3
```

### Client Initialization
```typescript
import * as sdk from 'matrix-js-sdk'

const client = sdk.createClient({
  baseUrl: 'https://your-synapse-server.com',
  accessToken: localStorage.getItem('matrix_access_token'),
  userId: localStorage.getItem('matrix_user_id'),
  deviceId: localStorage.getItem('matrix_device_id')
})

await client.initRustCrypto()
await client.startClient({ initialSyncLimit: 20 })
```

### Service Layer Structure

**1. MatrixClientService** (`src/services/matrix/MatrixClientService.ts`)
- Singleton pattern for Matrix client instance
- Client lifecycle management (create, start, stop, destroy)
- Connection state monitoring
- Error handling and reconnection logic

**2. MatrixAuthService** (`src/services/matrix/MatrixAuthService.ts`)
- Login with username/password
- Login with token refresh
- Registration
- Logout and token cleanup
- Device verification

**3. MatrixSyncService** (`src/services/matrix/MatrixSyncService.ts`)
- Sync state management (PREPARED, SYNCING, ERROR)
- Initial sync and incremental sync
- Sync timeout and retry logic
- Sync event filtering and batching

**4. MatrixMessageService** (`src/services/matrix/MatrixMessageService.ts`)
- Send messages (text, image, file, voice, video)
- Local echo and status tracking (pending, sending, sent, failed)
- Message retry queue
- Message recall/redaction

**5. MatrixRoomService** (`src/services/matrix/MatrixRoomService.ts`)
- Create, join, leave rooms
- Room member management
- Room state handling (name, avatar, topic)
- Room search and filtering

**6. MatrixEventService** (`src/services/matrix/MatrixEventService.ts`)
- Event listener registration
- Event type mapping and conversion
- Event persistence to local database
- Event distribution to Pinia stores

### Event Handling Pattern

```typescript
// Listen for Matrix events
client.on(sdk.ClientEvent.Sync, (state, prevState, res) => {
  if (state === 'PREPARED') {
    matrixStore.setSyncState('PREPARED')
  }
})

client.on(sdk.RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
  if (event.getType() === 'm.room.message') {
    const message = convertMatrixEventToMessage(event)
    matrixMessageStore.addMessage(message)
  }
})

client.on(sdk.RoomEvent.MyMembership, (room, membership, prevMembership) => {
  if (membership === 'invite') {
    matrixRoomStore.handleInvite(room.roomId)
  }
})
```

### Message Sending Pattern

```typescript
const sendTextMessage = async (roomId: string, text: string) => {
  const eventId = generateLocalEventId()
  const message = {
    eventId,
    roomId,
    content: { body: text, msgtype: 'm.text' },
    status: 'sending',
    timestamp: Date.now()
  }

  // Add to store with local echo
  matrixMessageStore.addMessage(message)

  try {
    const result = await client.sendEvent(roomId, 'm.room.message', message.content)
    matrixMessageStore.updateMessageStatus(eventId, 'sent', result.event_id)
  } catch (error) {
    matrixMessageStore.updateMessageStatus(eventId, 'failed')
    matrixMessageStore.addToRetryQueue(message)
  }
}
```

## Security & Configuration

### Matrix Configuration
- **Homeserver URL:** Configure in `.env` or runtime settings
- **Access Tokens:** Store in localStorage (consider secure storage for production)
- **Device IDs:** Generate and store per device
- **Crypto Keys:** Use IndexedDB with Rust WebAssembly crypto

### Local Storage
- Don't add secrets to tracked files. Use `.env.local` for personal tokens/keys.
- Matrix access tokens should be stored securely (consider encrypted storage)
- Crypto keys are automatically managed by Matrix SDK in IndexedDB

### Encryption
- End-to-end encryption is enabled by default with `initRustCrypto()`
- Cross-signing and key backup should be set up for production use
- Device verification is required for secure communication

## Important

### SDK Integration Requirements (CRITICAL)

**MANDATORY SDK USAGE:**
- **ALL Matrix protocol operations MUST use the Matrix SDK** - Never bypass the SDK to call Matrix API directly
- **Before implementing any feature, check if the Matrix SDK provides the functionality**
- **Use SDK methods for:** authentication, messaging, room management, events, encryption, file uploads, presence, etc.
- **SDK Reference:** `e:\hula\matrix-js-sdk-39.1.3\docs\` - Always check SDK documentation first
- **If SDK method exists, use it. If not, implement through SDK extension or custom service layer**

**SDK Method Verification:**
- Always verify SDK methods exist by checking `matrix-js-sdk-39.1.3/src/` directory structure
- Use TypeScript to catch non-existent method calls at compile time
- Test SDK methods in isolation before integrating into components
- Refer to `matrix-js-sdk-39.1.3/docs/` for API documentation

**Service Layer Pattern:**
- Create MatrixXxxService.ts for each feature area (e.g., MatrixFriendsService, MatrixPollService)
- Services should wrap SDK methods with proper error handling and caching
- Services should expose clean, typed interfaces to components
- Services should implement retry logic for failed operations
- Services should cache results to reduce API calls

### Cross-Platform Implementation Requirements (CRITICAL)

**MUST IMPLEMENT FOR BOTH PLATFORMS:**
- **Desktop AND Mobile versions must have feature parity**
- **All new features must be implemented for both platforms simultaneously**
- **No platform-specific features without equivalent on the other platform**
- **Test on both platforms before marking feature as complete**

**Platform-Specific UI Libraries:**
- **Desktop:** Use Naive UI components (naive-ui)
- **Mobile:** Use Vant components (vant)
- **Create platform-agnostic components when possible**
- **Use platform detection: `import.meta.env.TAURI_ENV_PLATFORM`**

**Component Structure:**
```
src/components/feature/
├── FeatureName.vue              # Platform-agnostic component
├── FeatureName.desktop.vue      # Desktop-specific implementation
└── FeatureName.mobile.vue       # Mobile-specific implementation
```

**Responsive Design:**
- Use CSS media queries for layout adjustments
- Use conditional component rendering for platform-specific features
- Test on desktop (1920x1080, 1366x768) and mobile (375x667, 414x896)
- Handle touch gestures on mobile and keyboard shortcuts on desktop

### UI Style Consistency Requirements (CRITICAL)

**FOLLOW EXISTING UI PATTERNS:**
- **Study existing components before creating new ones**
- **Use the same color scheme, spacing, and typography**
- **Follow the same component structure and naming conventions**
- **Use UnoCSS utility classes for styling consistency**

**Color System:**
- Use CSS variables defined in `src/styles/scss/global/variable.scss`
- Prefer inline UnoCSS utilities: `bg-[lightColor] dark:bg-[darkColor]`
- Only promote to variables when reused across multiple components
- Maintain light/dark theme support with `data-theme` attribute

**Component Patterns:**
- Study existing components in `src/components/` for patterns
- Use the same component structure (props, emits, slots)
- Follow the same naming conventions (PascalCase for components)
- Use the same icon system and icon sizes
- Maintain consistent spacing and padding

**Layout Patterns:**
- Study existing layouts in `src/layout/` for patterns
- Use the same header/footer/sidebar structure
- Follow the same responsive breakpoints
- Maintain consistent navigation patterns

**Interaction Patterns:**
- Use the same modal/dialog patterns
- Use the same toast/notification patterns
- Use the same loading states and skeletons
- Use the same error handling patterns

### Do's
- Use Matrix SDK services for all Matrix protocol operations
- Implement proper error handling for Matrix API errors (rate limits, network issues)
- Handle sync state transitions gracefully (PREPARED → SYNCING → ERROR)
- Use local echo for immediate feedback when sending messages
- Implement message retry logic for failed sends
- Cache messages locally in SQLite for offline access
- Use virtual scrolling for long message lists
- Handle platform differences (desktop vs mobile) in UI
- Test on both desktop and mobile platforms
- **Use Vue's `h` function instead of JSX for dynamic component rendering**
- **Always verify Matrix SDK API methods exist before using them**
- **Implement caching mechanism for frequently accessed data**
- **Clean up cache when data is updated**
- **Use `currentState.getStateEvents()` for state events, not `getLiveTimeline().getEvents()`**
- **Run `pnpm check:write` after code changes to ensure formatting compliance**
- **Implement features for BOTH desktop and mobile simultaneously**
- **Study existing UI components and patterns before creating new ones**
- **Follow the existing color scheme, spacing, and typography**
- **Use UnoCSS utility classes for styling consistency**
- **Test on both platforms before marking feature as complete**

### Don'ts
- Don't bypass Matrix SDK and call Matrix API directly
- Don't store access tokens in plain text (use secure storage)
- Don't ignore Matrix sync errors (implement proper retry logic)
- Don't block the UI thread with sync operations (use async/await)
- Don't create multiple Matrix client instances (use singleton pattern)
- Don't forget to clean up event listeners when components unmount
- Don't use emojis in commit messages, logs, or documentation
- Don't prefix unused variables with an underscore, delete them instead
- **Don't use JSX syntax in Vue 3 components (use `h` function or template syntax)**
- **Don't assume Matrix SDK methods exist without checking the SDK documentation**
- **Don't import non-existent methods from utility modules**
- **Don't use incorrect API methods for state events**
- **Don't forget to run code formatting before committing**
- **Don't implement features for only one platform (desktop OR mobile)**
- **Don't create new UI patterns without studying existing ones first**
- **Don't deviate from the existing color scheme and typography**
- **Don't use custom CSS when UnoCSS utilities are available**
- **Don't mark features as complete without testing on both platforms**

### Matrix-Specific Considerations
- Matrix uses event IDs (not message IDs) for message identification
- Room IDs are in format `!roomId:server.com`
- User IDs are in format `@username:server.com`
- Events are immutable (use redaction for "deleting" messages)
- Sync returns events in batches (handle pagination properly)
- Federation means rooms can span multiple homeservers
- Rate limiting is enforced by homeserver (implement backoff)
- **State events should be accessed via `currentState.getStateEvents()`**
- **Child room state events use `m.space.child` with `stateKey` as the room ID**
- **Invite links use Matrix SDK methods like `createInviteLink()` and `getInviteLinks()`**

### Vue 3 Component Guidelines
- **Always use `<script setup lang="ts">` for better TypeScript support**
- **For dynamic component rendering, use Vue's `h` function imported from 'vue'**
- **Don't mix JSX with Vue template syntax**
- **Don't use JSX in `.vue` files (Biome linter doesn't support it properly)**
- **Use `h()` function signature: `h(Component, props, children)`**
- **For complex dynamic components, consider creating separate component files**

### Code Quality Guidelines
- **Always run `pnpm check:write` before committing changes**
- **Fix all linting errors before pushing code**
- **Use TypeScript strict mode for better type safety**
- **Add proper type definitions for all functions and components**
- **Handle errors gracefully with try-catch blocks**
- **Add console.error for debugging in catch blocks**
- **Use meaningful variable and function names**
- **Add JSDoc comments for complex functions**

### Performance Guidelines
- **Implement caching for frequently accessed data**
- **Use appropriate cache TTL (Time To Live)**
- **Clean up cache when data is modified**
- **Use `Map` for O(1) lookups**
- **Implement lazy loading for large lists**
- **Debounce rapid user inputs**
- **Use requestAnimationFrame for smooth UI updates**

## Pinia

This project uses Pinia for state management with specific patterns:

- Always create stores with setup-style `defineStore('name', () => { ... })` for better type safety and composition.
- Use `storeToRefs` when destructuring state so reactivity is preserved.
- Group business logic inside of store's actions; components should only call actions/state.
- When a store depends on another store, import and call other store factory inside of setup to share a single instance.
- Use `pinia-plugin-persistedstate` (already registered globally) for stores that must survive reloads—opt in per store via `persist: true`.

### Store Access Patterns

- Access other stores inside Pinia actions by instantiating store at top of action: `const settings = useEditorSettingsStore();`
- Prefer reading dependent store state inside actions rather than passing parameters through components.
- Keep all imperative logic inside actions; components should remain declarative and simple.
- Avoid exporting raw refs outside of store unless absolutely necessary; expose derived state through getters instead.

### Matrix Store Integration

- Matrix stores should extend existing stores rather than replace them
- Use computed properties to derive Matrix data from existing store structures
- Implement proper cleanup when switching accounts or logging out
- Handle sync state changes with proper loading indicators

## CSS Variables & UnoCSS

Theme tokens live in `src/styles/scss/global/variable.scss`, but prefer inline UnoCSS utilities for simple light/dark styling.

**Defining Tokens**
- Default to per-element classes such as `bg-[lightColor] dark:bg-[darkColor]` or `text-[lightText] dark:text-[darkText]` so colors stay close to component.
- Promote a color to `variable.scss` only when it is reused across multiple components or represents a semantic token (e.g. menu background).
- Keep light values on `:root` and dark overrides under `html[data-theme="dark"]` to leverage the existing data attribute toggle.
- When adding gradient or complex values, still store them as a variable (see `--bg-menu`) and document them inline in `variable.scss`.

**Using Tokens with UnoCSS**
- Prefer UnoCSS bracket syntax to consume tokens: `bg-[--center-bg-color]`, `text-[--text-color]`, `border-[--line-color]`.
- For multi-property helpers, apply directives are available because `@unocss/transformer-directives` is enabled: `@apply text-[--text-color]`.
- When a component needs conditional theming, toggle `data-theme` on `<html>` (light/dark) or add scoped data attributes (e.g. `data-theme="compact"`) and extend `variable.scss` with selector.

## Testing

### Unit Testing
- Use Vitest for unit tests
- Test Matrix service functions with mocked Matrix client
- Test Pinia store actions and state changes
- Test utility functions and helpers

### Integration Testing
- Test Matrix client initialization and lifecycle
- Test message sending and receiving flow
- Test sync state transitions
- Test error handling and retry logic

### E2E Testing
- Test login flow with Matrix homeserver
- Test room creation and joining
- Test message sending and receiving
- Test platform-specific features (desktop vs mobile)

## Performance Optimization

### Message Caching
- Use Map for O(1) message lookup by event ID
- Limit in-memory cache to 40 messages per room
- Use SQLite for persistent storage of historical messages
- Implement lazy loading for message history

### Event Batching
- Batch sync events before updating UI
- Use requestAnimationFrame for smooth UI updates
- Debounce rapid state changes

### Virtual Scrolling
- Use vue-virtual-scroller for long message lists
- Implement item recycling for better performance
- Lazy load images and media

### Network Optimization
- Implement exponential backoff for rate limits
- Cache API responses where appropriate
- Use compression for large payloads

## Migration from Original Server

### Gradual Migration Strategy
1. **Phase 1**: Implement Matrix SDK integration alongside existing code
2. **Phase 2**: Replace authentication with Matrix login
3. **Phase 3**: Replace message sync with Matrix sync
4. **Phase 4**: Replace room management with Matrix rooms
5. **Phase 5**: Remove old server integration code

### Data Migration
- Export existing messages from SQLite
- Convert to Matrix event format
- Import to Matrix homeserver (if needed)
- Preserve user preferences and settings

### Backward Compatibility
- Maintain existing UI components during migration
- Keep existing database schema until migration complete
- Provide fallback for features not yet migrated

## Language

The language of reply is determined based on language of user's question. For example, if a user asks a question in simplified Chinese, reply in simplified Chinese.

## Additional Resources

- Matrix JS SDK Documentation: `e:\hula\matrix-js-sdk-39.1.3\docs\`
- Matrix Protocol Specification: https://spec.matrix.org/v1.11/
- Synapse Documentation: https://element-hq.github.io/synapse/latest/
- Tauri Documentation: https://tauri.app/v1/guides/
- Vue 3 Documentation: https://vuejs.org/
- Pinia Documentation: https://pinia.vuejs.org/
