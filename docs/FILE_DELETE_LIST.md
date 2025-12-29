# File Deletion List - Redundant Code Cleanup

> Quick reference for files to delete when migrating from custom implementations to Matrix SDK

---

## Critical Files to Delete

### Thread Implementation (670 lines)
**Path**: `src/services/threadService.ts`
**Reason**: Matrix SDK has native thread support (`room.getThread()`)
**Impact**: High
**Replacement**: Use SDK's thread API directly

```typescript
// BEFORE (custom)
import { threadService } from '@/services/threadService'
const thread = await threadService.getThreadRoot(eventId, roomId)

// AFTER (SDK)
const room = client.getRoom(roomId)
const thread = room?.getThread()?.findThreadForEvent(eventId)
```

---

### Adapter Factory Pattern (~2,000 lines total)

#### 1. Adapter Factory
**Path**: `src/adapters/adapter-factory.ts` (373 lines)
**Reason**: Over-engineered abstraction layer
**Impact**: High
**Replacement**: Direct SDK calls

```typescript
// BEFORE
const adapter = await adapterFactory.createMessageAdapter()
await adapter.sendMessage({ roomId, content })

// AFTER
const client = matrixClientService.getClient()
await client.sendMessage(roomId, content)
```

#### 2. Adapter Manager
**Path**: `src/adapters/adapter-manager.ts` (~300 lines)
**Reason**: Over-engineered abstraction layer
**Impact**: High
**Replacement**: Direct SDK calls

#### 3. WebSocket Adapter
**Path**: `src/adapters/websocket-adapter.ts` (~500 lines)
**Reason**: Legacy WebSocket implementation, SDK handles connection
**Impact**: High
**Replacement**: SDK's built-in WebSocket

#### 4. Group to Room Adapter
**Path**: `src/adapters/group-to-room-adapter.ts` (~200 lines)
**Reason**: Custom conversion logic, can be simplified
**Impact**: Medium
**Replacement**: Simple utility function if needed

---

### WebSocket Services (~1,400 lines total)

#### 1. WebSocket Service
**Path**: `src/services/webSocketService.ts` (~800 lines)
**Reason**: Custom WebSocket, SDK manages connection
**Impact**: High
**Replacement**: SDK's built-in connection management

#### 2. WebSocket Rust
**Path**: `src/services/webSocketRust.ts` (~600 lines)
**Reason**: Custom Rust WebSocket bridge (partially)
**Impact**: Medium
**Note**: Keep Tauri event bridge functionality, remove WebSocket management

---

### Message Router (~400 lines)

#### Message Router
**Path**: `src/services/messageRouter.ts`
**Reason**: Routes between Matrix and WebSocket - dual protocol no longer needed
**Impact**: High
**Replacement**: Direct SDK calls (no routing needed)

---

### Search Service (~400 lines)

#### Room Search Service
**Path**: `src/services/roomSearchService.ts`
**Reason**: Custom search implementation
**Impact**: Medium
**Replacement**: SDK's `client.searchRoomMessages()`

```typescript
// BEFORE (custom)
import { roomSearchService } from '@/services/roomSearchService'
const results = await roomSearchService.search(query, roomId)

// AFTER (SDK)
const results = await client.searchRoomMessages({
  search_term: query,
  room_id: roomId
})
```

---

### Utilities to Delete

#### 1. Request Retry
**Path**: `src/utils/requestRetry.ts`
**Reason**: SDK has built-in retry mechanism
**Impact**: Low
**Replacement**: SDK's retry logic

#### 2. Matrix API Bridge Adapter
**Path**: `src/utils/MatrixApiBridgeAdapter.ts`
**Reason**: Unnecessary bridge layer
**Impact**: Low
**Replacement**: Direct SDK calls

---

## Files to Simplify (Not Delete)

### Enhanced Message Service
**Path**: `src/services/enhancedMessageService.ts`
**Action**: Remove custom routing logic, keep message formatting/enrichment

