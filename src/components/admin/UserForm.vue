<template>
  <div class="user-form">
    <n-form ref="formRef" :model="formValue" :rules="rules" label-placement="top">
      <n-form-item :label="t('admin.users.form.display_name')" path="displayName">
        <n-input v-model:value="formValue.displayName" :placeholder="t('admin.users.form.display_name_placeholder')" />
      </n-form-item>

      <n-form-item v-if="!user" :label="t('admin.users.form.password')" path="password">
        <n-input
          v-model:value="formValue.password"
          type="password"
          show-password-on="click"
          :placeholder="t('admin.users.form.password_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('admin.users.form.admin')" path="isAdmin">
        <n-switch v-model:value="formValue.isAdmin" />
      </n-form-item>

      <n-form-item :label="t('admin.users.form.deactivated')" path="deactivated">
        <n-switch v-model:value="formValue.deactivated" />
      </n-form-item>
    </n-form>

    <n-space justify="end" class="form-actions">
      <n-button @click="$emit('cancel')">{{ t('common.cancel') }}</n-button>
      <n-button type="primary" @click="handleSubmit">{{ t('common.save') }}</n-button>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NForm, NFormItem, NInput, NSwitch, NSpace, NButton, useMessage } from 'naive-ui'

interface User {
  userId: string
  displayName?: string
  isAdmin: boolean
  deactivated: boolean
}

interface Props {
  user: User | null
}

interface Emits {
  (e: 'submit', data: Partial<User>): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const message = useMessage()

const formRef = ref()

const formValue = reactive({
  displayName: '',
  password: '',
  isAdmin: false,
  deactivated: false
})

const rules = {
  displayName: {
    required: true,
    message: t('admin.users.form.display_name_required'),
    trigger: 'blur'
  },
  password: {
    required: true,
    message: t('admin.users.form.password_required'),
    trigger: 'blur'
  }
}

watch(
  () => props.user,
  (user) => {
    if (user) {
      formValue.displayName = user.displayName || ''
      formValue.isAdmin = user.isAdmin
      formValue.deactivated = user.deactivated
    }
  },
  { immediate: true }
)

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    emit('submit', {
      displayName: formValue.displayName,
      isAdmin: formValue.isAdmin,
      deactivated: formValue.deactivated
    })
  } catch {
    // Validation failed
  }
}
</script>

<style lang="scss" scoped>
.user-form {
  padding: 16px 0;

  .form-actions {
    margin-top: 16px;
  }
}
</style>
