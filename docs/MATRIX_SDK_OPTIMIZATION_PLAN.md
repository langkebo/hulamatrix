# Matrix SDK Integration Optimization Plan

> **Project**: HuLa Matrix (Vue 3 + Tauri + TypeScript)
> **Date**: 2025-12-28
> **Status**: Active Planning

---

## Executive Summary

The HuLa project currently maintains a **hybrid architecture** with both Matrix SDK integration and custom WebSocket implementations. This creates unnecessary complexity, maintenance overhead, and code redundancy. The Matrix SDK (v39.1.3) provides comprehensive functionality that covers most of the custom implementations.

**Key Statistics**:
- **Redundant Code**: ~15,000+ lines of custom implementations duplicating SDK features
- **Adapter Overhead**: 8 adapter files managing dual protocol routing
- **Estimated Migration Effort**: 2-3 weeks
- **Expected Code Reduction**: ~20-30% after cleanup

---

## Part 1: SDK Feature vs Custom Implementation Comparison

### 1.1 Core Messaging Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Send Text Message | `client.sendMessage()` | `src/services/enhancedMessageService.ts` | ⚠️ Partial | Migrate to direct SDK |
| Send Media | `client.uploadContent()` + `sendMessage()` | `src/services/mediaService.ts` | ✅ Good | Keep current |
| Message History | `room.getTimeline()` | `src/services/messageSyncService.ts` | ⚠️ Custom | Use SDK timeline |
| Message Status | Built-in event receipts | `src/services/messageSyncService.ts` (custom) | ❌ Redundant | Use SDK receipts |
| Message Retry | Built-in retry mechanism | `src/utils/requestRetry.ts` | ❌ Redundant | Remove |
| Read Receipts | `client.sendReadReceipt()` | `src/stores/chat.ts` | ✅ Good | Keep |
| Typing Indicators | `client.sendTypingNotice()` | `src/hooks/useChatMain.ts` | ⚠️ Partial | Ensure SDK usage |
| Message Redaction | `client.redactEvent()` | Custom implementation | ❌ Missing | Add SDK call |
| Message Edit | SDK via `m.new_content` | Not implemented | ❌ Missing | Implement |
| Message Replies | SDK via `m.relates_to` | `src/utils/MessageReply.ts` | ⚠️ Partial | Use SDK |

### 1.2 Room Management Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Create Room | `client.createRoom()` | `src/services/roomService.ts` | ✅ Good | Keep |
| Join Room | `client.joinRoom()` | `src/services/rooms.ts` | ✅ Good | Keep |
| Leave Room | `client.leave()` | `src/services/rooms.ts` | ✅ Good | Keep |
| Room State | `room.currentState` | `src/stores/room.ts` | ✅ Good | Keep |
| Room Members | `room.getJoinedMembers()` | `src-tauri/src/command/room_member_command.rs` | ⚠️ Rust | Can simplify |
| Room Aliases | `client.getRoomAliases()` | Custom implementation | ❌ Redundant | Use SDK |
| Room Directory | `client.getPublicRooms()` | Not fully implemented | ❌ Missing | Add |
| Room Tags | `room.tags` | `src/stores/room.ts` | ✅ Good | Keep |

### 1.3 File & Media Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Upload File | `client.uploadContent()` | `src/services/mediaService.ts` | ✅ Good | Keep |
| Download File | `mxcUrlToHttp()` + fetch | `src/services/file-service.ts` | ⚠️ Custom | Simplify |
| File Progress | Built-in progress callback | Custom progress tracking | ⚠️ Partial | Use SDK progress |
| Thumbnail | `mxcUrlToHttp()` with thumbnail params | Custom generation | ❌ Redundant | Use SDK |
| Encryption | Built-in E2E for uploads | Custom implementation | ⚠️ Partial | Use SDK E2E |

### 1.4 Event Handling Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Event Listener | `client.on()` | `src/services/webSocketRust.ts` | ❌ Wrong | Use SDK events |
| Timeline Events | `room.timeline` | Custom timeline implementation | ⚠️ Partial | Use SDK |
| State Events | `room.currentState` | `src/stores/matrix.ts` | ✅ Good | Keep |
| Presence | `client.getPresence()` | `src/stores/presence.ts` | ✅ Good | Keep |
| Receipts | `room.getReceipts()` | Custom implementation | ❌ Redundant | Use SDK |

