<template>
  <n-modal
    v-model:show="modelShow"
    preset="dialog"
    :title="t('spaces.create')"
    :show-icon="false"
    :mask-closable="false"
    :positive-text="t('common.confirm')"
    :negative-text="t('common.cancel')"
    :positive-button-props="{ loading }"
    :negative-button-props="{ disabled: loading }"
    style="width: 480px"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="left" label-width="100">
      <n-form-item :label="t('spaces.name_label')" path="name">
        <n-input
          v-model:value="formData.name"
          :placeholder="t('spaces.name_placeholder')"
          :maxlength="100"
          show-count
        />
      </n-form-item>

      <n-form-item :label="t('spaces.topic_label')" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          :placeholder="t('spaces.topic_placeholder')"
          :maxlength="500"
          show-count
          :rows="3"
        />
      </n-form-item>

      <n-form-item :label="t('spaces.visibility_label')" path="isPublic">
        <n-radio-group v-model:value="formData.isPublic">
          <n-space>
            <n-radio :value="false">
              {{ t('spaces.visibility_private') }}
            </n-radio>
            <n-radio :value="true">
              {{ t('spaces.visibility_public') }}
            </n-radio>
          </n-space>
        </n-radio-group>
      </n-form-item>
    </n-form>

  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpacesStore } from '@/stores/spaces'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success', spaceId: string): void
}>()

const { t } = useI18n()
const spacesStore = useSpacesStore()

const formRef = ref()
const loading = computed(() => spacesStore.loading)
const modelShow = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const formData = ref({
  name: '',
  topic: '',
  isPublic: false
})

const formRules = {
  name: [
    { required: true, message: t('spaces.name_label') + t('common.error'), trigger: 'blur' },
    { min: 1, max: 100, message: t('spaces.name_placeholder'), trigger: 'blur' }
  ]
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      formData.value = {
        name: '',
        topic: '',
        isPublic: false
      }
    }
  }
)

function handleConfirm(): void {
  formRef.value?.validate(async (errors: any) => {
    if (errors) return

    const spaceId = await spacesStore.createSpace({
      name: formData.value.name,
      topic: formData.value.topic,
      isPublic: formData.value.isPublic
    })

    if (spaceId) {
      window.$message.success(t('spaces.create_success'))
      emit('success', spaceId)
      emit('update:show', false)
    } else {
      window.$message.error(t('spaces.create_failed'))
    }
  })
}

function handleCancel(): void {
  emit('update:show', false)
}
</script>
