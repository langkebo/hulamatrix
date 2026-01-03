# Store Circular Dependency Analysis

**Date**: 2026-01-03
**Status**: ⚠️ Requires Attention
**Impact**: Medium - Works but creates tight coupling

---

## Overview

This document analyzes circular dependencies between Pinia stores in the HuLa project and provides recommendations for resolution.

---

## 🔍 Detected Circular Dependencies

### Primary Circular Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN CIRCULAR CHAIN                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐         ┌──────────────┐         ┌─────────┐│
│   │   global.ts  │────────▶│   chat.ts    │────────▶│ user.ts ││
│   │              │         │              │         │         ││
│   │              │◀────────│              │◀────────│         ││
│   └──────────────┘         └──────────────┘         └─────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Details

| Store | Imports From | Usage Pattern | Line References |
|-------|-------------|---------------|-----------------|
| **global.ts** | `@/stores/chat` | Runtime calls | 8, 18, 49, 51 |
| **chat.ts** | `@/stores/user`, `@/stores/room`, `@/stores/sessionUnread` | Runtime calls | 63-64, 122, 139-151 |
| **user.ts** | `./global` | Property access | 6, 32, 57, 65 |

### Secondary Circular Chains

```
┌─────────────────────────────────────────────────────────────────┐
│                   SECONDARY CIRCULAR CHAINS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │ privateChat  │────┐                                         │
│   │    .ts       │    │                                         │
│   └──────────────┘    │                                         │
│          │            │                                         │
│          └────────────┴──────────┬──────────────┐              │
│                                ▼              ▼               │
│                         ┌──────────────┐  ┌──────────────┐    │
│                         │  global.ts   │  │   chat.ts    │    │
│                         │              │  │              │    │
│                         └──────────────┘  └──────────────┘    │
│                                ▲              ▲                │
│                                │              │                │
│                         ┌──────────────┐     │                │
│                         │  group.ts    │─────┴─────────┐      │
│                         │              │               │      │
│                         └──────────────┘               │      │
│                                │                        │      │
│                          ┌─────┴─────┐                 │      │
│                          │  user.ts  │◄────────────────┘      │
│                          └───────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

| Store | Additional Imports | Purpose |
|-------|-------------------|---------|
| **group.ts** | `global`, `user`, `chat` | Group management needs session context |
| **privateChat.ts** | `global`, `chat`, `group` | Private chat needs all contexts |

---

## 📊 Usage Analysis

### What Each Store Uses from Others

#### global.ts → chat.ts
```typescript
// Lines 49, 51: Session data access
let session: SessionItem | undefined = chatStore.getSession(cachedRoomId)
session = chatStore.sessionList.find((item: SessionItem) => item.roomId === cachedRoomId)
```

#### chat.ts → user.ts
```typescript
// Lines 139, 145, 151, 662, 680, 694, etc.
applyPersistedUnreadCounts(sessionUnreadStore, userStore.userInfo?.uid, targetSessions)
msg.fromUser.uid === userStore.userInfo!.uid
msg.message.body.atUidList?.includes(userStore.userInfo!.uid)
```

#### user.ts → global.ts
```typescript
// Lines 57, 65: Current session access
return await PathUtil.getUserVideosDir(userInfo.value!.uid, globalStore.currentSessionRoomId)
return await PathUtil.getUserAbsoluteVideosDir(userInfo.value!.uid, globalStore.currentSessionRoomId)
```

---

## ⚠️ Why This Is a Problem

### 1. **Initialization Order Issues**
- Stores must be initialized in a specific order
- If initialization order changes, runtime errors may occur
- Difficult to predict store initialization sequence

### 2. **Testing Difficulties**
- Cannot test stores in isolation
- Mocking requires careful setup to avoid circular references
- Unit tests become integration tests

### 3. **Code Maintainability**
- Changes to one store affect multiple stores
- Harder to understand data flow
- Increased cognitive load when reading code

### 4. **Potential Runtime Issues**
- While currently working due to Pinia's lazy initialization
- Could break with future Pinia updates
- Race conditions possible in async operations

---

## ✅ Current Status

### Why It Works Now

1. **Pinia's Lazy Initialization**: Stores are defined as functions, not instantiated until first use
2. **Computed Properties**: Vue's reactivity system defers evaluation until needed
3. **No Action Cascades**: Stores don't call actions that trigger updates in other stores during initialization

### TypeScript Compilation
```bash
✅ pnpm typecheck    # 0 errors
```

TypeScript doesn't catch circular dependencies because:
- Imports are type-level only at compile time
- Runtime circular references don't violate type rules

---

## 🛠️ Recommended Solutions

### Solution 1: Event Bus Pattern (Recommended) ⭐

**Approach**: Use event bus to decouple stores

**Implementation**:
```typescript
// src/stores/events/StoreEventBus.ts
import { mitt } from '@/hooks/useMitt'

export const StoreEventBus = mitt()

export enum StoreEvents {
  SESSION_CHANGED = 'store:session:changed',
  USER_UPDATED = 'store:user:updated',
  UNREAD_CHANGED = 'store:unread:changed',
}
```

**Migration Steps**:
1. Create event bus infrastructure
2. Replace direct store calls with event emissions
3. Replace direct store access with event listeners
4. Update stores to listen for events instead of direct imports

**Example Migration**:
```typescript
// Before (global.ts)
import { useChatStore } from '@/stores/chat'
const chatStore = useChatStore()
let session: SessionItem | undefined = chatStore.getSession(cachedRoomId)