### 1.5 Search Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Search Messages | `client.search()` | `src/services/roomSearchService.ts` | ❌ Custom | Migrate to SDK |
| Search Users | `client.searchUserDirectory()` | Not implemented | ❌ Missing | Add |
| Search Rooms | `client.getPublicRooms()` with filter | `src/components/search/` | ⚠️ Partial | Use SDK |
| Search History | Built-in search API | Not implemented | ❌ Missing | Add |

### 1.6 Thread Features (IMPORTANT - Custom Implementation)

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Thread Support | `room.getThread()` | **670-line custom impl** | ❌ Redundant | **Use SDK** |
| Create Thread | SDK built-in | `src/services/threadService.ts` | ❌ Custom | **MAJOR: Replace** |
| Thread Replies | SDK `m.relates_to` | Custom implementation | ❌ Redundant | **Use SDK** |
| Thread Timeline | SDK thread timeline | Custom timeline | ❌ Redundant | **Use SDK** |

**Note**: The `src/services/threadService.ts` file (670 lines) is a major redundant implementation. The Matrix SDK has native thread support since v1.1.

### 1.7 E2EE Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Encryption | `client.crypto()` | `src/services/e2eeService.ts` | ✅ Good | Keep |
| Device Verification | Built-in | `src/components/e2ee/` | ✅ Good | Keep |
| Key Backup | Built-in | `src/views/e2ee/BackupRecovery.vue` | ✅ Good | Keep |
| Room Encryption | Automatic | `src/hooks/useE2EE.ts` | ✅ Good | Keep |

### 1.8 WebRTC Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Voice/Video Call | `matrix-webrtc` package | `src/services/matrixCallService.ts` | ⚠️ Partial | Consider SDK |
| Call Management | Built-in Call API | Custom implementation | ⚠️ Partial | Evaluate SDK |
| Screen Share | SDK supports | Not implemented | ❌ Missing | Add via SDK |

### 1.9 Presence Features

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Online Status | `client.setPresence()` | `src/stores/presence.ts` | ✅ Good | Keep |
| Presence Events | `client.on('RoomMember.presence')` | Custom events | ✅ Good | Keep |
| Last Active | Built-in | Custom tracking | ✅ Good | Keep |

### 1.10 Enterprise Features (Custom Extensions)

| Feature | SDK Method | Current Implementation | Status | Action |
|---------|-----------|------------------------|--------|--------|
| Friends System | **Enterprise SDK Only** | `src/stores/friends.ts` | ✅ Keep | Custom enhancement |
| Private Chat | **Enterprise SDK Only** | `src/components/private-chat/` | ✅ Keep | Custom enhancement |
| Self-Destruct | **Enterprise SDK Only** | `src/views/private-chat/` | ✅ Keep | Custom enhancement |
| Voice Messages | SDK supports | Custom implementation | ⚠️ Partial | Consider SDK |

---

## Part 2: Files to Delete (Redundant Code)

### 2.1 High Priority - Complete Deletion

**Reason**: These files implement features that the SDK provides natively.

#### Adapter Pattern (Over-Engineering)
```
src/adapters/adapter-factory.ts          (373 lines) - DELETE
src/adapters/adapter-manager.ts          (~300 lines) - DELETE
src/adapters/websocket-adapter.ts        (~500 lines) - DELETE
src/adapters/group-to-room-adapter.ts    (~200 lines) - DELETE
```

**Migration**: Direct calls to Matrix SDK through `matrixClientService`

#### WebSocket Service (Legacy)
```
src/services/webSocketService.ts         (~800 lines) - DELETE
src/services/webSocketRust.ts            (~600 lines) - DELETE (keep Tauri event bridge only)
src/services/messageRouter.ts            (~400 lines) - DELETE
```

**Migration**: Use SDK's built-in WebSocket connection and event system

