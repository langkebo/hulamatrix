/**
 * Manage Space Dialog - Composable
 *
 * 提取 ManageSpaceDialog 组件的业务逻辑
 */

import { ref, computed, reactive, onMounted, type Ref } from 'vue'
import { useDialog, useMessage, type FormInst } from 'naive-ui'
import { useMatrixSpaces } from '@/hooks/useMatrixSpaces'
import type {
  RolePreset,
  Member,
  Space,
  BasicForm,
  PrivacyForm,
  PermissionsForm,
  NotificationsForm,
  AdvancedForm,
  InviteForm,
  DeleteForm
} from './types'

interface Options {
  space: Ref<Space | null>
  emit: (event: 'update:show' | 'updated', value?: boolean | Space) => void
}

export function useManageSpaceDialog(options: Options) {
  const dialog = useDialog()
  const message = useMessage()
  const { updateSpaceSettings, inviteToSpace, removeFromSpace } = useMatrixSpaces()

  // ============ 状态管理 ============
  const activeTab = ref('basic')
  const memberSearchQuery = ref('')
  const showInviteDialog = ref(false)
  const showDeleteConfirm = ref(false)
  const selectedMembers = ref<string[]>([])
  const selectedRole = ref('')
  const isSaving = ref(false)
  const isInviting = ref(false)
  const isDeleting = ref(false)

  // 表单引用
  const basicFormRef = ref<FormInst | null>(null)
  const inviteFormRef = ref<FormInst | null>(null)
  const deleteFormRef = ref<FormInst | null>(null)

  // 表单数据
  const basicForm = reactive<BasicForm>({
    name: '',
    topic: '',
    description: '',
    tags: []
  })

  const privacyForm = reactive<PrivacyForm>({
    visibility: 'public',
    joinRule: 'open' as 'open' | 'invite' | 'approval',
    allowSearch: true,
    showMemberList: true
  })

  const permissionsForm = reactive<PermissionsForm>({
    defaultPermissions: {
      canRead: true,
      canPost: true,
      canUpload: true,
      canInvite: false,
      canCreateRoom: false
    },
    advancedPermissions: {
      canModerate: false,
      canManageRooms: false,
      canManageSpace: false
    }
  })

  const notificationsForm = reactive<NotificationsForm>({
    space: {
      newMembers: true,
      memberLeft: false,
      spaceUpdated: true,
      roomCreated: true
    },
    messages: {
      level: 'all',
      mentions: false,
      keywords: false,
      keywordList: []
    },
    delivery: {
      inApp: true,
      email: false,
      push: true,
      sound: true
    }
  })

  const advancedForm = reactive<AdvancedForm>({
    contentModeration: {
      enabled: false,
      requireApproval: false,
      autoModerate: false,
      blockedWords: []
    },
    dataManagement: {
      messageRetention: 'forever',
      fileRetention: 'forever',
      allowExport: true
    }
  })

  const inviteForm = reactive<InviteForm>({
    emails: [''],
    message: '',
    permissions: 'member'
  })

  const deleteForm = reactive<DeleteForm>({
    confirm: ''
  })

  // ============ 选项数据 ============
  const notificationLevels = [
    { label: '所有消息', value: 'all' },
    { label: '仅提及', value: 'mentions' },
    { label: '静音', value: 'none' }
  ]

  const messageRetentionOptions = [
    { label: '永久保留', value: 'forever' },
    { label: '1年', value: '1year' },
    { label: '6个月', value: '6months' },
    { label: '3个月', value: '3months' },
    { label: '1个月', value: '1month' }
  ]

  const fileRetentionOptions = [
    { label: '永久保留', value: 'forever' },
    { label: '2年', value: '2years' },
    { label: '1年', value: '1year' },
    { label: '6个月', value: '6months' }
  ]

  const permissionPresets = [
    { label: '普通成员', value: 'member' },
    { label: '协管员', value: 'moderator' },
    { label: '管理员', value: 'admin' }
  ]

  const rolePresets: RolePreset[] = [
    {
      name: 'guest',
      label: '访客',
      description: '只能查看，无法互动',
      permissions: ['canRead']
    },
    {
      name: 'member',
      label: '成员',
      description: '标准成员权限',
      permissions: ['canRead', 'canPost', 'canUpload']
    },
    {
      name: 'moderator',
      label: '协管员',
      description: '可以帮助管理',
      permissions: ['canRead', 'canPost', 'canUpload', 'canInvite', 'canModerate', 'canManageRooms']
    },
    {
      name: 'admin',
      label: '管理员',
      description: '完全控制权限',
      permissions: [
        'canRead',
        'canPost',
        'canUpload',
        'canInvite',
        'canCreateRoom',
        'canModerate',
        'canManageRooms',
        'canManageSpace'
      ]
    }
  ]

  const bulkActions = [
    { label: '设为管理员', key: 'set-admin' },
    { label: '设为协管员', key: 'set-moderator' },
    { label: '移除成员', key: 'remove' }
  ]

  // ============ 计算属性 ============
  const filteredMembers = computed<Member[]>(() => {
    if (!options.space.value) return []
    const members = (options.space.value.members || []) as Member[]
    if (!memberSearchQuery.value.trim()) return members
    const query = memberSearchQuery.value.toLowerCase()
    return members.filter(
      (member: Member) =>
        (member.name || '').toLowerCase().includes(query) ||
        (member.status && member.status.toLowerCase().includes(query))
    )
  })

  // ============ 工具方法 ============
  const formatDate = (timestamp?: number): string => {
    const ts = timestamp ?? Date.now()
    return new Date(ts).toLocaleDateString('zh-CN')
  }

  const getRoleType = (role: string): 'error' | 'warning' | 'info' | 'default' | 'success' | 'primary' => {
    switch (role) {
      case 'admin':
        return 'error'
      case 'moderator':
        return 'warning'
      case 'member':
        return 'info'
      default:
        return 'default'
    }
  }

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'admin':
        return '管理员'
      case 'moderator':
        return '协管员'
      case 'member':
        return '成员'
      case 'guest':
        return '访客'
      default:
        return '用户'
    }
  }

  const getPermissionLabel = (permission: string): string => {
    const labels: Record<string, string> = {
      canRead: '查看',
      canPost: '发帖',
      canUpload: '上传',
      canInvite: '邀请',
      canCreateRoom: '创建房间',
      canModerate: '审核',
      canManageRooms: '管理房间',
      canManageSpace: '管理空间'
    }
    return labels[permission] || permission
  }

  const getMemberActions = (member: Member) => {
    const actions = [
      { label: '发送消息', key: 'message', icon: () => '💬' },
      { label: '查看资料', key: 'profile', icon: () => '👤' }
    ]

    if (member.role !== 'admin') {
      actions.push(
        { label: '设为协管员', key: 'promote-moderator', icon: () => '⬆️' },
        { label: '设为管理员', key: 'promote-admin', icon: () => '👑' },
        { label: '降为成员', key: 'demote-member', icon: () => '⬇️' },
        { label: '移除成员', key: 'remove', icon: () => '🚫' }
      )
    }

    return actions as Array<{
      label: string
      key: string
      icon: () => string
      [key: string]: unknown
    }>
  }

  // ============ 成员管理 ============
  const toggleMemberSelection = (memberId: string) => {
    const index = selectedMembers.value.indexOf(memberId)
    if (index > -1) {
      selectedMembers.value.splice(index, 1)
    } else {
      selectedMembers.value.push(memberId)
    }
  }

  const updateMemberRole = async (memberId: string, role: string) => {
    void memberId
    message.info(`已更新成员角色为 ${getRoleLabel(role)}`)
  }

  const confirmRemoveMember = (member: Member) => {
    if (!options.space.value) return
    const spaceId = options.space.value.id
    dialog.warning({
      title: '确认移除',
      content: `确定要移除成员 "${member.name}" 吗？`,
      positiveText: '确定移除',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          if (member.userId) await removeFromSpace(spaceId, member.userId)
          message.success(`已移除成员 ${member.name}`)
        } catch (_error) {
          message.error('移除成员失败')
        }
      }
    })
  }

  const confirmBulkRemove = () => {
    if (!options.space.value) return
    const spaceId = options.space.value.id
    dialog.warning({
      title: '批量移除',
      content: `确定要移除选中的 ${selectedMembers.value.length} 位成员吗？`,
      positiveText: '确定移除',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          for (const memberId of selectedMembers.value) {
            await removeFromSpace(spaceId, memberId)
          }
          message.success(`已移除 ${selectedMembers.value.length} 位成员`)
          selectedMembers.value = []
        } catch (_error) {
          message.error('批量移除失败')
        }
      }
    })
  }

  const handleMemberAction = (action: string) => {
    const member = filteredMembers.value.find((m: Member) => getMemberActions(m).some((a) => a.key === action))
    if (!member) return

    switch (action) {
      case 'message':
        message.info(`发送消息给 ${member.name}`)
        break
      case 'profile':
        message.info(`查看 ${member.name} 的资料`)
        break
      case 'promote-admin':
        if (member.id) updateMemberRole(member.id, 'admin')
        break
      case 'promote-moderator':
        if (member.id) updateMemberRole(member.id, 'moderator')
        break
      case 'demote-member':
        if (member.id) updateMemberRole(member.id, 'member')
        break
      case 'remove':
        confirmRemoveMember(member)
        break
    }
  }

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'set-admin':
        selectedMembers.value.forEach((memberId) => {
          updateMemberRole(memberId, 'admin')
        })
        selectedMembers.value = []
        break
      case 'set-moderator':
        selectedMembers.value.forEach((memberId) => {
          updateMemberRole(memberId, 'moderator')
        })
        selectedMembers.value = []
        break
      case 'remove':
        confirmBulkRemove()
        break
    }
  }

  // ============ 权限管理 ============
  const applyRolePreset = (role: RolePreset) => {
    selectedRole.value = role.name

    // 重置权限
    Object.keys(permissionsForm.defaultPermissions).forEach((key) => {
      permissionsForm.defaultPermissions[key as keyof typeof permissionsForm.defaultPermissions] = false
    })
    Object.keys(permissionsForm.advancedPermissions).forEach((key) => {
      permissionsForm.advancedPermissions[key as keyof typeof permissionsForm.advancedPermissions] = false
    })

    // 应用预设权限
    role.permissions.forEach((perm: string) => {
      if (perm in permissionsForm.defaultPermissions) {
        permissionsForm.defaultPermissions[perm as keyof typeof permissionsForm.defaultPermissions] = true
      } else if (perm in permissionsForm.advancedPermissions) {
        permissionsForm.advancedPermissions[perm as keyof typeof permissionsForm.advancedPermissions] = true
      }
    })

    message.success(`已应用 ${role.label} 权限预设`)
  }

  // ============ 事件处理 ============
  const handleCancel = () => {
    resetForms()
    options.emit('update:show', false)
  }

  const handleSave = async () => {
    try {
      await basicFormRef.value?.validate()
      isSaving.value = true

      if (!options.space.value) return
      await updateSpaceSettings(options.space.value.id, {})

      message.success('空间设置已更新')
      options.emit('updated', { ...options.space.value })
      options.emit('update:show', false)
    } catch (_error) {
      message.error('保存失败')
    } finally {
      isSaving.value = false
    }
  }

  const handleSendInvites = async () => {
    try {
      await inviteFormRef.value?.validate()
      isInviting.value = true

      if (!options.space.value) return
      const emails = inviteForm.emails.filter((email) => email.trim())
      for (const email of emails) {
        await inviteToSpace(options.space.value.id, email)
      }

      message.success('邀请已发送')
      showInviteDialog.value = false

      // 重置表单
      inviteForm.emails = ['']
      inviteForm.message = ''
      inviteForm.permissions = 'member'
    } catch (_error) {
      message.error('发送邀请失败')
    } finally {
      isInviting.value = false
    }
  }

  const handleArchiveSpace = async () => {
    if (!options.space.value) return
    dialog.warning({
      title: '确认归档',
      content: `确定要归档空间 "${options.space.value.name}" 吗？归档后空间将变为只读状态。`,
      positiveText: '确定归档',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          message.warning('归档功能暂未实现')
        } catch (_error) {
          message.error('归档失败')
        }
      }
    })
  }

  const handleDeleteSpace = async () => {
    try {
      await deleteFormRef.value?.validate()
      isDeleting.value = true

      if (!options.space.value) return
      message.warning('删除功能暂未实现')
    } catch (_error) {
      message.error('删除失败')
    } finally {
      isDeleting.value = false
    }
  }

  const resetForms = () => {
    selectedMembers.value = []
    selectedRole.value = ''
  }

  const loadFormData = () => {
    if (!options.space.value) return
    basicForm.name = options.space.value.name
    basicForm.topic = options.space.value.topic || ''
    basicForm.description = options.space.value.description || ''
    basicForm.tags = (options.space.value.tags || []) as string[]

    privacyForm.visibility = options.space.value.isPublic ? 'public' : 'private'
    privacyForm.joinRule = (options.space.value.joinRule || 'open') as 'open' | 'invite' | 'approval'
  }

  // ============ 验证规则 ============
  const basicRules = {
    name: [
      { required: true, message: '请输入空间名称', trigger: 'blur' },
      { min: 2, max: 50, message: '空间名称长度应在2-50个字符之间', trigger: 'blur' }
    ]
  }

  const inviteRules = {
    emails: [
      {
        validator: (_rule: unknown, value: string[]) => {
          const validEmails = value.every((email) => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return validEmails ? Promise.resolve() : Promise.reject('请输入有效的邮箱地址')
        },
        trigger: 'blur'
      }
    ]
  }

  const deleteRules = {
    confirm: [
      {
        validator: (_rule: unknown, value: string) => {
          if (!options.space.value) return Promise.resolve()
          return value === options.space.value.name
            ? Promise.resolve()
            : Promise.reject(`请输入完整的空间名称 "${options.space.value.name}"`)
        },
        trigger: 'blur'
      }
    ]
  }

  // ============ 生命周期 ============
  onMounted(() => {
    loadFormData()
  })

  return {
    // 状态
    activeTab,
    memberSearchQuery,
    showInviteDialog,
    showDeleteConfirm,
    selectedMembers,
    selectedRole,
    isSaving,
    isInviting,
    isDeleting,

    // 表单引用
    basicFormRef,
    inviteFormRef,
    deleteFormRef,

    // 表单数据
    basicForm,
    privacyForm,
    permissionsForm,
    notificationsForm,
    advancedForm,
    inviteForm,
    deleteForm,

    // 选项数据
    notificationLevels,
    messageRetentionOptions,
    fileRetentionOptions,
    permissionPresets,
    rolePresets,
    bulkActions,

    // 计算属性
    filteredMembers,

    // 方法
    formatDate,
    getRoleType,
    getRoleLabel,
    getPermissionLabel,
    getMemberActions,
    toggleMemberSelection,
    handleMemberAction,
    handleBulkAction,
    applyRolePreset,
    handleCancel,
    handleSave,
    handleSendInvites,
    handleArchiveSpace,
    handleDeleteSpace,
    loadFormData,

    // 验证规则
    basicRules,
    inviteRules,
    deleteRules
  }
}