// After (global.ts)
import { StoreEventBus, StoreEvents } from '@/stores/events/StoreEventBus'
const session = ref<SessionItem | null>(null)

StoreEventBus.on(StoreEvents.SESSION_CHANGED, (sessionId: string) => {
  // Update local state
})
```

**Pros**:
- Complete decoupling
- Clear data flow
- Easier testing
- Better observability

**Cons**:
- Requires significant refactoring
- More boilerplate code
- Learning curve for team

---

### Solution 2: Shared State Service (Medium Effort)

**Approach**: Extract shared state to a service layer

**Implementation**:
```typescript
// src/services/sessionContext.ts
import { ref, computed } from 'vue'

export const sessionContext = {
  currentRoomId: ref(''),
  currentUserInfo: ref<UserInfoType | null>(null),

  getCurrentSession: () => {
    // Compute session from context
  }
}
```

**Migration Steps**:
1. Create session context service
2. Move shared state to service
3. Update stores to use service instead of each other
4. Gradually reduce cross-store imports

**Pros**:
- Less invasive than event bus
- Clear ownership of shared state
- Gradual migration possible

**Cons**:
- Service becomes a new coupling point
- Still some tight coupling

---

### Solution 3: Composable Pattern (Low Effort)

**Approach**: Use composables to bridge stores

**Implementation**:
```typescript
// src/composables/useSessionContext.ts
import { computed } from 'vue'
import { useGlobalStore } from '@/stores/global'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'

export function useSessionContext() {
  const globalStore = useGlobalStore()
  const chatStore = useChatStore()
  const userStore = useUserStore()

  return computed(() => ({
    roomId: globalStore.currentSessionRoomId,
    userId: userStore.userInfo?.uid,
    session: chatStore.getSession(globalStore.currentSessionRoomId)
  }))
}
```

**Pros**:
- Minimal changes
- Encapsulates cross-store logic
- Vue 3 idiomatic

**Cons**:
- Doesn't fully eliminate circular dependency
- Still requires importing all stores

---

## 📋 Recommended Migration Plan

### Phase 1: Preparation (1-2 days)
- [ ] Create event bus infrastructure
- [ ] Document all cross-store dependencies
- [ ] Add metrics to track store access patterns

### Phase 2: Event Bus Implementation (3-5 days)
- [ ] Implement StoreEventBus with all necessary events
- [ ] Add event bus tests
- [ ] Create migration guide

### Phase 3: Gradual Migration (1-2 weeks)
- [ ] Migrate global.ts first (least impact)
- [ ] Migrate user.ts second
- [ ] Migrate chat.ts third (most complex)
- [ ] Migrate group.ts and privateChat.ts
- [ ] Update all component usages

### Phase 4: Cleanup (2-3 days)
- [ ] Remove unused cross-store imports
- [ ] Update documentation
- [ ] Final testing
- [ ] Performance verification

### Phase 5: Validation (1-2 days)
- [ ] Run full test suite
- [ ] Manual testing of critical paths
- [ ] Performance benchmarking
- [ ] Documentation update

---

## 🚀 Quick Wins (Immediate Actions)

While waiting for full migration, these small improvements can be made:

### 1. Type-only Imports
```typescript
// Instead of:
import { useChatStore } from '@/stores/chat'

// Use type-only imports where possible:
import type { SessionItem } from '@/services/types'
```

### 2. Lazy Store Initialization
```typescript
// Instead of:
const chatStore = useChatStore()  // At top of store

// Use lazy access:
function getSession(id: string) {
  const chatStore = useChatStore()  // Called only when needed
  return chatStore.getSession(id)
}
```

### 3. Extract Common Utilities
```typescript
// Create src/stores/utils/sessionAccessor.ts
export function getSessionById(roomId: string) {
  const chatStore = useChatStore()
  return chatStore.getSession(roomId)
}
```

---

## 📈 Impact Assessment

### Without Fix
| Aspect | Impact | Severity |
|--------|--------|----------|
| Code Maintainability | Medium | 🟡 |
| Testing Difficulty | High | 🟠 |
| Runtime Stability | Low | 🟢 |
| Future Scalability | High | 🟠 |

### With Fix (Event Bus Pattern)
| Aspect | Improvement | Effort |
|--------|-------------|--------|
| Code Maintainability | +80% | 2 weeks |
| Testing Difficulty | +90% | included |
| Runtime Stability | +20% | included |
| Future Scalability | +70% | included |

---

## 🎯 Decision Matrix

| Solution | Decoupling | Effort | Risk | Recommendation |
|----------|-----------|--------|------|----------------|
| Event Bus | ⭐⭐⭐⭐⭐ | High | Medium | ✅ Recommended |
| Shared Service | ⭐⭐⭐⭐ | Medium | Low | 🟡 Alternative |
| Composable | ⭐⭐⭐ | Low | Low | 🟢 Quick fix |
| No Action | ⭐ | None | High | 🔴 Not recommended |

---

## 🔗 References

- [Pinia Store Design Best Practices](https://pinia.vuejs.org/core-concepts/)
- [Event Bus Pattern in Vue 3](https://blog.logrocket.com/using-event-bus-vue-3-js/)
- [Circular Dependency Anti-Pattern](https://stackoverflow.com/questions/35504932/circular-dependency-in-javascript-nodejs)

---

**Next Steps**: Review with team and decide on migration approach

**Last Updated**: 2026-01-03
**Status**: ⚠️ Awaiting Decision