#### Custom Thread Implementation (Major Redundancy)
```
src/services/threadService.ts            (670 lines) - DELETE
src/components/ThreadsPanel.vue          (~300 lines) - MIGRATE to SDK
src/components/ThreadDetail.vue          (~250 lines) - MIGRATE to SDK
```

**Migration**: Use SDK's native `room.getThread()` and related methods

#### Custom Search
```
src/services/roomSearchService.ts        (~400 lines) - DELETE
```

**Migration**: Use `client.searchRoomMessages()`

### 2.2 Medium Priority - Refactor and Simplify

#### Message Services
```
src/services/enhancedMessageService.ts   - SIMPLIFY (remove custom routing)
src/services/messageSyncService.ts       - SIMPLIFY (use SDK receipts)
src/services/unifiedMessageReceiver.ts   - EVALUATE (may be redundant)
```

#### File Services
```
src/services/file-service.ts             - SIMPLIFY (remove backup logic)
src/utils/download-queue.ts              - EVALUATE (SDK handles this)
```

#### Utilities
```
src/utils/requestRetry.ts                - DELETE (SDK has retry)
src/utils/MatrixApiBridgeAdapter.ts      - DELETE (unnecessary bridge)
```

### 2.3 Low Priority - Deprecation Warnings

```
src/services/wsType.ts                   - MARK DEPRECATED
src/stores/websocket.ts                  - MARK DEPRECATED
src/stores/compatibility/                - PHASE OUT
```

---

## Part 3: Detailed Migration Plan

### Phase 1: Foundation Cleanup (Week 1)

#### 1.1 Remove WebSocket Adapter Pattern
**Files to Modify**:
- Delete: `src/adapters/websocket-adapter.ts`
- Delete: `src/adapters/group-to-room-adapter.ts`
- Delete: `src/adapters/adapter-factory.ts`
- Delete: `src/adapters/adapter-manager.ts`

**Changes Required**:
```typescript
// BEFORE (with adapter factory)
const messageAdapter = await adapterFactory.createMessageAdapter()
await messageAdapter.sendMessage({ roomId, content })

// AFTER (direct SDK)
const client = matrixClientService.getClient()
await client.sendMessage(roomId, content)
```

**Impact**: ~50 files reference the adapter factory. Use IDE refactoring tools.

#### 1.2 Replace Thread Service
**Files to Modify**:
- Delete: `src/services/threadService.ts`
- Update: `src/components/ThreadsPanel.vue`
- Update: `src/components/ThreadDetail.vue`

**Migration Example**:
```typescript
// BEFORE (custom threadService)
const threadRoot = await threadService.getThreadRoot(eventId, roomId)
const messages = await threadService.getThreadMessages(threadRootId, roomId)

// AFTER (SDK native)
const room = client.getRoom(roomId)
const thread = room?.getThread()?.findThreadForEvent(eventId)
const timeline = thread?.liveTimeline?.getEvents()
```

#### 1.3 Simplify Message Routing
**Files to Modify**:
- Delete: `src/services/messageRouter.ts`
- Simplify: `src/services/enhancedMessageService.ts`

**Action**: Remove Matrix vs WebSocket routing logic. All messages go through SDK.

### Phase 2: Feature Integration (Week 2)

#### 2.1 Implement Native Search
**Files to Create**:
- `src/services/matrixSearchService.ts` (new, using SDK)

**Implementation**:
```typescript
// NEW: src/services/matrixSearchService.ts
import { matrixClientService } from './matrixClientService'

export class MatrixSearchService {
  async searchMessages(options: {
    roomId?: string
    searchTerm: string
    limit?: number
  }) {
    const client = matrixClientService.getClient()
    return client.searchRoomMessages({
      search_term: options.searchTerm,
      room_id: options.roomId,
      limit: options.limit || 20
    })
  }

  async searchUsers(query: string, limit = 20) {
    const client = matrixClientService.getClient()
    return client.searchUserDirectory({
      term: query,
      limit
    })
  }
}
```

**Files to Update**:
- `src/components/search/EnhancedSearch.vue` - use new service
- Delete: `src/services/roomSearchService.ts`

