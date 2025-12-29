# Missing UI Components for SDK Features

> Reference document for UI components that need to be created or updated
> to fully leverage Matrix SDK capabilities

---

## High Priority Components

### 1. Room Directory Browser

**Purpose**: Browse and join public Matrix rooms

**File**: `src/components/rooms/RoomDirectory.vue`

**SDK Integration**:
```typescript
import { matrixClientService } from '@/services/matrixClientService'

const publicRooms = await client.getPublicRooms({
  limit: 20,
  filter: { search_term: searchTerm }
})
```

**Required Features**:
- [ ] Search public rooms by name/topic
- [ ] Filter by server, language, room type
- [ ] Room preview (name, topic, member count, avatar)
- [ ] Join button on each room card
- [ ] Pagination with infinite scroll
- [ ] Loading and error states

**Props Interface**:
```typescript
interface Props {
  initialSearchTerm?: string
  server?: string
  onJoinRoom?: (roomId: string) => void
}
```

**Emits**:
```typescript
const emit = defineEmits<{
  joinRoom: [roomId: string]
  previewRoom: [roomId: string]
}>()
```

---

### 2. Message Edit Dialog

**Purpose**: Allow editing previously sent messages

**File**: `src/components/message/MessageEditDialog.vue`

**SDK Integration**:
```typescript
const content = {
  'm.new_content': {
    msgtype: 'm.text',
    body: newContent
  },
  'm.relates_to': {
    rel_type: 'm.replace',
    event_id: originalEventId
  },
  msgtype: 'm.text',
  body: newContent
}
await client.sendMessage(roomId, content)
```

**Required Features**:
- [ ] Inline message editing (double-click or edit button)
- [ ] Edit history viewer
- [ ] Visual indicator for edited messages (pencil icon)
- [ ] Cancel/Save actions
- [ ] Show original content while editing
- [ ] Support for text messages only initially

**Props Interface**:
```typescript
interface Props {
  roomId: string
  eventId: string
  originalContent: string
  show: boolean
}
```

**Components to Update**:
- `src/components/rightBox/renderMessage/Text.vue` - Add edit indicator
- `src/hooks/useMsgInput.ts` - Add edit mode support

---

### 3. Search Results Viewer

**Purpose**: Display and navigate message search results

**File**: `src/components/search/SearchResultsViewer.vue`

**SDK Integration**:
```typescript
const searchResults = await client.searchRoomMessages({
  search_term: query,
  room_id: roomId,
  limit: 20
})
```

**Required Features**:
- [ ] Display search results with context (±2 messages)
- [ ] Highlight search term in results
- [ ] Click to navigate to message in timeline
- [ ] Filter by room, date range, sender
- [ ] Result count and pagination
- [ ] Save search to history
- [ ] Open result in new context/menu

**Props Interface**:
```typescript
interface Props {
  query: string
  roomId?: string
  limit?: number
}

interface SearchResult {
  eventId: string
  roomId: string
  timestamp: number
  sender: string
  content: string
  context: {
    before: Message[]
    after: Message[]
  }
}
```

---

## Medium Priority Components

### 4. Thread Timeline View

**Purpose**: Display thread replies in a dedicated view

**File**: `src/components/threads/ThreadTimeline.vue`

**SDK Integration**:
```typescript
const room = client.getRoom(roomId)
const thread = room?.getThread()?.findThreadForEvent(eventId)
const timeline = thread?.liveTimeline
const events = timeline?.getEvents()
```

**Required Features**:
- [ ] Show thread replies in chronological order
- [ ] Thread root message at top
- [ ] Expand/collapse thread
- [ ] Reply count indicator
- [ ] Thread participants avatars
- [ ] Load more replies (pagination)
- [ ] Reply to thread button
- [ ] Mark thread as read

**Props Interface**:
```typescript
interface Props {
  roomId: string
  rootEventId: string
  inline?: boolean
  maxVisible?: number
}
```

**Related Files**:
- Update: `src/components/ThreadsPanel.vue`
- Update: `src/components/ThreadDetail.vue`
- Delete: `src/services/threadService.ts` (use SDK directly)

---

### 5. Room Tags Manager

**Purpose**: Organize rooms with custom tags

**File**: `src/components/rooms/RoomTagsManager.vue`

**SDK Integration**:
```typescript
await client.setRoomTag(roomId, tagName, { order: 0.5 })
const tags = client.roomTags
```

**Required Features**:
- [ ] Create custom room tags
- [ ] Edit tag name and color
- [ ] Assign rooms to tags
- [ ] Reorder rooms via drag-drop within tags
- [ ] Delete tags
- [ ] Default tags (Favourite, Low Priority)
- [ ] Tag ordering

