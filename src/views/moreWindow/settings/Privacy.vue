<template>
  <n-space vertical :size="16" class="p-16px">
    <n-card>
      <n-form :model="form" :rules="rules" size="medium">
        <n-form-item label="目标类型" path="targetType">
          <n-select v-model:value="form.targetType" :options="targetTypeOptions" />
        </n-form-item>
        <n-form-item label="标识" path="targetId">
          <n-input v-model:value="form.targetId" placeholder="用户MXID或房间ID" clearable />
        </n-form-item>
        <n-form-item label="操作" path="action">
          <n-select v-model:value="form.action" :options="actionOptions" />
        </n-form-item>
        <n-form-item v-if="form.action==='report'" label="原因" path="reason">
          <n-input v-model:value="form.reason" type="textarea" rows="3" placeholder="请输入举报原因" />
        </n-form-item>
        <n-space>
          <n-button type="primary" @click="submit">执行</n-button>
          <n-button tertiary @click="reset">重置</n-button>
          <n-button tertiary type="info" @click="toManage">查看隐私管理</n-button>
        </n-space>
      </n-form>
    </n-card>
  </n-space>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
const msg = useMessage()
const router = useRouter()
const form = ref({ targetType: 'user', targetId: '', action: 'block', reason: '' })
const rules = {
  targetType: { required: true, trigger: ['change'] },
  targetId: { required: true, trigger: ['input', 'blur'] },
  action: { required: true, trigger: ['change'] }
}
const targetTypeOptions = [
  { label: '用户', value: 'user' },
  { label: '房间', value: 'room' }
]
const actionOptions = [
  { label: '屏蔽', value: 'block' },
  { label: '取消屏蔽', value: 'unblock' },
  { label: '举报', value: 'report' }
]
const submit = async () => {
  try {
    const { blockUser, unblockUser, blockRoom, unblockRoom, reportUser, reportRoom } = await import(
      '@/integrations/synapse/privacy'
    )
    const t = form.value.targetType
    const a = form.value.action
    const id = form.value.targetId.trim()
    if (!id) {
      msg.error('请输入标识')
      return
    }
    if (t === 'user' && a === 'block') await blockUser(id)
    else if (t === 'user' && a === 'unblock') await unblockUser(id)
    else if (t === 'user' && a === 'report') await reportUser(id, form.value.reason || '')
    else if (t === 'room' && a === 'block') await blockRoom(id)
    else if (t === 'room' && a === 'unblock') await unblockRoom(id)
    else if (t === 'room' && a === 'report') await reportRoom(id, form.value.reason || '')
    msg.success('操作成功')
  } catch {
    msg.error('操作失败')
  }
}
const reset = () => {
  form.value = { targetType: 'user', targetId: '', action: 'block', reason: '' }
}
const toManage = () => {
  router.push('/settings/privacy/manage')
}
</script>
