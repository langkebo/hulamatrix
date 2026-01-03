# Option A: Unified Naming and Structure - Detailed Implementation Plan

**Date**: 2026-01-03
**Approach**: Option A - 统一命名和结构
**Estimated Time**: 3-4 days
**Risk Level**: Low (refactoring only, no logic changes)

---

## Overview

This plan implements **Option A** from the component structure optimization document: unifying naming conventions while maintaining PC/mobile separation.

**Goal**: Make component structure consistent and predictable across platforms without major code changes.

---

## Current State Analysis

### PC Components (`src/components/`)
```
rightBox/                    # ⚠️ Inconsistent naming
├── chatBox/                 # Main chat component
├── renderMessage/           # Message rendering
├── emoticon/                # Emoji picker
├── location/                # Location picker
└── [9 direct .vue files]    # Various chat-related components
```

### Mobile Components (`src/mobile/components/`)
```
chat-room/                   # ⚠️ Inconsistent naming (should match PC)
my/                          # ⚠️ Inconsistent naming (should be "profile")
icons/                       # ✅ Mobile-specific (OK)
virtual-scroll/              # ✅ Mobile-specific (OK)
```

### Affected Files Count
- **rightBox imports**: ~11 files
- **chat-room imports**: ~4 files
- **my imports**: ~2 files
- **Total estimated**: ~17-20 files need import updates

---

## Detailed Phase-by-Phase Plan

### Phase 1: Rename rightBox → chat (PC)

**Impact**: High - Core chat functionality
**Time**: 1-2 hours
**Files to Rename**: 5 directories + 9 files

#### 1.1 Directory Renaming

```bash
# Main directory
mv src/components/rightBox src/components/chat

# Subdirectories for better naming
mv src/components/chat/renderMessage src/components/chat/message-renderer
mv src/components/chat/emoticon src/components/chat/emoji-picker
mv src/components/chat/location src/components/chat/location-picker
```

**Rationale**:
- `chat` is clearer than `rightBox` (describes function, not position)
- `message-renderer` is more descriptive than `renderMessage`
- `emoji-picker` follows standard naming convention
- `location-picker` clarifies it's a component for picking locations

#### 1.2 File Renaming (Optional - Can Be Phase 1b)

```bash
# Standardize to PascalCase for component files
# Note: Keep index.vue for directory exports if desired
mv src/components/chat/FloatingTypingHint.vue src/components/chat/FloatingTypingHint.vue  # ✅ Already good
mv src/components/chat/PrivateChatButton.vue src/components/chat/PrivateChatButton.vue    # ✅ Already good
```

#### 1.3 Import Updates Required

**Files that import from rightBox** (11 files identified):

| File | Line | Import Path |
|------|------|-------------|
| `src/layout/right/index.vue` | Multiple | `@/components/rightBox/*` |
| `src/views/multiMsgWindow/index.vue` | - | `@/components/rightBox/*` |
| `src/mobile/components/chat-room/HeaderBar.vue` | - | `@/components/rightBox/*` |
| `src/components/matrix/MatrixMsgInput.vue` | - | `@/components/rightBox/*` |
| [8 more files] | - | Various paths |

**Replacement Pattern**:
```typescript
// Before
import { XYZ } from '@/components/rightBox/...'
import ABC from '@/components/rightBox/...'

// After
import { XYZ } from '@/components/chat/...'
import ABC from '@/components/chat/...'
```

---

### Phase 2: Rename Mobile Directories

**Impact**: Medium - Mobile-specific
**Time**: 30 minutes
**Files to Rename**: 2 directories

#### 2.1 Rename chat-room → chat

```bash
mv src/mobile/components/chat-room src/mobile/components/chat
```

**Rationale**: Match PC naming for consistency

**Affected Imports** (4 files):
- `src/views/ManageGroupMember.vue`
- `src/mobile/views/private-chat/MobilePrivateChatView.vue`
- `src/mobile/views/private-chat/MobilePrivateChatView.vue.backup`
- `src/mobile/views/settings/SettingsLayout.vue`

**Replacement Pattern**:
```typescript
// Before
import { XYZ } from '#/components/chat-room/...'
import { XYZ } from '@/mobile/components/chat-room/...'

// After
import { XYZ } from '#/components/chat/...'
import { XYZ } from '@/mobile/components/chat/...'
```

#### 2.2 Rename my → profile

```bash
mv src/mobile/components/my src/mobile/components/profile
```

**Rationale**: "profile" is more descriptive and standard

