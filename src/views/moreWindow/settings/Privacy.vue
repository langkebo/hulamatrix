<template>
  <n-space vertical :size="16" class="p-16px">
    <n-card>
      <n-form :model="actionForm" :rules="rules" size="medium">
        <n-form-item label="目标类型" path="targetType">
          <n-select v-model:value="actionForm.targetType" :options="targetTypeOptions" />
        </n-form-item>
        <n-form-item label="标识" path="targetId">
          <n-input v-model:value="actionForm.targetId" placeholder="用户MXID或房间ID" clearable />
        </n-form-item>
        <n-form-item label="操作" path="action">
          <n-select v-model:value="actionForm.action" :options="actionOptions" />
        </n-form-item>
        <n-form-item v-if="actionForm.action === 'report'" label="原因" path="reason">
          <n-input v-model:value="actionForm.reason" type="textarea" rows="3" placeholder="请输入举报原因" />
        </n-form-item>
        <n-space>
          <n-button type="primary" @click="submit" :loading="actionLoading">执行</n-button>
          <n-button tertiary @click="resetActionForm">重置</n-button>
          <n-button tertiary type="info" @click="toManage">查看隐私管理</n-button>
        </n-space>
      </n-form>
    </n-card>
  </n-space>
</template>
<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
import { usePrivacySettings } from '@/composables'

const msg = useMessage()
const router = useRouter()

const { actionForm, actionLoading, executeAction, resetActionForm } = usePrivacySettings()

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
    await executeAction()
    msg.success('操作成功')
    // Ideally clear form or just reason/id, but resetActionForm clears all.
    // The original code didn't clear on success except via reset button?
    // Wait, original code: msg.success('操作成功') -> done.
    // Mobile code: form.value.targetId = ''; form.value.reason = ''
    // I'll keep it simple for now or maybe clear ID?
    // Let's mimic original PC behavior: it didn't auto-reset.
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'Target ID is required') {
      msg.error('请输入标识')
    } else {
      msg.error('操作失败')
    }
  }
}

const toManage = () => {
  router.push('/settings/privacy/manage')
}
</script>
