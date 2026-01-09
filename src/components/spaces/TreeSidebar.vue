<template>
  <div class="space-tree">
    <div class="batch-bar" v-if="checkedKeys.length > 0">
      <span>已选 {{ checkedKeys.length }} 项</span>
      <n-button size="tiny" type="error" @click="batchRemove">移除</n-button>
      <n-button size="tiny" @click="checkedKeys = []">取消</n-button>
    </div>
    <n-tree
      :data="treeData"
      :block-line="true"
      :expand-on-click="true"
      :render-label="renderLabel"
      :draggable="true"
      :checkable="true"
      :checked-keys="checkedKeys"
      @update:checked-keys="onCheck"
      @drop="onDrop"
      @update:selected-keys="onSelect" />
  </div>
</template>
<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NTag, NBadge, type TreeOption, type TreeDropInfo } from 'naive-ui'
import { useMatrixSpaces } from '@/hooks/useMatrixSpaces'

// Tree node interface extending Naive UI's TreeOption with index signature
interface TreeNode extends TreeOption {
  key?: string | number // Make more flexible to match TreeOption
  label?: string
  isSpace?: boolean // Make optional to match TreeOption
  notifications?: {
    notificationCount?: number
    highlightCount?: number
  }
  memberCount?: number
  parentId?: string
  children?: TreeNode[]
  [key: string]: unknown // Required to match TreeOption's Record<string, unknown>
}

const router = useRouter()
const { userSpaces, addChildToSpace, removeChildFromSpace, setChildOrder, inviteToSpace, getSpaceUnreadCount } =
  useMatrixSpaces()
const checkedKeys = ref<string[]>([])
const treeData = computed<TreeNode[]>(() =>
  (userSpaces.value || []).map((s) => {
    const unread = getSpaceUnreadCount(s.id)
    return {
      key: s.id,
      label: s.name,
      isSpace: true,
      notifications: { notificationCount: unread.notification, highlightCount: unread.highlight },
      memberCount: s.memberCount,
      children: Array.isArray(s.children)
        ? s.children.map(
            (c): TreeNode => ({
              key: c.roomId,
              label: c.name || c.roomId,
              isSpace: false,
              parentId: s.id,
              notifications: c.notifications,
              memberCount: c.memberCount
            })
          )
        : []
    }
  })
)
const onSelect = (keys: string[]) => {
  const id = keys[0]
  if (id) router.push({ path: '/spaces', query: { spaceId: id } })
}
const onCheck = (keys: string[]) => {
  checkedKeys.value = keys
}
const batchRemove = async () => {
  if (!confirm(`确认移除选中的 ${checkedKeys.value.length} 个项目吗？`)) return
  // Find parent for each checked key if it's a child
  for (const key of checkedKeys.value) {
    // Check if it's a child in any space
    for (const s of userSpaces.value || []) {
      if (s.children?.some((c) => c.roomId === key)) {
        await removeChildFromSpace(s.id, key)
      }
    }
  }
  checkedKeys.value = []
}
const renderLabel = (info: { option: TreeOption }) => {
  const node = info.option as TreeNode
  const isSpace = node.isSpace
  const spaceId = String(isSpace ? node.key : node.parentId || '')
  const ops = []
  if (isSpace) {
    ops.push(h('a', { style: 'margin-left:8px', onClick: () => addChild(spaceId) }, '添加'))
    ops.push(h('a', { style: 'margin-left:4px', onClick: () => invite(spaceId) }, '邀请'))
  } else if (spaceId) {
    ops.push(h('a', { style: 'margin-left:8px', onClick: () => removeChild(spaceId, String(node.key || '')) }, '移除'))
    ops.push(h('a', { style: 'margin-left:4px', onClick: () => orderChild(spaceId, String(node.key || '')) }, '排序'))
  }

  const badges = []
  if (node.memberCount) {
    badges.push(
      h(
        NTag,
        { size: 'small', bordered: false, style: 'margin-right:4px; font-size:10px' },
        { default: () => `${node.memberCount}人` }
      )
    )
  }
  if ((node.notifications?.notificationCount ?? 0) > 0 || (node.notifications?.highlightCount ?? 0) > 0) {
    const notif = node.notifications!
    badges.push(
      h(NBadge, {
        value: (notif.notificationCount ?? 0) + (notif.highlightCount ?? 0),
        max: 99,
        type: (notif.highlightCount ?? 0) > 0 ? 'error' : 'info'
      })
    )
  }

  return h('div', { style: 'display: flex; align-items: center; width: 100%' }, [
    h('span', { style: 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap' }, node.label),
    ...badges,
    h('span', { style: 'white-space: nowrap' }, ops)
  ])
}
const addChild = async (spaceId: string) => {
  const roomId = window.prompt('输入要添加的房间ID') || ''
  if (!roomId) return
  await addChildToSpace(spaceId, roomId)
}
const removeChild = async (spaceId: string, childRoomId: string) => {
  await removeChildFromSpace(spaceId, childRoomId)
}
const orderChild = async (spaceId: string, childRoomId: string) => {
  const order = window.prompt('输入排序序号(字符串或数字)') || ''
  if (!order) return
  await setChildOrder(spaceId, childRoomId, order)
}
const invite = async (spaceId: string) => {
  const uid = window.prompt('输入用户ID（如 @user:cjystx.top）') || ''
  if (!uid) return
  await inviteToSpace(spaceId, uid)
}
const onDrop = async (info: TreeDropInfo) => {
  const dragNode = info.dragNode as TreeNode | undefined
  const dropNode = info.node as TreeNode | undefined
  const dragKey = dragNode?.key
  const dropKey = dropNode?.key
  const isSpace = (userSpaces.value || []).some((s) => s.id === String(dropKey || ''))
  const spaceId = isSpace
    ? String(dropKey || '')
    : (userSpaces.value || []).find((s) => (s.children || []).some((c) => c.roomId === String(dropKey || '')))?.id
  if (!spaceId || !dragKey) return
  const order = String(Date.now())
  await setChildOrder(spaceId, String(dragKey), order)
}
</script>
<style scoped>
.space-tree {
  width: 260px;
  border-right: 1px solid var(--border-color);
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--hover-color);
  border-radius: 4px;
  margin-bottom: 8px;
}
</style>