#### 2.2 Add Message Edit Support
**Files to Update**:
- `src/hooks/useMsgInput.ts` - add edit functionality
- `src/components/rightBox/renderMessage/Text.vue` - handle edited messages

**Implementation**:
```typescript
// Use SDK's m.new_content for message editing
const content = {
  'm.new_content': { msgtype: 'm.text', body: newContent },
  'm.relates_to': {
    rel_type: 'm.replace',
    event_id: originalEventId
  },
  msgtype: 'm.text',
  body: newContent
}
await client.sendMessage(roomId, content)
```

#### 2.3 Implement Room Directory
**Files to Create**:
- `src/components/rooms/RoomDirectory.vue`

**Implementation**:
```typescript
const publicRooms = await client.getPublicRooms({
  limit: 20,
  since: nextBatch,
  filter: { search_term: query }
})
```

### Phase 3: Cleanup and Polish (Week 3)

#### 3.1 Remove Deprecated Code
**Actions**:
- Delete all files marked in Part 2
- Update imports across the codebase
- Run tests and fix failures
- Update documentation

#### 3.2 Update Feature Flags
**Files to Update**:
- `.env.example` - simplify flags
- `src/utils/matrixEnv.ts` - remove adapter-related flags

**Before**:
```bash
VITE_MATRIX_ENABLED=on
VITE_MATRIX_USE_ADAPTERS=on
VITE_MATRIX_WEBSOCKET_FALLBACK=on
```

**After**:
```bash
VITE_MATRIX_ENABLED=on
VITE_MATRIX_ROOMS_ENABLED=on
VITE_MATRIX_E2EE_ENABLED=on
VITE_MATRIX_RTC_ENABLED=on
```

#### 3.3 Update Tests
**Actions**:
- Update test mocks for SDK methods
- Remove adapter-related tests
- Add integration tests for SDK features

---

## Part 4: Missing UI Components

### 4.1 High Priority Missing Components

#### 4.1.1 Room Directory Browser
**Component**: `src/components/rooms/RoomDirectory.vue`

**Features**:
- Search public rooms
- Filter by server, language, topic
- Preview room before joining
- Pagination with infinite scroll

**SDK Integration**:
```typescript
await client.getPublicRooms({
  limit: 20,
  filter: { search_term: query }
})
```

#### 4.1.2 Message Edit UI
**Component**: `src/components/message/MessageEditDialog.vue`

**Features**:
- Edit message inline
- Show edit history
- Indicate edited messages visually

**SDK Integration**:
```typescript
content['m.relates_to'] = {
  rel_type: 'm.replace',
  event_id: originalEventId
}
```

#### 4.1.3 Search Results Viewer
**Component**: `src/components/search/SearchResultsViewer.vue`

**Features**:
- Display search results with context
- Highlight search term
- Navigate to result
- Filter by room, date, sender

**SDK Integration**:
```typescript
const results = await client.searchRoomMessages({
  search_term: query,
  room_id: roomId
})
```

### 4.2 Medium Priority Missing Components

#### 4.2.1 Thread Timeline View
**Component**: `src/components/threads/ThreadTimeline.vue`

**Features**:
- Show thread replies
- Expand/collapse thread
- Reply count indicator
- Thread participants

**SDK Integration**:
```typescript
const thread = room.getThread()?.findThreadForEvent(eventId)
const timeline = thread?.liveTimeline
```

#### 4.2.2 Room Tags Manager
**Component**: `src/components/rooms/RoomTagsManager.vue`

**Features**:
- Create/edit room tags
- Reorder rooms via drag-drop
- Custom tag names and colors

**SDK Integration**:
```typescript
await client.setRoomTag(roomId, tagName, { order: 0.5 })
```

#### 4.2.3 Device Verification Flow
**Component**: `src/components/e2ee/DeviceVerificationFlow.vue`

**Features**:
- Interactive verification wizard
- QR code verification
- Emoji comparison
- SOS verification

**SDK Integration**:
```typescript
const request = await client.crypto().requestVerification(userId)
```

### 4.3 Low Priority Missing Components