**Props Interface**:
```typescript
interface Props {
  roomId?: string
  mode: 'manage' | 'assign'
}

interface RoomTag {
  name: string
  order: number
  color?: string
  rooms: string[]
}
```

**Related Files**:
- Update: `src/stores/room.ts`

---

### 6. Device Verification Flow

**Purpose**: Interactive device verification for E2EE

**File**: `src/components/e2ee/DeviceVerificationFlow.vue`

**SDK Integration**:
```typescript
const request = await client.crypto().requestVerification(userId)
// Handle verification methods: QR code, emoji, SOS
```

**Required Features**:
- [ ] Start verification request
- [ ] QR code verification (scan with other device)
- [ ] Emoji comparison (7 emoji pairs)
- [ ] SAS (short authentication string) verification
- [ ] SOS verification (shared secret)
- [ ] Verification progress indicators
- [ ] Success/failure states
- [ ] Retry/Cancel options

**Props Interface**:
```typescript
interface Props {
  userId: string
  deviceId: string
  method?: 'qr' | 'emoji' | 'sas'
}
```

**Related Files**:
- Update: `src/views/e2ee/VerificationWizard.vue`
- Update: `src/components/e2ee/DeviceManager.vue`

---

### 7. Space Member List

**Purpose**: View and manage members in a space

**File**: `src/components/spaces/SpaceMemberList.vue`

**SDK Integration**:
```typescript
const space = client.getRoom(spaceId)
const members = space?.getJoinedMembers()
const rooms = space?.getChildren()
```

**Required Features**:
- [ ] List all members in the space
- [ ] Filter by role/permissions (admin, moderator, member)
- [ ] Show member presence status
- [ ] Kick/ban members (if admin)
- [ ] Member search
- [ ] Member count by role
- [ ] Invite to space button

**Props Interface**:
```typescript
interface Props {
  spaceId: string
  filter?: 'all' | 'admin' | 'moderator' | 'member'
  showActions?: boolean
}
```

---

### 8. Power Level Editor

**Purpose**: Visual editor for room power levels

**File**: `src/components/rooms/PowerLevelEditor.vue`

**SDK Integration**:
```typescript
const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '')
await client.sendStateEvent(roomId, 'm.room.power_levels', newLevels)
```

**Required Features**:
- [ ] Visual power level editor (sliders or number inputs)
- [ ] Default power levels for events
- [ ] User-specific power level overrides
- [ ] Event-specific permissions
- [ ] Presets (Admin, Moderator, Member)
- [ ] Preview changes before saving
- [ ] Reset to defaults button

**Props Interface**:
```typescript
interface Props {
  roomId: string
  readonly?: boolean
}

interface PowerLevelConfig {
  users: Record<string, number>
  users_default: number
  events: Record<string, number>
  events_default: number
  state_default: number
  ban: number
  kick: number
  redact: number
  invite: number
}
```

---

### 9. Room Settings Panel

**Purpose**: Comprehensive room settings interface

**File**: `src/components/rooms/RoomSettingsPanel.vue`

**SDK Integration**:
```typescript
// Room name/avatar
await client.setRoomName(roomId, name)
await client.setRoomAvatar(roomId, avatarUrl)

// History visibility
await client.sendStateEvent(roomId, 'm.room.history_visibility', { history_visibility: 'shared' })

// Guest access
await client.sendStateEvent(roomId, 'm.room.guest_access', { guest_access: 'can_join' })

// Join rules
await client.sendStateEvent(roomId, 'm.room.join_rules', { join_rule: 'invite' })
```

**Required Features**:
- [ ] Room name and avatar
- [ ] Room topic/description
- [ ] History visibility (invited, joined, shared, world_readable)
- [ ] Guest access (can join, forbidden)
- [ ] Join rules (public, invite, knock, private)
- [ ] Encryption toggle (if supported)
- [ ] Related rooms (parent/child spaces)
- [ ] Room address/aliases
- [ ] Advanced settings (ACLs)

**Props Interface**:
```typescript
interface Props {
  roomId: string
  tab?: 'general' | 'security' | 'advanced'
}

interface RoomSettings {
  name: string
  avatar: string
  topic: string
  historyVisibility: 'invited' | 'joined' | 'shared' | 'world_readable'
  guestAccess: 'can_join' | 'forbidden'
  joinRule: 'public' | 'invite' | 'knock' | 'private'
  encrypted: boolean
}
```

---

## Low Priority Components

### 10. Sticker Picker

**Purpose**: Send Matrix stickers

**File**: `src/components/message/StickerPicker.vue`

**SDK Integration**:
```typescript
await client.sendMessage(roomId, {
  body: stickerBody,
  url: mxcUrl,
  msgtype: 'm.sticker'
})
```