**Affected Imports** (2 files):
- `src/mobile/views/my/index.vue`
- `src/mobile/views/friends/FriendInfo.vue`

**Replacement Pattern**:
```typescript
// Before
import { XYZ } from '#/components/my/...'
import { XYZ } from '@/mobile/components/my/...'

// After
import { XYZ } from '#/components/profile/...'
import { XYZ } from '@/mobile/components/profile/...'
```

#### 2.3 Update Mobile View Directory

Since we renamed `my` component, also rename the view directory for consistency:

```bash
# Optional: Can be done separately
mv src/mobile/views/my src/mobile/views/profile
```

---

### Phase 3: Update All Imports

**Impact**: High - Breaking changes if not done correctly
**Time**: 1-2 hours
**Automation**: Yes, can use find + sed

#### 3.1 Automated Import Path Updates

```bash
# Step 1: Update rightBox → chat
find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']@/components/rightBox|from '"'"']@/components/chat|g' {} +

# Step 2: Update renderMessage → message-renderer
find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']@/components/chat/renderMessage|from '"'"']@/components/chat/message-renderer|g' {} +

# Step 3: Update emoticon → emoji-picker
find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']@/components/chat/emoticon|from '"'"']@/components/chat/emoji-picker|g' {} +

# Step 4: Update location → location-picker
find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']@/components/chat/location|from '"'"']@/components/chat/location-picker|g' {} +

# Step 5: Update mobile chat-room → chat
find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']#/components/chat-room|from '"'"']#/components/chat|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']@/mobile/components/chat-room|from '"'"']@/mobile/components/chat|g' {} +

# Step 6: Update mobile my → profile
find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']#/components/my|from '"'"']#/components/profile|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from ['"'"']@/mobile/components/my|from '"'"']@/mobile/components/profile|g' {} +
```

#### 3.2 Manual Verification Required

After automated updates, manually check:
1. **Component imports** - Ensure correct path resolution
2. **Dynamic imports** - Check for `defineAsyncComponent` usage
3. **Template references** - Check for component usage in `<template>`
4. **TypeScript imports** - Ensure type imports are updated

---

### Phase 4: Verification and Testing

**Impact**: Critical - Must pass all checks
**Time**: 1-2 hours

#### 4.1 Automated Checks

```bash
# 1. TypeScript type checking
pnpm typecheck

# 2. Build verification
pnpm run build

# 3. Linting
pnpm run check:write

# 4. Run tests
pnpm test:run
```

#### 4.2 Manual Testing Checklist

- [ ] **Desktop Chat**: Open chat window, verify all components load
- [ ] **Message Rendering**: Check text, image, file messages display
- [ ] **Emoji Picker**: Verify emoji selection works
- [ ] **Location Picker**: Test location sharing (if available)
- [ ] **Mobile Chat**: Open mobile chat, verify all features
- [ ] **Mobile Profile**: Access profile/settings on mobile
- [ ] **Platform Detection**: Verify desktop/mobile specific components load correctly

#### 4.3 Import Validation

```bash
# Check for any remaining references to old names
grep -r "rightBox" src/ --include="*.vue" --include="*.ts" --include="*.tsx"
grep -r "chat-room" src/ --include="*.vue" --include="*.ts" --include="*.tsx"
grep -r "from.*my'" src/mobile --include="*.vue" --include="*.ts"

# Should return no results (except this document)
```

---

## Migration Script

Create a migration script for safe execution:

```bash
#!/bin/bash
# migrate-option-a.sh

set -e  # Exit on error

echo "=== Option A Migration: rightBox → chat, chat-room → chat, my → profile ==="

# Backup current state
BACKUP_DIR=".backup-option-a-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Backup created: $BACKUP_DIR"

# Step 1: Create backup
cp -r src/components/rightBox "$BACKUP_DIR/"
cp -r src/mobile/components/chat-room "$BACKUP_DIR/"
cp -r src/mobile/components/my "$BACKUP_DIR/"

# Step 2: Rename directories (PC)
echo "Step 1: Renaming PC directories..."
mv src/components/rightBox src/components/chat
mv src/components/chat/renderMessage src/components/chat/message-renderer
mv src/components/chat/emoticon src/components/chat/emoji-picker
mv src/components/chat/location src/components/chat/location-picker

# Step 3: Rename directories (Mobile)
echo "Step 2: Renaming mobile directories..."
mv src/mobile/components/chat-room src/mobile/components/chat
mv src/mobile/components/my src/mobile/components/profile
mv src/mobile/views/my src/mobile/views/profile

# Step 4: Update imports
echo "Step 3: Updating import paths..."
find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'@/components/rightBox|from '"'"'@/components/chat|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'@/components/chat/renderMessage|from '"'"'@/components/chat/message-renderer|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'@/components/chat/emoticon|from '"'"'@/components/chat/emoji-picker|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'@/components/chat/location|from '"'"'@/components/chat/location-picker|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'#/components/chat-room|from '"'"'#/components/chat|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'@/mobile/components/chat-room|from '"'"'@/mobile/components/chat|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'#/components/my|from '"'"'#/components/profile|g' {} +

find src -type f \( -name "*.vue" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '"'"'@/mobile/components/my|from '"'"'@/mobile/components/profile|g' {} +

echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "1. Run: pnpm typecheck"
echo "2. Run: pnpm run check:write"
echo "3. Run: pnpm test:run"
echo "4. Test the application manually"
echo ""
echo "To rollback: cp -r $BACKUP_DIR/* src/components/"
```