### Message Sync Service
**Path**: `src/services/messageSyncService.ts`
**Action**: Remove custom retry queue, use SDK receipts

### File Service
**Path**: `src/services/file-service.ts`
**Action**: Remove backup upload logic, use SDK's retry

### Unified Message Receiver
**Path**: `src/services/unifiedMessageReceiver.ts`
**Action**: Evaluate if still needed after adapter removal

---

## Deprecate (Mark for Future Removal)

### WebSocket Type Definitions
**Path**: `src/services/wsType.ts`
**Action**: Mark as deprecated, phase out

### WebSocket Store
**Path**: `src/stores/websocket.ts`
**Action**: Mark as deprecated, migrate to matrix store

### Compatibility Layer
**Path**: `src/stores/compatibility/`
**Action**: Mark as deprecated, phase out

---

## Deletion Order (Safe Migration)

### Phase 1 - Low Risk
1. `src/utils/requestRetry.ts`
2. `src/utils/MatrixApiBridgeAdapter.ts`
3. `src/services/roomSearchService.ts`

### Phase 2 - Medium Risk
4. `src/adapters/websocket-adapter.ts`
5. `src/adapters/group-to-room-adapter.ts`
6. `src/services/messageRouter.ts`

### Phase 3 - High Risk (Requires Testing)
7. `src/adapters/adapter-factory.ts`
8. `src/adapters/adapter-manager.ts`
9. `src/services/webSocketService.ts`
10. `src/services/threadService.ts`

### Phase 4 - Cleanup
11. `src/services/wsType.ts`
12. `src/stores/websocket.ts`
13. Remove unused imports across codebase

---

## Files to Update (Not Delete)

### Services to Refactor
- `src/services/enhancedMessageService.ts` - Simplify
- `src/services/messageSyncService.ts` - Use SDK receipts
- `src/services/file-service.ts` - Remove backup logic

### Components to Update
- `src/components/ThreadsPanel.vue` - Use SDK thread API
- `src/components/ThreadDetail.vue` - Use SDK thread API
- `src/components/search/EnhancedSearch.vue` - Use SDK search
- `src/hooks/useMsgInput.ts` - Add edit functionality

### Stores to Update
- `src/stores/matrix.ts` - Add thread support
- `src/stores/room.ts` - Add tag management

---

## Testing Checklist

Before deleting each file:
- [ ] Search for all imports/references
- [ ] Update references to use SDK
- [ ] Run type check: `pnpm run typecheck`
- [ ] Run tests: `pnpm run test:run`
- [ ] Manual test affected features
- [ ] Commit changes with descriptive message

---

## Impact Summary

| Category | Files | Lines | Risk |
|----------|-------|-------|------|
| Adapters | 4 | ~1,400 | High |
| WebSocket | 2 | ~1,400 | High |
| Thread Service | 1 | 670 | High |
| Message Router | 1 | ~400 | Medium |
| Search Service | 1 | ~400 | Medium |
| Utilities | 2 | ~200 | Low |
| **Total** | **11** | **~4,470** | - |

**Additional Reduction**: Simplifying existing files will save ~5,000+ more lines.

---

## Migration Script (Example)

```bash
# Create feature branch
git checkout -b feature/sdk-migration

# Phase 1
git rm src/utils/requestRetry.ts
git rm src/utils/MatrixApiBridgeAdapter.ts
git rm src/services/roomSearchService.ts
git commit -m "Remove: Delete utilities replaced by SDK"

# Update imports across codebase
pnpm run typecheck  # Find remaining issues
# Fix import errors...
git commit -m "Refactor: Update imports after utility removal"

# Phase 2-4: Continue similarly...

# Final cleanup
pnpm run check:write  # Format and lint
pnpm run typecheck    # Final type check
pnpm run test:run     # Run tests
```

---

*Document Version: 1.0*
*Last Updated: 2025-12-28*