**Required Features**:
- [ ] Sticker library browser
- [ ] Recent stickers
- [ ] Favorite stickers
- [ ] Custom sticker upload
- [ ] Search stickers
- [ ] Category filtering

---

### 11. Room Alias Manager

**Purpose**: Manage room addresses/aliases

**File**: `src/components/rooms/RoomAliasManager.vue`

**SDK Integration**:
```typescript
await client.createAlias(alias, roomId)
await client.deleteAlias(alias)
await client.getAliases(roomId)
await client.resolveRoomAlias(alias)
```

**Required Features**:
- [ ] List all room aliases
- [ ] Add new alias
- [ ] Remove alias
- [ ] Set canonical alias
- [ ] Alias availability check
- [ ] Validation (#room:server format)

---

### 12. Notification Settings

**Purpose**: Per-room notification settings

**File**: `src/components/rooms/NotificationSettings.vue`

**SDK Integration**:
```typescript
await client.setRoomNotificationSettings(roomId, {
  muted: true,
  highlight: false
})
```

**Required Features**:
- [ ] Mute/unmute room
- [ ] Highlight settings (all, keywords, none)
- [ ] Notification sound selection
- [ ] Desktop notification toggle
- [ ] Mobile notification toggle

---

### 13. Room Avatar Cropper

**Purpose**: Crop and upload room avatars

**File**: `src/components/rooms/RoomAvatarCropper.vue`

**SDK Integration**:
```typescript
const uploadResponse = await client.uploadContent(blob)
await client.sendStateEvent(roomId, 'm.room.avatar', {
  url: uploadResponse.content_uri
})
```

**Required Features**:
- [ ] Image upload
- [ ] Cropping tool (square, circle)
- [ ] Preview
- [ ] Zoom/pan
- [ ] Apply/cancel

---

### 14. Message Reaction Picker

**Purpose**: Add emoji reactions to messages

**File**: `src/components/message/ReactionPicker.vue`

**SDK Integration**:
```typescript
await client.sendMessage(roomId, {
  'm.relates_to': {
    rel_type: 'm.annotation',
    event_id: targetEventId,
    key: emoji
  }
})
```

**Required Features**:
- [ ] Emoji picker (searchable)
- [ ] Recent reactions
- [ ] Show existing reactions on message
- [ ] Reaction count display
- [ ] Toggle own reaction

---

### 15. Read Receipts Panel

**Purpose**: See who has read a message

**File**: `src/components/message/ReadReceiptsPanel.vue`

**SDK Integration**:
```typescript
const receipts = room.getReceiptsForEvent(eventId)
const userIds = receipts.map(r => r.userId)
```

**Required Features**:
- [ ] List users who read message
- [ ] Show read time
- [ ] User avatars
- [ ] "Seen by X people" indicator
- [ ] Click for details

---

## Component Migration Summary

### Components to Create
1. `src/components/rooms/RoomDirectory.vue`
2. `src/components/message/MessageEditDialog.vue`
3. `src/components/search/SearchResultsViewer.vue`
4. `src/components/threads/ThreadTimeline.vue` (update existing)
5. `src/components/rooms/RoomTagsManager.vue`
6. `src/components/e2ee/DeviceVerificationFlow.vue`
7. `src/components/spaces/SpaceMemberList.vue`
8. `src/components/rooms/PowerLevelEditor.vue`
9. `src/components/rooms/RoomSettingsPanel.vue`

### Components to Update (Use SDK)
- `src/components/ThreadsPanel.vue` - Use SDK thread API
- `src/components/ThreadDetail.vue` - Use SDK thread API
- `src/components/rightBox/renderMessage/Text.vue` - Add edit indicator
- `src/components/e2ee/DeviceManager.vue` - Enhanced verification
- `src/views/e2ee/VerificationWizard.vue` - Use SDK verification methods
- `src/stores/room.ts` - Add tag management

### Components to Delete
- Remove custom implementations replaced by SDK:
  - Custom thread timeline (if separate from SDK)
  - Custom message status components (use SDK receipts)

---

## Implementation Priority

### Sprint 1 (Core Features)
1. Message Edit Dialog
2. Search Results Viewer
3. Room Directory Browser

### Sprint 2 (Organization)
4. Room Tags Manager
5. Room Settings Panel
6. Thread Timeline View

### Sprint 3 (Security & Advanced)
7. Device Verification Flow
8. Power Level Editor
9. Space Member List

### Sprint 4 (Nice to Have)
10. Sticker Picker
11. Room Alias Manager
12. Notification Settings
13. Room Avatar Cropper
14. Message Reaction Picker
15. Read Receipts Panel

---

*Document Version: 1.0*
*Last Updated: 2025-12-28*