#### 4.3.1 Space Member List
**Component**: `src/components/spaces/SpaceMemberList.vue`

**Features**:
- List all members in a space
- Filter by role/permissions
- Kick/ban members (if admin)

#### 4.3.2 Power Level Editor
**Component**: `src/components/rooms/PowerLevelEditor.vue`

**Features**:
- Visual power level editor
- Default power levels
- User-specific overrides
- Event-level permissions

**SDK Integration**:
```typescript
const powerLevels = room.currentState.getStateEvents('m.room.power_levels')
await client.sendStateEvent(roomId, 'm.room.power_levels', newLevels)
```

#### 4.3.3 Room Settings Panel
**Component**: `src/components/rooms/RoomSettingsPanel.vue`

**Features**:
- Room name/avatar
- History visibility
- Guest access
- Encryption toggle
- Join rules
- Related rooms

---

## Part 5: Optimized Architecture

### 5.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Vue Components                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ MatrixClient │  │ RoomService  │  │ MessageSvc   │      │
│  │   Service    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ MediaService │  │ SearchSvc    │  │ E2EEService  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Matrix JS SDK (v39.1.3)                        │
│         + matrix-widget-sdk + matrix-webrtc                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Matrix Server                            │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Simplified Service Layer

**Key Principles**:
1. **Direct SDK Usage**: Services wrap SDK, not replace it
2. **Single Source of Truth**: No dual protocol routing
3. **Caching Only**: Cache what SDK doesn't cache efficiently
4. **Type Safety**: Strong TypeScript types throughout

**Example Service Structure**:
```typescript
// src/services/roomService.ts (simplified)
import { matrixClientService } from './matrixClientService'

class RoomService {
  async createRoom(options: CreateRoomOptions) {
    const client = matrixClientService.getClient()
    return client.createRoom({
      name: options.name,
      preset: options.isPrivate ? 'private_chat' : 'public_chat',
      visibility: options.isPrivate ? 'private' : 'public'
    })
  }

  async getRooms() {
    const client = matrixClientService.getClient()
    return client.getRooms()
  }
}
```

---

## Part 6: Implementation Checklist

### Week 1 Checklist

#### Day 1-2: Adapter Cleanup
- [ ] Backup current code branch
- [ ] Delete `src/adapters/adapter-factory.ts`
- [ ] Delete `src/adapters/adapter-manager.ts`
- [ ] Delete `src/adapters/websocket-adapter.ts`
- [ ] Delete `src/adapters/group-to-room-adapter.ts`
- [ ] Update all imports from adapters
- [ ] Run type check: `pnpm run typecheck`

#### Day 3-4: Thread Migration
- [ ] Read Matrix SDK thread documentation
- [ ] Create thread examples using SDK
- [ ] Delete `src/services/threadService.ts`
- [ ] Update `ThreadsPanel.vue` to use SDK
- [ ] Update `ThreadDetail.vue` to use SDK
- [ ] Test thread functionality

#### Day 5: Message Router Removal
- [ ] Delete `src/services/messageRouter.ts`
- [ ] Simplify `enhancedMessageService.ts`
- [ ] Update all message sending paths
- [ ] Test message delivery

### Week 2 Checklist

#### Day 1-2: Search Implementation
- [ ] Create `src/services/matrixSearchService.ts`
- [ ] Update `EnhancedSearch.vue` component
- [ ] Delete `src/services/roomSearchService.ts`
- [ ] Implement user directory search
- [ ] Implement public rooms search

#### Day 3-4: Missing Features
- [ ] Implement message edit (SDK `m.new_content`)
- [ ] Create `MessageEditDialog.vue`
- [ ] Add edit indicators to messages
- [ ] Implement redaction UI
- [ ] Create room directory browser

#### Day 5: File Service Simplification
- [ ] Simplify `src/services/file-service.ts`
- [ ] Remove backup upload logic
- [ ] Use SDK's retry mechanisms
- [ ] Update progress tracking

### Week 3 Checklist

#### Day 1-2: Cleanup
- [ ] Delete all deprecated files
- [ ] Remove unused dependencies
- [ ] Update feature flags in `.env`
- [ ] Clean up test files

