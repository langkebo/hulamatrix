<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { NTree, NEmpty, NSpin } from 'naive-ui'
import type { TreeOption } from 'naive-ui'
import { useSpacesStore } from '@/stores/spaces'
import SpaceIcon from '@/components/common/SpaceIcon.vue'

interface Props {
  spaceId: string
  maxDepth?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxDepth: 3
})

const spacesStore = useSpacesStore()
const loading = ref(false)

const treeData = computed<TreeOption[]>(() => {
  return buildTreeData(spacesStore.spaceHierarchy, 0)
})

function buildTreeData(nodes: any[], depth: number): TreeOption[] {
  return nodes.map((node) => {
    const treeNode: TreeOption = {
      key: node.roomId,
      label: node.name,
      depth,
      isLeaf: node.type === 'room' || depth >= props.maxDepth - 1,
      children: node.children && node.children.length > 0 ? buildTreeData(node.children, depth + 1) : undefined
    }
    return treeNode
  })
}

function handleNodeSelect(keys: string[]) {
  if (keys.length > 0) {
    const roomId = keys[0]
    console.log('Selected room:', roomId)
  }
}

async function loadHierarchy() {
  loading.value = true
  try {
    await spacesStore.fetchSpaceHierarchy(props.spaceId, props.maxDepth)
  } finally {
    loading.value = false
  }
}

function findNode(nodes: any[], key: string): any {
  for (const node of nodes) {
    if (node.roomId === key) return node
    if (node.children) {
      const found = findNode(node.children, key)
      if (found) return found
    }
  }
  return null
}

function renderPrefix({ option }: { option: TreeOption }) {
  const node = findNode(spacesStore.spaceHierarchy, option.key as string)
  if (!node) return null

  return h('div', { class: 'flex items-center gap-2' }, [
    h(SpaceIcon, { type: node.type, class: 'w-5 h-5' }),
    h('span', { class: 'text-sm text-gray-500' }, `(${node.memberCount})`)
  ])
}

loadHierarchy()
</script>

<template>
  <div class="space-hierarchy-view">
    <NSpin :show="loading">
      <div v-if="treeData.length > 0" class="h-full">
        <NTree
          :data="treeData"
          :show-line="true"
          :selectable="true"
          :expand-on-click="true"
          :render-prefix="renderPrefix"
          @update:selected-keys="handleNodeSelect"
        />
      </div>
      <NEmpty v-else description="暂无子空间或房间" />
    </NSpin>
  </div>
</template>

<style scoped>
.space-hierarchy-view {
  height: 100%;
  padding: 16px;
}
</style>
