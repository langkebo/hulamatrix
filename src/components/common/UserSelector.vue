<template>
  <div class="user-selector">
    <n-select
      v-model:value="selectedUsers"
      :multiple="multiple"
      :options="userOptions"
      :placeholder="placeholder"
      :max-tag-count="maxTagCount"
      :loading="loading"
      :remote="remote"
      :filterable="filterable"
      :clearable="clearable"
      :disabled="disabled"
      :size="size"
      @search="handleSearch"
      @blur="handleBlur"
      @focus="handleFocus" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useGlobalStore } from '@/stores/global'
import { logger } from '@/utils/logger'

interface Props {
  modelValue: string[]
  multiple?: boolean
  placeholder?: string
  max?: number
  maxTagCount?: number
  loading?: boolean
  remote?: boolean
  filterable?: boolean
  clearable?: boolean
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
  excludeSelf?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string[]): void
  (e: 'blur'): void
  (e: 'focus'): void
  (e: 'search', query: string): void
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  placeholder: '请选择用户',
  max: 50,
  maxTagCount: 3,
  loading: false,
  remote: false,
  filterable: true,
  clearable: true,
  disabled: false,
  size: 'medium',
  excludeSelf: true
})

const emit = defineEmits<Emits>()

const groupStore = useGroupStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const searchQuery = ref('')

// 计算用户选项
const userOptions = computed(() => {
  const users = groupStore.userList || []
  const selfUid = userStore.userInfo?.uid

  let filteredUsers = users

  // 排除自己
  if (props.excludeSelf && selfUid) {
    filteredUsers = filteredUsers.filter((user) => user.uid !== selfUid)
  }

  // 最大数量限制
  if (props.max) {
    filteredUsers = filteredUsers.slice(0, props.max)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filteredUsers = filteredUsers.filter(
      (user) => user.name.toLowerCase().includes(query) || (user.account && user.account.toLowerCase().includes(query))
    )
  }

  return filteredUsers.map((user) => ({
    label: user.name,
    value: user.uid,
    avatar: user.avatar,
    account: user.account
  }))
})

// 选中的用户
const selectedUsers = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 搜索处理
const handleSearch = (query: string) => {
  searchQuery.value = query
  emit('search', query)
}

// 其他事件处理
const handleBlur = () => emit('blur')
const handleFocus = () => emit('focus')

// 初始化时加载用户列表
onMounted(() => {
  if (groupStore.userList.length === 0) {
    // 如果用户列表为空，尝试加载
    groupStore.getGroupUserList(globalStore.currentSessionRoomId, true).catch(logger.error)
  }
})

// 监听当前会话变化，更新用户列表
watch(
  () => globalStore.currentSessionRoomId,
  (roomId) => {
    if (roomId) {
      groupStore.getGroupUserList(roomId, true).catch(logger.error)
    }
  }
)
</script>

<style scoped lang="scss">
.user-selector {
  width: 100%;
}
</style>