#### Day 3-4: Testing
- [ ] Update all test mocks
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Manual testing of core features

#### Day 5: Documentation
- [ ] Update CLAUDE.md
- [ ] Document new architecture
- [ ] Create migration guide
- [ ] Update component docs

---

## Part 7: Success Metrics

### Before Optimization
- **Total Lines**: ~50,000+ (TypeScript/Vue)
- **Adapter Overhead**: ~2,000 lines
- **Duplicate Features**: ~15,000 lines
- **Test Coverage**: 45%

### After Optimization (Target)
- **Total Lines**: ~35,000-40,000 (20-30% reduction)
- **Adapter Overhead**: 0 lines
- **Duplicate Features**: 0 lines
- **Test Coverage**: 60%+

### Quality Improvements
- ✅ Single source of truth for Matrix operations
- ✅ Simplified architecture
- ✅ Better Matrix compliance
- ✅ Easier maintenance
- ✅ Improved performance (SDK is optimized)

---

## Part 8: Risks and Mitigations

### Risk 1: Breaking Changes
**Mitigation**:
- Create feature branch for migration
- Comprehensive testing before merge
- Gradual rollout with feature flags

### Risk 2: Lost Functionality
**Mitigation**:
- Document all current features
- Compare feature-by-feature
- Keep custom extensions (friends, private chat)

### Risk 3: SDK Limitations
**Mitigation**:
- Verify SDK supports all needed features
- Keep fallback implementations where needed
- Contribute to SDK if critical features missing

### Risk 4: Timeline Overrun
**Mitigation**:
- Prioritize high-impact changes
- Can release in phases
- Technical debt documentation for remaining items

---

## Part 9: Next Steps

1. **Review this plan** with team/stakeholders
2. **Create GitHub issues** for each major task
3. **Set up feature branch**: `feature/matrix-sdk-optimization`
4. **Start with Phase 1** (Foundation Cleanup)
5. **Track progress** with project board

---

## Appendix A: SDK API Reference

### Key SDK Methods to Use

```typescript
// Client Initialization
import { createClient } from 'matrix-js-sdk'
const client = createClient({ baseUrl, accessToken })

// Messaging
await client.sendMessage(roomId, content)
await client.redactEvent(roomId, eventId, reason)

// Rooms
await client.createRoom(options)
await client.joinRoom(roomId)
await client.leave(roomId)
const room = client.getRoom(roomId)

// Events
client.on('Room.timeline', (event, room) => {})
client.on('RoomMember.typing', (event, member) => {})

// Search
await client.searchRoomMessages({ search_term: query })

// Files
await client.uploadContent(file, { type: mimetype })

// Presence
await client.setPresence({ presence: 'online' })
await client.sendTypingNotice(roomId, true, 10000)

// Encryption
await client.crypto().encryptRoom(roomId)

// Threads
const thread = room.getThread()?.findThreadForEvent(eventId)
```

---

## Appendix B: Environment Variables

### Current (.env.example)
```bash
VITE_MATRIX_ENABLED=on
VITE_MATRIX_ROOMS_ENABLED=on
VITE_MATRIX_MEDIA_ENABLED=off
VITE_MATRIX_E2EE_ENABLED=off
VITE_MATRIX_RTC_ENABLED=off
VITE_MATRIX_ADMIN_ENABLED=on
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top
VITE_MATRIX_DEV_SYNC=false
```

### Recommended (Simplified)
```bash
# Core Features
VITE_MATRIX_ENABLED=on
VITE_MATRIX_ROOMS_ENABLED=on
VITE_MATRIX_MEDIA_ENABLED=on

# Advanced Features (enable when ready)
VITE_MATRIX_E2EE_ENABLED=off
VITE_MATRIX_RTC_ENABLED=off
VITE_MATRIX_ADMIN_ENABLED=on

# Server
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top
VITE_MATRIX_DEV_SYNC=false
```

---

*Document Version: 1.0*
*Last Updated: 2025-12-28*
*Maintainer: Development Team*
