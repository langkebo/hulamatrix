# API Migration Guide

## Overview

The legacy `ImRequestUtils.ts` file has been fully refactored into properly typed, service-based APIs. All 54 files have been migrated to use the new API services.

## Migration Progress

| Category | Total Files | Migrated | Progress |
|----------|-------------|----------|----------|
| Core Services | 5 | 5 | 100% |
| Desktop Windows | 10 | 10 | 100% |
| Mobile Components | 25 | 25 | 100% |
| Hooks | 8 | 8 | 100% |
| Stores | 6 | 6 | 100% |
| **TOTAL** | **54** | **54** | **100%** |

## ✅ Migration Complete

All files have been successfully migrated from `ImRequestUtils` to the new modular API services.

## New API Services

### AuthApi (`src/services/api/AuthApi.ts`)

Authentication and authorization functions.

| Old Function | New API | Implementation Status |
|--------------|---------|----------------------|
| `sendCaptcha()` | `AuthApi.sendCaptcha()` | ⚠️ Mock - needs backend |
| `getCaptcha()` | `AuthApi.getCaptcha()` | ⚠️ Mock - needs backend |
| `forgetPassword()` | `AuthApi.forgetPassword()` | ⚠️ Mock - needs backend |
| `register()` | `AuthApi.register()` | ⚠️ Mock - needs backend |
| `logout()` | `AuthApi.logout()` | ✅ Matrix SDK |
| `checkQRStatus()` | `AuthApi.checkQRStatus()` | ⚠️ Mock - needs backend |
| `generateQRCode()` | `AuthApi.generateQRCode()` | ⚠️ Mock - needs backend |
| `scanQRCodeAPI()` | `AuthApi.scanQRCodeAPI()` | ⚠️ Mock - needs backend |
| `confirmQRCodeAPI()` | `AuthApi.confirmQRCodeAPI()` | ⚠️ Mock - needs backend |

### FriendsApi (`src/services/api/FriendsApi.ts`)

Friend management functions.

| Old Function | New API | Implementation Status |
|--------------|---------|----------------------|
| `searchFriend()` | `FriendsApi.searchFriend()` | ⚠️ Mock - needs Matrix User Directory API |
| `searchGroup()` | `FriendsApi.searchGroup()` | ⚠️ Mock - needs Matrix Room Directory API |
| `sendAddFriendRequest()` | `FriendsApi.sendAddFriendRequest()` | ⚠️ Mock - needs Enhanced Friend API |
| `deleteFriend()` | `FriendsApi.deleteFriend()` | ✅ Enhanced Friend API |
| `modifyFriendRemark()` | `FriendsApi.modifyFriendRemark()` | ✅ Enhanced Friend API |

### GroupsApi (`src/services/api/GroupsApi.ts`)

Group/room management functions.

| Old Function | New API | Implementation Status |
|--------------|---------|----------------------|
| `createGroup()` | `GroupsApi.createGroup()` | ✅ Matrix SDK (`createRoom`) |
| `removeGroupMember()` | `GroupsApi.removeGroupMember()` | ✅ Matrix SDK (`kick`) |
| `updateMyRoomInfo()` | `GroupsApi.updateMyRoomInfo()` | ⚠️ Partial - needs Matrix Member API |
| `applyGroup()` | `GroupsApi.applyGroup()` | ⚠️ Mock - needs Matrix Invite API |
| `exitGroup()` | `GroupsApi.exitGroup()` | ✅ Matrix SDK (`leave`) |
| `inviteGroupMember()` | `GroupsApi.inviteGroupMember()` | ✅ Matrix SDK (`invite`) |

### MessagesApi (`src/services/api/MessagesApi.ts`)

Message operations functions.

| Old Function | New API | Implementation Status |
|--------------|---------|----------------------|
| `recallMsg()` | `MessagesApi.recallMsg()` | ✅ Matrix SDK (`redactEvent`) |
| `getMsgReadCount()` | `MessagesApi.getMsgReadCount()` | ⚠️ Partial - needs Receipt API |
| `markMsgRead()` | `MessagesApi.markMsgRead()` | ✅ Matrix SDK (`sendReadReceipt`) |
| `getSessionDetail()` | `MessagesApi.getSessionDetail()` | ⚠️ Partial - basic room info |
| `getSessionDetailWithFriends()` | `MessagesApi.getSessionDetailWithFriends()` | ⚠️ Partial - basic room info |
| `markMsg()` | `MessagesApi.markMsg()` | ✅ Matrix SDK (`m.reaction` / `m.annotation`) |
| `mergeMsg()` | `MessagesApi.mergeMsg()` | ⚠️ Mock - needs forwarding API |

### SystemConfigApi (`src/services/api/SystemConfigApi.ts`)

System configuration and group management functions.