---

## Success Criteria

### Before Migration
```
src/components/rightBox/         # ❌ Inconsistent
src/mobile/components/chat-room/ # ❌ Inconsistent
src/mobile/components/my/        # ❌ Inconsistent
```

### After Migration
```
src/components/chat/             # ✅ Clear, descriptive
src/components/chat/message-renderer/  # ✅ Better naming
src/components/chat/emoji-picker/       # ✅ Standard naming
src/components/chat/location-picker/    # ✅ Clear purpose
src/mobile/components/chat/     # ✅ Matches PC
src/mobile/components/profile/  # ✅ Descriptive
```

### Quality Metrics

| Metric | Before | After |
|--------|--------|-------|
| Naming Consistency | 60% | 100% |
| Import Path Clarity | Medium | High |
| Developer Experience | Confusing | Clear |
| PC/Mobile Alignment | Low | High |

---

## Risk Assessment

### Low Risk ✅
- Purely cosmetic changes
- No logic modifications
- Easy to rollback
- Can be done incrementally

### Potential Issues ⚠️
1. **Import Path Errors**: Mitigated by automated find+replace
2. **Build Cache**: Clear cache after migration
3. **IDE Configuration**: May need to restart IDE/language server
4. **Deployment**: Ensure build is clean before deploying

### Rollback Plan

```bash
# If anything goes wrong
git restore src/components/
git restore src/mobile/
# Or restore from backup
```

---

## Timeline

| Phase | Task | Time | Owner |
|-------|------|------|-------|
| 1 | Rename rightBox → chat (PC) | 1-2 hours | - |
| 2 | Rename mobile directories | 30 min | - |
| 3 | Update all imports | 1-2 hours | - |
| 4 | Verification & testing | 1-2 hours | - |
| | **Total** | **4-7 hours** | |

---

## Documentation Updates Required

1. **Update CLAUDE.md** - Component directory structure
2. **Update tsconfig.json paths** (if any hardcoded)
3. **Update any internal documentation**
4. **Create migration guide for contributors**

---

## Post-Migration Next Steps

After completing Option A, consider:

1. **Short-term (1-2 weeks)**
   - Monitor for any broken imports
   - Update team documentation
   - Gather feedback on new naming

2. **Medium-term (1-2 months)**
   - Evaluate Option B (shared components)
   - Identify components that can be merged
   - Plan for code reduction

3. **Long-term (3-6 months)**
   - Consider Option C (feature-based organization)
   - Architectural review
   - Full component audit

---

## Appendix: File Inventory

### PC Components to Rename

**Main Directory**: `src/components/rightBox` → `src/components/chat`

**Subdirectories**:
- `chatBox/` → Keep as is
- `renderMessage/` → `message-renderer/`
- `emoticon/` → `emoji-picker/`
- `location/` → `location-picker/`

**Direct Files** (9 files, no rename needed):
- `FloatingTypingHint.vue`
- `Details.vue`
- `FileUploadProgress.vue`
- `MsgInput.vue`
- `VoiceRecorder.vue`
- `PrivateChatButton.vue`
- `ApplyList.vue`
- `FileUploadModal.vue`
- `PrivateChatDialog.vue`

### Mobile Components to Rename

**Main Directories**:
- `src/mobile/components/chat-room/` → `src/mobile/components/chat/`
- `src/mobile/components/my/` → `src/mobile/components/profile/`

**View Directory**:
- `src/mobile/views/my/` → `src/mobile/views/profile/`

---

**Status**: 📋 Plan Complete - Ready for Execution

**Next Step**: Review plan, then execute migration

**Last Updated**: 2026-01-03