| Old Function | New API | Implementation Status |
|--------------|---------|----------------------|
| `initConfig()` | `SystemConfigApi.initConfig()` | ⚠️ Mock - needs backend config |
| `setSessionTop()` | `SystemConfigApi.setSessionTop()` | ✅ Matrix Account Data API |
| `shield()` | `SystemConfigApi.shield()` | ✅ Matrix Push Rules API |
| `notification()` | `SystemConfigApi.notification()` | ✅ Matrix Push Rules API |
| `updateRoomInfo()` | `SystemConfigApi.updateRoomInfo()` | ✅ Matrix SDK (`setRoomName`, `sendStateEvent`) |
| `getGroupInfo()` | `SystemConfigApi.getGroupInfo()` | ✅ Matrix SDK (`getRoom`) |
| `getGroupDetail()` | `SystemConfigApi.getGroupDetail()` | ✅ Matrix SDK (`getRoom`) |
| `getEmoji()` | `SystemConfigApi.getEmoji()` | ⚠️ Mock - needs backend emoji system |
| `addEmoji()` | `SystemConfigApi.addEmoji()` | ⚠️ Mock - needs backend emoji system |
| `deleteEmoji()` | `SystemConfigApi.deleteEmoji()` | ⚠️ Mock - needs backend emoji system |
| `groupList()` | `SystemConfigApi.groupList()` | ✅ Matrix SDK (`getRooms`) |
| `groupListMember()` | `SystemConfigApi.groupListMember()` | ✅ Matrix SDK (`getJoinedMembers`) |
| `addAdmin()` | `SystemConfigApi.addAdmin()` | ⚠️ Partial - needs Power Levels API |
| `revokeAdmin()` | `SystemConfigApi.revokeAdmin()` | ⚠️ Partial - needs Power Levels API |
| `getAnnouncementDetail()` | `SystemConfigApi.getAnnouncementDetail()` | ⚠️ Mock - needs backend |
| `editAnnouncement()` | `SystemConfigApi.editAnnouncement()` | ⚠️ Mock - needs backend |
| `pushAnnouncement()` | `SystemConfigApi.pushAnnouncement()` | ⚠️ Mock - needs backend |
| `deleteAnnouncement()` | `SystemConfigApi.deleteAnnouncement()` | ⚠️ Mock - needs backend |

### UserApi (`src/services/api/UserApi.ts`)

User-related functions.

| Old Function | New API | Implementation Status |
|--------------|---------|----------------------|
| `ModifyUserInfo()` | `UserApi.ModifyUserInfo()` | ✅ MatrixUserService |
| `setUserBadge()` | `UserApi.setUserBadge()` | ⚠️ Mock - needs backend badge system |
| `getBadgeList()` | `UserApi.getBadgeList()` | ⚠️ Mock - needs backend badge system |
| `uploadAvatar()` | `UserApi.uploadAvatar()` | ⚠️ Mock - needs Content Repository API |
| `changeUserState()` | `UserApi.changeUserState()` | ✅ Matrix SDK (`setPresence`) |
| `getAllUserState()` | `UserApi.getAllUserState()` | ✅ Mock - predefined presence states |
| `getUserByIds()` | `UserApi.getUserByIds()` | ⚠️ Partial - returns basic user info |

## Implementation Summary

### ✅ Fully Implemented (Using Matrix SDK)

- **Message Operations**: `recallMsg`, `markMsg` (reactions), `markMsgRead`
- **Group Operations**: `createGroup`, `removeGroupMember`, `exitGroup`, `inviteGroupMember`
- **User Operations**: `ModifyUserInfo`, `changeUserState`
- **Room Operations**: `updateRoomInfo`, `getGroupInfo`, `groupList`, `groupListMember`
- **Notification Control**: `setSessionTop`, `shield`, `notification`
- **Authentication**: `logout`

### ⚠️ Partially Implemented or Mock (Needs Backend/Enhancement)

- **QR Code Login**: `checkQRStatus`, `generateQRCode`, `scanQRCodeAPI`, `confirmQRCodeAPI`
- **Announcements**: `getAnnouncementDetail`, `editAnnouncement`, `pushAnnouncement`, `deleteAnnouncement`
- **Friend Operations**: `searchFriend`, `searchGroup`, `sendAddFriendRequest`
- **User Operations**: `uploadAvatar`, `setUserBadge`, `getBadgeList`
- **System Config**: `initConfig`, emoji operations
- **Message Operations**: `getMsgReadCount`, `mergeMsg`

## Type Safety

All migrated code:
- ✅ Passes TypeScript compilation
- ✅ Uses centralized type definitions in `src/services/api/types.ts`
- ✅ Maintains backward compatibility through `ImRequestUtils.ts` forwarding

## Migration Benefits

1. **Type Safety**: Proper TypeScript types for all API calls
2. **Modularity**: Functions organized by domain (Auth, Friends, Groups, Messages, User, SystemConfig)
3. **Maintainability**: Easier to update implementations without affecting callers
4. **Matrix Integration**: Direct use of Matrix SDK where possible
5. **Consistency**: Unified response format (`{ code, data }`) across all APIs

## Usage Example

```typescript
// Before (using ImRequestUtils)
import { recallMsg, markMsg, getUserDetail } from '@/utils/ImRequestUtils'

// After (using new API services)
import { MessagesApi, UserApi } from '@/services/api'

// All API calls follow the same pattern
const result = await MessagesApi.recallMsg({
  roomId: 'room-id',
  eventId: 'event-id'
})
```

## Next Steps

For production readiness, the following implementations are recommended:

1. **Backend API Integration**: Implement real APIs for captcha, password reset, user search
2. **Matrix SDK Enhancement**: Complete Power Levels API for admin operations
3. **Content Repository**: Implement avatar upload using Matrix Content Repository
4. **Receipt API**: Complete message read count functionality
5. **Custom Backend APIs**: Implement announcement and emoji systems

## Notes

- **Progress**: 54 out of 54 files migrated (100%)
- **Type Safety**: All code passes TypeScript compilation
- **Code Quality**: Biome linting passed (with expected warnings for mock functions and Matrix SDK type workarounds)
